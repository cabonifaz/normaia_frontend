import { AppError } from '@/application/errors';
import type { ChatRepository, PerfilRepository } from '@/application/ports/ChatRepository';
import type { Chat, EventoChat, Mensaje } from '@/domain/chat/chat';
import { mockSesion } from './mockAdapters';

/**
 * Chat simulado SOLO para desarrollo sin backend (VITE_USE_MOCKS=true).
 * Emite los mismos eventos que el backend real (progreso → chat → texto acumulado → fin).
 */
const CONTEXTO = { empresaId: 1, empresa: 'NORMA', areaId: 1, area: 'GENERAL' };

const RESPUESTA = `Según la **Norma A.130 · Requisitos de Seguridad**, el número de salidas de evacuación se determina por el **aforo** del local y la distancia máxima de recorrido.

| Aforo del nivel | Salidas mínimas |
| --- | --- |
| Hasta 500 personas | 2 |
| 501 a 1 000 personas | 3 |
| Más de 1 000 personas | 4 |

- **Artículo 7:** el ancho libre de cada salida no será menor de 1,00 m.
- **Artículo 22:** la distancia máxima de recorrido sin rociadores es de 45 m.

Para centros comerciales revisa también la **A.070 · Comercio**.

> Verifica el texto oficial antes de aplicarlo: las respuestas son referenciales.`;

const espera = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new AppError('aborted', 0, 'mock'));
    });
  });

export function createMockPerfilRepository(): PerfilRepository {
  return {
    usuarioActual: () => (mockSesion.activa ? { id: 1, correo: 'cris.bonifaz@fractal.com.pe', nombres: 'Cris', apellidos: 'Bonifaz' } : null),
    contextos: () => Promise.resolve([CONTEXTO]),
    cerrarSesion: () => {
      mockSesion.activa = false;
      return Promise.resolve();
    },
  };
}

export function createMockChatRepository(): ChatRepository {
  let siguienteId = 3;
  const chats: Chat[] = [
    { id: 1, titulo: 'Salidas de evacuación en centro comercial', empresaId: 1, areaId: 1, ultimoMensaje: Date.now() - 3_600_000 },
    { id: 2, titulo: 'Dotación de agua IS.010', empresaId: 1, areaId: 1, ultimoMensaje: Date.now() - 86_400_000 },
  ];
  const historial = new Map<number, Mensaje[]>([
    [
      1,
      [
        { id: 'm1', remitente: 'usuario', texto: '¿Cuántas salidas de evacuación necesita un centro comercial?', creadoEn: Date.now() - 3_600_000, adjuntos: [] },
        { id: 'm2', remitente: 'asistente', texto: RESPUESTA, creadoEn: Date.now() - 3_590_000, adjuntos: [] },
      ],
    ],
    [2, []],
  ]);

  return {
    listarChats: () => Promise.resolve([...chats]),
    mensajes: (chatId) => Promise.resolve({ mensajes: [...(historial.get(chatId) ?? [])], cursor: null }),
    renombrar(chatId, titulo) {
      const c = chats.find((x) => x.id === chatId);
      if (c) c.titulo = titulo;
      return Promise.resolve();
    },
    eliminar(chatId) {
      const i = chats.findIndex((x) => x.id === chatId);
      if (i >= 0) chats.splice(i, 1);
      return Promise.resolve();
    },
    subirAdjuntos: (_ctx, archivos) => Promise.resolve({ nombres: archivos.map((a) => a.nombre), marca: Date.now().toString() }),

    async *consultar(c, signal): AsyncGenerator<EventoChat> {
      yield { tipo: 'progreso', texto: c.adjuntos ? 'Analizando las imágenes…' : 'Buscando en el Reglamento Nacional de Edificaciones…' };
      await espera(700, signal);
      let chatId = c.chatId;
      if (chatId === null) {
        chatId = siguienteId++;
        const nuevo: Chat = { id: chatId, titulo: c.texto.slice(0, 50), empresaId: 1, areaId: 1, ultimoMensaje: Date.now() };
        chats.unshift(nuevo);
        historial.set(chatId, []);
        yield { tipo: 'chat-asignado', chatId };
        yield { tipo: 'chat-creado', chat: nuevo };
      } else {
        yield { tipo: 'chat-asignado', chatId };
      }
      const ahora = Date.now();
      historial.get(chatId)?.push({ id: `u${ahora}`, remitente: 'usuario', texto: c.texto, creadoEn: ahora, adjuntos: [] });
      yield { tipo: 'inicio-respuesta', creadoEn: ahora + 1 };
      let acumulado = '';
      for (const palabra of RESPUESTA.split(/(?<=\s)/)) {
        await espera(18, signal);
        acumulado += palabra;
        yield { tipo: 'texto', contenido: acumulado }; // acumulado, como el backend real
      }
      historial.get(chatId)?.push({ id: `a${ahora}`, remitente: 'asistente', texto: acumulado, creadoEn: ahora + 1, adjuntos: [] });
      const ch = chats.find((x) => x.id === chatId);
      if (ch) ch.ultimoMensaje = Date.now();
      yield { tipo: 'fin' };
    },
  };
}
