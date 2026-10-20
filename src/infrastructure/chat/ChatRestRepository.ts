import { z } from 'zod';
import { AppError } from '@/application/errors';
import type { ChatRepository } from '@/application/ports/ChatRepository';
import type { Chat, EventoChat, Mensaje } from '@/domain/chat/chat';
import type { SessionStore } from '@/infrastructure/auth/sessionStore';
import { endpoints } from '@/infrastructure/config/endpoints';
import type { HttpClient, StreamOpener } from '@/infrastructure/http/httpClient';
import { leerSse } from '@/infrastructure/http/sse';

/**
 * Adaptador del chat RAG (backend Qamaq). Contratos tomados del Swagger y del front de referencia:
 *  - GET  /chats/get_chats                → { chats: [{ ID_CHAT, ID_AREA, ID_EMPRESA, TITULO, ULTIMO_MENSAJE_FECHA? }] }
 *  - POST /messages/chat?last_evaluated_key → { messages: [...], last_evaluated_key? }
 *  - PATCH/DELETE /chats/{id}             → { ID_TIPO_MENSAJE: 2 = ok, MENSAJE }
 *  - POST /messages/attachment-upload-urls → { uploads: [{ presigned_url, s3_key, document_name }] } + PUT directo a S3
 *  - POST /rag/chat-streaming | /rag/vlm-streaming → SSE `data: {type, ...}`
 * Voz/TTS fuera de alcance: siempre tts=false y se ignoran audio_chunk.
 */
const STREAM_IDLE_MS = 90_000;

const ChatRow = z.object({
  ID_CHAT: z.number().int().positive(),
  ID_AREA: z.number().int(),
  ID_EMPRESA: z.number().int(),
  TITULO: z.string().max(500).nullable().optional(),
  ULTIMO_MENSAJE_FECHA: z.string().max(64).nullable().optional(),
});
const ChatsSchema = z.object({ chats: z.array(ChatRow).max(5000) }).passthrough();

const httpsUrl = z.string().url().refine((u) => u.startsWith('https://') || u.startsWith('http://localhost'), 'solo https');
const MessageRow = z.object({
  id: z.string().max(200),
  created_at: z.string().max(32),
  sender: z.number().int(),
  message: z.string().max(200_000),
  attachment_urls: z.array(httpsUrl).max(20).nullable().optional(),
});
const MessagesSchema = z
  .object({ messages: z.array(MessageRow).max(1000), last_evaluated_key: z.record(z.unknown()).nullable().optional() })
  .passthrough();

const SpResult = z.object({ ID_TIPO_MENSAJE: z.number().int() }).passthrough();
const UploadsSchema = z
  .object({ uploads: z.array(z.object({ presigned_url: httpsUrl, s3_key: z.string().max(1024), document_name: z.string().max(255).optional() })).max(10) })
  .passthrough();

const toChat = (r: z.infer<typeof ChatRow>): Chat => {
  const t = r.ULTIMO_MENSAJE_FECHA ? Date.parse(r.ULTIMO_MENSAJE_FECHA) : NaN;
  return { id: r.ID_CHAT, titulo: r.TITULO ?? '', empresaId: r.ID_EMPRESA, areaId: r.ID_AREA, ultimoMensaje: Number.isNaN(t) ? null : t };
};

const toMensaje = (r: z.infer<typeof MessageRow>): Mensaje => {
  const ms = Number(r.created_at);
  return {
    id: r.id,
    remitente: r.sender === 0 ? 'usuario' : 'asistente',
    texto: r.message,
    creadoEn: Number.isFinite(ms) ? ms : Date.parse(r.created_at) || 0,
    adjuntos: r.attachment_urls ?? [],
  };
};

/** Traduce un evento del protocolo Qamaq al dominio. Eventos desconocidos → null (se ignoran). */
const SseEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('progress'), message: z.string().max(500) }),
  z.object({ type: z.literal('metadata'), chat_id: z.number().int().positive() }).passthrough(),
  z.object({ type: z.literal('chat_created'), chat: ChatRow.passthrough() }),
  z.object({ type: z.literal('assistant_metadata'), created_at: z.union([z.string(), z.number()]).optional() }).passthrough(),
  z.object({ type: z.literal('text_chunk'), content: z.string().max(200_000) }),
  z.object({ type: z.literal('complete') }).passthrough(),
  z.object({ type: z.literal('error') }).passthrough(),
]);

