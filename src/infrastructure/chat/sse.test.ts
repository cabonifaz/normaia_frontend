import { describe, expect, it } from 'vitest';
import { leerSse } from '@/infrastructure/http/sse';
import { traducirEvento } from './ChatRestRepository';

function stream(chunks: string[], { cerrar = true }: { cerrar?: boolean } = {}) {
  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(ch));
      if (cerrar) c.close();
    },
  });
}

async function todo(body: ReadableStream<Uint8Array>, opts: Partial<{ signal: AbortSignal; idleMs: number }> = {}) {
  const out: unknown[] = [];
  for await (const e of leerSse(body, { signal: opts.signal ?? new AbortController().signal, idleMs: opts.idleMs ?? 5000, requestId: 't' })) out.push(e);
  return out;
}

describe('lector SSE', () => {
  it('reconstruye eventos partidos entre chunks y tolera \\r\\n', async () => {
    const r = await todo(stream(['data: {"type":"progress","mes', 'sage":"Buscando"}\r\n\r\ndata: {"type":"complete"}\n\n']));
    expect(r).toEqual([{ type: 'progress', message: 'Buscando' }, { type: 'complete' }]);
  });

  it('ignora comentarios, líneas event: y JSON corrupto', async () => {
    const r = await todo(stream([': ping\n\n', 'event: x\ndata: {"type":"complete"}\n\n', 'data: {roto\n\n']));
    expect(r).toEqual([{ type: 'complete' }]);
  });

  it('corta por inactividad (stream que se queda mudo)', async () => {
    await expect(todo(stream(['data: {"type":"progress","message":"a"}\n\n'], { cerrar: false }), { idleMs: 50 })).rejects.toMatchObject({ kind: 'timeout' });
  });

  it('se cancela con el AbortSignal', async () => {
    const ac = new AbortController();
    const p = todo(stream([], { cerrar: false }), { signal: ac.signal });
    ac.abort();
    await expect(p).rejects.toMatchObject({ kind: 'aborted' });
  });

  it('rechaza un evento sin separador que crece sin límite', async () => {
    await expect(todo(stream(['data: ' + 'x'.repeat(1024 * 1024 + 10)]))).rejects.toMatchObject({ kind: 'contract' });
  });
});

describe('protocolo Qamaq → dominio', () => {
  it('traduce los eventos conocidos', () => {
    expect(traducirEvento({ type: 'progress', message: 'Buscando…' })).toEqual({ tipo: 'progreso', texto: 'Buscando…' });
    expect(traducirEvento({ type: 'metadata', chat_id: 42, otro: 1 })).toEqual({ tipo: 'chat-asignado', chatId: 42 });
    expect(traducirEvento({ type: 'text_chunk', content: 'Hola' })).toEqual({ tipo: 'texto', contenido: 'Hola' });
    expect(traducirEvento({ type: 'assistant_metadata', created_at: '1700000000000' })).toEqual({ tipo: 'inicio-respuesta', creadoEn: 1700000000000 });
    expect(traducirEvento({ type: 'complete' })).toEqual({ tipo: 'fin' });
    expect(traducirEvento({ type: 'chat_created', chat: { ID_CHAT: 9, ID_AREA: 7, ID_EMPRESA: 1, TITULO: 'T', ULTIMO_MENSAJE_FECHA: '2026-10-20T10:00:00' } })).toMatchObject({
      tipo: 'chat-creado',
      chat: { id: 9, titulo: 'T', areaId: 7, empresaId: 1 },
    });
  });

  it('el mensaje de error del servidor no llega a la UI', () => {
    expect(traducirEvento({ type: 'error', message: 'SQL timeout en SP_RAG', result: { idTipoMensaje: 1, mensaje: 'x' } })).toEqual({ tipo: 'error' });
  });

  it('ignora eventos desconocidos (voz) o malformados', () => {
    expect(traducirEvento({ type: 'audio_chunk', content: 'AAAA' })).toBeNull();
    expect(traducirEvento({ type: 'metadata', chat_id: '1; DROP' })).toBeNull();
    expect(traducirEvento('basura')).toBeNull();
  });
});
