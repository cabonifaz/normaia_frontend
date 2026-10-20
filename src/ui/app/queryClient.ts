import { QueryClient } from '@tanstack/react-query';
import { AppError } from '@/application/errors';

/** Sin persistencia: la caché vive solo en memoria de la pestaña. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        // Reintentar solo fallos transitorios; nunca 4xx ni contratos rotos.
        retry: (count, err) => count < 2 && err instanceof AppError && ['network', 'timeout', 'server'].includes(err.kind),
      },
      mutations: { retry: false },
    },
  });
}
