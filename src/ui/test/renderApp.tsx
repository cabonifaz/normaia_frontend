import { createMemoryHistory } from '@tanstack/react-router';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import type { AppDependencies } from '@/application/AppDependencies';
import type { AuthUseCases } from '@/application/auth/authUseCases';
import type { ChatUseCases } from '@/application/chat/chatUseCases';
import type { Chat, EventoChat } from '@/domain/chat/chat';
import type { MaestroItem } from '@/domain/maestros/maestro';
import { App } from '@/ui/app/App';
import { createQueryClient } from '@/ui/app/queryClient';
import { createAppRouter } from '@/ui/app/router';

export const challenge = { challengeId: 'ch_0123456789abcdef', resendAfter: 30 };

const MAESTROS: Record<string, MaestroItem[]> = {
  FORMACION: [
    { codigo: 'ING_CIVIL', descripcion: 'Ingeniero civil' },
    { codigo: 'ARQ', descripcion: 'Arquitecto' },
    { codigo: 'EST', descripcion: 'Estudiante' },
  ],
  INSTITUCION: [
    { codigo: 'ULIMA', descripcion: 'Universidad de Lima' },
    { codigo: 'UNI', descripcion: 'Universidad Nacional de Ingeniería' },
  ],
};

export const CONTEXTO = { empresaId: 1, empresa: 'NORMA', areaId: 7, area: 'GENERAL' };
export const CHATS: Chat[] = [
  { id: 11, titulo: 'Salidas de evacuación', empresaId: 1, areaId: 7, ultimoMensaje: 2000 },
  { id: 12, titulo: '', empresaId: 1, areaId: 7, ultimoMensaje: 1000 },
];

/** Respuesta simulada: texto ACUMULADO por evento, como el backend real. */
export async function* respuesta(texto = 'Según la **A.130**, se requieren 2 salidas.', chatId = 99): AsyncGenerator<EventoChat> {
  yield { tipo: 'progreso', texto: 'Buscando en el reglamento…' };
  yield { tipo: 'chat-asignado', chatId };
  yield { tipo: 'chat-creado', chat: { id: chatId, titulo: 'Nueva', empresaId: 1, areaId: 7, ultimoMensaje: 3000 } };
  yield { tipo: 'inicio-respuesta', creadoEn: 3000 };
  const partes = texto.split(' ');
  for (let i = 1; i <= partes.length; i++) yield { tipo: 'texto', contenido: partes.slice(0, i).join(' ') };
  yield { tipo: 'fin' };
}

/** Casos de uso falsos: la UI se prueba sin red, sin cifrado y sin vi.mock de módulos. */
export function fakeDeps() {
  let sesion = false;
  return {
    auth: {
      iniciarSesion: vi.fn<AuthUseCases['iniciarSesion']>(() => {
        sesion = true;
        return Promise.resolve();
      }),
      haySesion: vi.fn<AuthUseCases['haySesion']>(() => sesion),
      solicitarRecuperacion: vi.fn((email: string) => Promise.resolve({ email: email.trim().toLowerCase(), challenge })),
      reenviarRecuperacion: vi.fn(() => Promise.resolve(challenge)),
      restablecerPassword: vi.fn<AuthUseCases['restablecerPassword']>(() => Promise.resolve()),
    },
    chat: {
      usuarioActual: vi.fn<ChatUseCases['usuarioActual']>(() => ({ id: 5, correo: 'ana@correo.com', nombres: 'Ana', apellidos: 'Quispe' })),
      contextos: vi.fn<ChatUseCases['contextos']>(() => Promise.resolve([CONTEXTO])),
      cerrarSesion: vi.fn<ChatUseCases['cerrarSesion']>(() => {
        sesion = false;
        return Promise.resolve();
      }),
      listarChats: vi.fn<ChatUseCases['listarChats']>(() => Promise.resolve([...CHATS])),
      mensajes: vi.fn<ChatUseCases['mensajes']>(() =>
        Promise.resolve({
          mensajes: [
            { id: 'u1', remitente: 'usuario' as const, texto: '¿Cuántas salidas?', creadoEn: 1000, adjuntos: [] },
            { id: 'a1', remitente: 'asistente' as const, texto: 'Dos, según la A.130.', creadoEn: 2000, adjuntos: [] },
          ],
          cursor: null,
        }),
      ),
      renombrar: vi.fn<ChatUseCases['renombrar']>((_id, t) => Promise.resolve(t)),
      eliminar: vi.fn<ChatUseCases['eliminar']>(() => Promise.resolve()),
      consultar: vi.fn<ChatUseCases['consultar']>(() => respuesta()),
    },
    registro: {
      solicitarCodigo: vi.fn((email: string) => Promise.resolve({ email: email.trim().toLowerCase(), challenge })),
      reenviarCodigo: vi.fn(() => Promise.resolve(challenge)),
      verificarCodigo: vi.fn(() => Promise.resolve('reg_token_0123456789')),
      completarRegistro: vi.fn(() => Promise.resolve()),
    },
    maestros: {
      obtener: vi.fn((grupo: string) => Promise.resolve(MAESTROS[grupo] ?? [])),
    },
  } satisfies AppDependencies;
}

export function renderApp(path: string, deps: AppDependencies = fakeDeps()) {
  const router = createAppRouter(deps, createMemoryHistory({ initialEntries: [path] }));
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false } });
  render(<App deps={deps} queryClient={queryClient} router={router} />);
  return { router, deps };
}
