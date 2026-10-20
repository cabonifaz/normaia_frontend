import type { AppDependencies } from '@/application/AppDependencies';
import { createMaestrosUseCases } from '@/application/maestros/maestrosUseCases';
import { createRegistroUseCases } from '@/application/registro/registroUseCases';
import { env } from '@/infrastructure/config/env';
import { createJweCipher } from '@/infrastructure/crypto/JweCipher';
import { createHttpClient } from '@/infrastructure/http/httpClient';
import { createMaestrosRestRepository } from '@/infrastructure/maestros/MaestrosRestRepository';
import { createRegistroRestRepository } from '@/infrastructure/registro/RegistroRestRepository';

/** Raíz de composición: único lugar donde se conectan puertos con adaptadores. */
export function createContainer(hooks: { onUnauthorized?: () => void } = {}): AppDependencies {
  const http = createHttpClient({ baseUrl: env.apiBaseUrl, timeoutMs: env.httpTimeoutMs }, hooks);
  const cipher = createJweCipher(env.encryption);

  return {
    registro: createRegistroUseCases({ repo: createRegistroRestRepository(http), cipher }),
    maestros: createMaestrosUseCases({ repo: createMaestrosRestRepository(http) }),
  };
}
