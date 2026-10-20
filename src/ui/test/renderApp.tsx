import { createMemoryHistory } from '@tanstack/react-router';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import type { AppDependencies } from '@/application/AppDependencies';
import type { AuthUseCases } from '@/application/auth/authUseCases';
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

/** Casos de uso falsos: la UI se prueba sin red, sin cifrado y sin vi.mock de módulos. */
export function fakeDeps() {
  return {
    auth: {
      iniciarSesion: vi.fn<AuthUseCases['iniciarSesion']>(() => Promise.resolve()),
      solicitarRecuperacion: vi.fn((email: string) => Promise.resolve({ email: email.trim().toLowerCase(), challenge })),
      reenviarRecuperacion: vi.fn(() => Promise.resolve(challenge)),
      restablecerPassword: vi.fn<AuthUseCases['restablecerPassword']>(() => Promise.resolve()),
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
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }));
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false } });
  render(<App deps={deps} queryClient={queryClient} router={router} />);
  return { router, deps };
}
