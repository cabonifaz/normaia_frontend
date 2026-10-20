import type { Chat, ContextoTrabajo, EventoChat, Mensaje, UsuarioSesion } from '@/domain/chat/chat';

export interface PaginaMensajes {
  /** Orden cronológico ascendente (más antiguo primero). */
  mensajes: Mensaje[];
  /** Cursor opaco para pedir mensajes más antiguos; null si no hay más. */
  cursor: string | null;
}

export interface Consulta {
  texto: string;
  chatId: number | null;
  contexto: ContextoTrabajo;
  usuarioId: number;
  /** Claves de adjuntos ya subidos (nombres en el almacenamiento) y su marca de tiempo. */
  adjuntos: { nombres: string[]; marca: string } | null;
}

export interface ArchivoAdjunto {
  nombre: string;
  tipo: string;
  contenido: Blob;
}

/** Puerto de salida: conversaciones del RAG. */
export interface ChatRepository {
  listarChats(): Promise<Chat[]>;
  mensajes(chatId: number, contexto: ContextoTrabajo, cursor: string | null): Promise<PaginaMensajes>;
  renombrar(chatId: number, titulo: string): Promise<void>;
  eliminar(chatId: number): Promise<void>;
  /** Sube los adjuntos (p. ej. a S3 con URLs prefirmadas) y devuelve los nombres usados. */
  subirAdjuntos(contexto: ContextoTrabajo, archivos: ArchivoAdjunto[]): Promise<{ nombres: string[]; marca: string }>;
  /** Envía la consulta y emite los eventos del streaming. Cancelable con `signal`. */
  consultar(consulta: Consulta, signal: AbortSignal): AsyncIterable<EventoChat>;
}

/** Puerto de salida: datos de la sesión y del contexto de trabajo del usuario. */
export interface PerfilRepository {
  /** Datos del usuario para mostrar (nombre). No es una fuente de autorización. */
  usuarioActual(): UsuarioSesion | null;
  contextos(): Promise<ContextoTrabajo[]>;
  cerrarSesion(): Promise<void>;
}
