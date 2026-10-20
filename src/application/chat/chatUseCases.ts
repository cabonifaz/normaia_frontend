import { AppError } from '@/application/errors';
import type { ArchivoAdjunto, ChatRepository, Consulta, PaginaMensajes, PerfilRepository } from '@/application/ports/ChatRepository';
import {
  firmaImagenValida,
  LIMITES,
  nombreSeguro,
  normalizarMensaje,
  normalizarTitulo,
  ordenarChats,
  validarAdjuntos,
  validarMensaje,
  type Chat,
  type ContextoTrabajo,
  type EventoChat,
  type UsuarioSesion,
} from '@/domain/chat/chat';

export interface NuevaConsulta {
  texto: string;
  chatId: number | null;
  contexto: ContextoTrabajo;
  archivos: ArchivoAdjunto[];
}

export interface ChatUseCases {
  usuarioActual(): UsuarioSesion | null;
  contextos(): Promise<ContextoTrabajo[]>;
  cerrarSesion(): Promise<void>;
  listarChats(contexto: ContextoTrabajo): Promise<Chat[]>;
  mensajes(chatId: number, contexto: ContextoTrabajo, cursor: string | null): Promise<PaginaMensajes>;
  renombrar(chatId: number, titulo: string): Promise<string>;
  eliminar(chatId: number): Promise<void>;
  /** Valida, sube adjuntos y emite el streaming de la respuesta. */
  consultar(input: NuevaConsulta, signal: AbortSignal): AsyncIterable<EventoChat>;
}

const invalid = () => new AppError('validation', 0, 'local');

async function cabecera(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.slice(0, 12).arrayBuffer());
}

export function createChatUseCases(deps: { chats: ChatRepository; perfil: PerfilRepository }): ChatUseCases {
  const { chats, perfil } = deps;

  return {
    usuarioActual: () => perfil.usuarioActual(),
    contextos: () => perfil.contextos(),
    cerrarSesion: () => perfil.cerrarSesion(),

    async listarChats(contexto) {
      // El backend devuelve todos los chats del usuario: se muestran solo los del área activa.
      const todos = await chats.listarChats();
      return ordenarChats(todos.filter((c) => c.empresaId === contexto.empresaId && c.areaId === contexto.areaId));
    },

    mensajes: (chatId, contexto, cursor) => chats.mensajes(chatId, contexto, cursor),

    async renombrar(chatId, titulo) {
      const limpio = normalizarTitulo(titulo);
      if (!limpio) throw invalid();
      await chats.renombrar(chatId, limpio);
      return limpio;
    },

    eliminar: (chatId) => chats.eliminar(chatId),

    async *consultar(input, signal) {
      const usuario = perfil.usuarioActual();
      if (!usuario) throw new AppError('unauthorized', 401, 'local');
      if (validarMensaje(input.texto)) throw invalid();

      // Adjuntos: reglas de dominio + firma binaria (no se confía en la extensión).
      if (validarAdjuntos(0, input.archivos.map((a) => ({ nombre: a.nombre, tipo: a.tipo, peso: a.contenido.size })))) throw invalid();
      for (const a of input.archivos) if (!firmaImagenValida(await cabecera(a.contenido))) throw invalid();

      const archivos = input.archivos.slice(0, LIMITES.adjuntos).map((a, i) => ({ ...a, nombre: nombreSeguro(a.nombre, i) }));
      const adjuntos = archivos.length ? await chats.subirAdjuntos(input.contexto, archivos) : null;

      const consulta: Consulta = {
        texto: normalizarMensaje(input.texto),
        chatId: input.chatId,
        contexto: input.contexto,
        usuarioId: usuario.id,
        adjuntos,
      };
      yield* chats.consultar(consulta, signal);
    },
  };
}