export function traducirEvento(raw: unknown): EventoChat | null {
  const p = SseEvent.safeParse(raw);
  if (!p.success) return null;
  const e = p.data;
  switch (e.type) {
    case 'progress':
      return { tipo: 'progreso', texto: e.message };
    case 'metadata':
      return { tipo: 'chat-asignado', chatId: e.chat_id };
    case 'chat_created':
      return { tipo: 'chat-creado', chat: toChat(e.chat) };
    case 'assistant_metadata': {
      const ms = Number(e.created_at);
      return { tipo: 'inicio-respuesta', creadoEn: Number.isFinite(ms) && ms > 0 ? ms : Date.now() };
    }
    case 'text_chunk':
      return { tipo: 'texto', contenido: e.content };
    case 'complete':
      return { tipo: 'fin' };
    case 'error':
      // El mensaje del servidor no se propaga a la UI.
      return { tipo: 'error' };
  }
}

const timezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return null;
  }
};

export function createChatRestRepository(http: HttpClient, openStream: StreamOpener, session: SessionStore, config: { uploadTimeoutMs: number }): ChatRepository {
  const bearer = () => session.session();

  return {
    async listarChats() {
      const { chats } = await http(endpoints.chats.listar, { schema: ChatsSchema, bearer: bearer() });
      return chats.map(toChat);
    },

    async mensajes(chatId, contexto, cursor) {
      const res = await http(endpoints.chats.mensajes, {
        method: 'POST',
        bearer: bearer(),
        schema: MessagesSchema,
        ...(cursor ? { query: { last_evaluated_key: cursor } } : {}),
        body: { chat_id: String(chatId), company_id: contexto.empresaId, area_id: contexto.areaId },
      });
      return {
        mensajes: res.messages.map(toMensaje).sort((a, b) => a.creadoEn - b.creadoEn),
        cursor: res.last_evaluated_key ? JSON.stringify(res.last_evaluated_key) : null,
      };
    },

    async renombrar(chatId, titulo) {
      const r = await http(endpoints.chats.porId(chatId), { method: 'PATCH', bearer: bearer(), body: { titulo }, schema: SpResult });
      if (r.ID_TIPO_MENSAJE !== 2) throw new AppError('server', 200, 'local');
    },

    async eliminar(chatId) {
      const r = await http(endpoints.chats.porId(chatId), { method: 'DELETE', bearer: bearer(), schema: SpResult });
      if (r.ID_TIPO_MENSAJE !== 2) throw new AppError('server', 200, 'local');
    },

    async subirAdjuntos(contexto, archivos) {
      const marca = Date.now().toString();
      const { uploads } = await http(endpoints.chats.urlsAdjuntos, {
        method: 'POST',
        bearer: bearer(),
        schema: UploadsSchema,
        body: { company_id: contexto.empresaId, area_id: contexto.areaId, filenames: archivos.map((a) => a.nombre), timestamp: marca },
      });
      if (uploads.length !== archivos.length) throw new AppError('contract', 200, 'local');
      await Promise.all(
        archivos.map(async (archivo, i) => {
          const u = uploads[i];
          if (!u) throw new AppError('contract', 200, 'local');
          // PUT directo a la URL prefirmada: sin credenciales ni Authorization (el JWT nunca va a S3).
          const res = await fetch(u.presigned_url, {
            method: 'PUT',
            body: archivo.contenido,
            credentials: 'omit',
            redirect: 'error',
            referrerPolicy: 'no-referrer',
            signal: AbortSignal.timeout(config.uploadTimeoutMs),
          }).catch(() => {
            throw new AppError('network', 0, 'upload');
          });
          if (!res.ok) throw new AppError('server', res.status, 'upload');
        }),
      );
      return { nombres: archivos.map((a) => a.nombre), marca };
    },

    async *consultar(c, signal) {
      const comunes = {
        message: c.texto,
        user_id: c.usuarioId,
        company_id: c.contexto.empresaId,
        area_id: c.contexto.areaId,
        chat_id: c.chatId,
        request_timezone: timezone(),
      };
      const { body, requestId } = c.adjuntos
        ? await openStream(endpoints.rag.vlm, {
            bearer: bearer(),
            signal,
            body: { ...comunes, created_at: c.adjuntos.marca, filenames: c.adjuntos.nombres, vlm_mode: 'vlm_qa_over_text' },
          })
        : await openStream(endpoints.rag.chat, { bearer: bearer(), signal, body: { ...comunes, created_at: Date.now().toString(), tts: false } });

      for await (const raw of leerSse(body, { signal, idleMs: STREAM_IDLE_MS, requestId })) {
        const ev = traducirEvento(raw);
        if (!ev) continue;
        yield ev;
        if (ev.tipo === 'fin' || ev.tipo === 'error') return;
      }
    },
  };
}
