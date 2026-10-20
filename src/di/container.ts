import type { AppDependencies } from '@/application/AppDependencies';
import { createAuthUseCases } from '@/application/auth/authUseCases';
import { createChatUseCases } from '@/application/chat/chatUseCases';
import { createMaestrosUseCases } from '@/application/maestros/maestrosUseCases';
import { createRegistroUseCases } from '@/application/registro/registroUseCases';
import { createAuthRestRepository } from '@/infrastructure/auth/AuthRestRepository';
import { createSessionStore } from '@/infrastructure/auth/sessionStore';
import { createChatRestRepository } from '@/infrastructure/chat/ChatRestRepository';
import { createPerfilRestRepository } from '@/infrastructure/chat/PerfilRestRepository';
import { env } from '@/infrastructure/config/env';
import { createJweCipher } from '@/infrastructure/crypto/JweCipher';
import { createHttpClient, createStreamOpener } from '@/infrastructure/http/httpClient';
import { createMaestrosRestRepository } from '@/infrastructure/maestros/MaestrosRestRepository';
import { createMockAuthRepository, createMockMaestrosRepository, createMockRegistroRepository } from '@/infrastructure/mock/mockAdapters';
import { createMockChatRepository, createMockPerfilRepository } from '@/infrastructure/mock/mockChat';
import { createRegistroRestRepository } from '@/infrastructure/registro/RegistroRestRepository';

/** Raíz de composición: único lugar donde se conectan puertos con adaptadores. */
export function createContainer(hooks: { onUnauthorized?: () => void } = {}): AppDependencies {
  const session = createSessionStore();
  const unauthorized = {
    // Un 401 solo es "sesión expirada" si había sesión. Durante el registro (sin login) un 401 es
    // un error del endpoint y se informa en su pantalla, sin expulsar al usuario del flujo.
    onUnauthorized: () => {
      if (!session.session()) return;
      session.clear();
      hooks.onUnauthorized?.();
    },
  };
  const httpConfig = { baseUrl: env.apiBaseUrl, timeoutMs: env.httpTimeoutMs };
  const http = createHttpClient(httpConfig, unauthorized);
  const openStream = createStreamOpener(httpConfig, unauthorized);
  const cipher = createJweCipher(env.encryption);
  const registroRepo = env.useMocks ? createMockRegistroRepository() : createRegistroRestRepository(http, session);
  const authRepo = env.useMocks ? createMockAuthRepository() : createAuthRestRepository(http, session, { companyRef: env.companyRef });
  const chatRepo = env.useMocks ? createMockChatRepository() : createChatRestRepository(http, openStream, session, { uploadTimeoutMs: 60_000 });
  const perfilRepo = env.useMocks ? createMockPerfilRepository() : createPerfilRestRepository(http, session);
  const maestrosRepo = env.useMocks ? createMockMaestrosRepository() : createMaestrosRestRepository(http, session);

  return {
    auth: createAuthUseCases({ repo: authRepo, cipher }),
    chat: createChatUseCases({ chats: chatRepo, perfil: perfilRepo }),
    registro: createRegistroUseCases({ repo: registroRepo, cipher }),
    maestros: createMaestrosUseCases({ repo: maestrosRepo }),
  };
}
