/** Dominio del chat RAG de Norma IA. TypeScript puro: sin React ni HTTP. */

export interface Chat {
  id: number;
  titulo: string;
  empresaId: number;
  areaId: number;
  /** epoch ms del último mensaje, para ordenar. */
  ultimoMensaje: number | null;
}

export type Remitente = 'usuario' | 'asistente';

export interface Mensaje {
  id: string;
  remitente: Remitente;
  texto: string;
  /** epoch ms */
  creadoEn: number;
  /** URLs de imágenes adjuntas (prefirmadas por el backend o blob: locales). */
  adjuntos: string[];
}

/** Empresa/área sobre la que se consulta (la base documental del RAG). */
export interface ContextoTrabajo {
  empresaId: number;
  empresa: string;
  areaId: number;
  area: string;
}

export interface UsuarioSesion {
  id: number;
  correo: string;
  nombres: string;
  apellidos: string;
}

/** Eventos del streaming, ya traducidos del protocolo del backend. */
export type EventoChat =
  | { tipo: 'progreso'; texto: string }
  | { tipo: 'chat-asignado'; chatId: number }
  | { tipo: 'chat-creado'; chat: Chat }
  | { tipo: 'inicio-respuesta'; creadoEn: number }
  | { tipo: 'texto'; contenido: string }
  | { tipo: 'fin' }
  | { tipo: 'error' };

export const LIMITES = {
  mensaje: 4000,
  titulo: 50,
  adjuntos: 5,
  /** bytes por imagen */
  pesoAdjunto: 10 * 1024 * 1024,
} as const;

export const MSG_CHAT = {
  vacio: 'Escribe tu consulta.',
  largo: `Tu consulta supera los ${LIMITES.mensaje} caracteres. Resúmela un poco.`,
  tituloVacio: 'El título no puede quedar vacío.',
  adjuntoTipo: 'Solo se aceptan imágenes PNG, JPG o WEBP.',
  adjuntoPeso: 'Cada imagen debe pesar menos de 10 MB.',
  adjuntoMax: `Puedes adjuntar hasta ${LIMITES.adjuntos} imágenes por consulta.`,
} as const;

// Caracteres de control (salvo \n y \t) no aportan nada y se usan para ofuscar contenido.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function normalizarMensaje(texto: string): string {
  return texto.replace(CONTROL, '').replace(/\r\n?/g, '\n').trim();
}

export function validarMensaje(texto: string): string | null {
  const t = normalizarMensaje(texto);
  if (!t) return MSG_CHAT.vacio;
  if (t.length > LIMITES.mensaje) return MSG_CHAT.largo;
  return null;
}

export function normalizarTitulo(titulo: string): string {
  return titulo.replace(CONTROL, '').replace(/\s+/g, ' ').trim().slice(0, LIMITES.titulo);
}

export function tituloVisible(chat: Pick<Chat, 'id' | 'titulo'>): string {
  return chat.titulo.trim() || `Consulta #${chat.id}`;
}

/** Más reciente primero; sin fecha al final. */
export function ordenarChats(chats: readonly Chat[]): Chat[] {
  return [...chats].sort((a, b) => (b.ultimoMensaje ?? 0) - (a.ultimoMensaje ?? 0));
}

const MIME_PERMITIDOS = ['image/png', 'image/jpeg', 'image/webp'] as const;

/** Firma binaria ("magic bytes"): no confiar solo en la extensión ni en el MIME que declara el navegador. */
export function firmaImagenValida(cabecera: Uint8Array): boolean {
  const b = cabecera;
  const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const jpg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const webp = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
  return png || jpg || webp;
}

export interface ArchivoCandidato {
  nombre: string;
  tipo: string;
  peso: number;
}

/** Reglas de adjuntos que no requieren leer el archivo. La firma se valida aparte. */
export function validarAdjuntos(actuales: number, nuevos: readonly ArchivoCandidato[]): string | null {
  if (actuales + nuevos.length > LIMITES.adjuntos) return MSG_CHAT.adjuntoMax;
  for (const f of nuevos) {
    if (!(MIME_PERMITIDOS as readonly string[]).includes(f.tipo)) return MSG_CHAT.adjuntoTipo;
    if (f.peso <= 0 || f.peso > LIMITES.pesoAdjunto) return MSG_CHAT.adjuntoPeso;
  }
  return null;
}

/** Nombre seguro para la clave en S3: sin rutas, sin caracteres raros, extensión conservada. */
export function nombreSeguro(nombre: string, indice: number): string {
  const ext = (/\.(png|jpe?g|webp)$/i.exec(nombre)?.[1] ?? 'img').toLowerCase();
  const base = nombre
    .replace(/\.[^.]*$/, '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${base || 'imagen'}-${indice + 1}.${ext}`;
}

/**
 * Acumula el texto del streaming. El backend Qamaq envía en cada `text_chunk` el texto
 * ACUMULADO (comportamiento del front de referencia); si en el futuro enviara deltas,
 * se concatenan. Así el front tolera ambos contratos sin duplicar texto.
 */
export function acumularTexto(actual: string, recibido: string): string {
  if (!actual) return recibido;
  if (recibido.startsWith(actual)) return recibido;
  return actual + recibido;
}

/** Códigos de norma del RNE (A.130, E.030, IS.010, GH.020, EM.110…) para resaltarlos. */
export const CODIGO_NORMA = /\b(?:A|E|G|GH|TH|OS|IS|EM|EC|CE|H|U)\.\d{3}\b/g;
