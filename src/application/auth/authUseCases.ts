import { AppError } from '@/application/errors';
import type { AuthRepository } from '@/application/ports/AuthRepository';
import type { PayloadCipher } from '@/application/ports/PayloadCipher';
import { validateLogin, validateReset, type LoginInput, type ResetInput } from '@/domain/auth/auth';
import { emailSchema, type Challenge } from '@/domain/registro/registro';

export interface AuthUseCases {
  iniciarSesion(input: LoginInput): Promise<void>;
  solicitarRecuperacion(email: string): Promise<{ email: string; challenge: Challenge }>;
  reenviarRecuperacion(challengeId: string): Promise<Challenge>;
  restablecerPassword(challengeId: string, input: ResetInput): Promise<void>;
  haySesion(): boolean;
}

export function createAuthUseCases(deps: { repo: AuthRepository; cipher: PayloadCipher }): AuthUseCases {
  const { repo, cipher } = deps;
  const invalid = () => new AppError('validation', 0, 'local');

  return {
    async iniciarSesion(input) {
      if (Object.keys(validateLogin(input)).length) throw invalid();
      const email = emailSchema.parse(input.email);
      await repo.iniciarSesion(email, await cipher.protect(input.password));
    },

    async solicitarRecuperacion(raw) {
      const parsed = emailSchema.safeParse(raw);
      if (!parsed.success) throw invalid();
      return { email: parsed.data, challenge: await repo.solicitarRecuperacion(parsed.data) };
    },

    haySesion() {
      return repo.haySesion();
    },

    reenviarRecuperacion(challengeId) {
      return repo.reenviarRecuperacion(challengeId);
    },

    async restablecerPassword(challengeId, input) {
      if (Object.keys(validateReset(input)).length) throw invalid();
      const [codigo, password] = await Promise.all([cipher.protect(input.digits.join('')), cipher.protect(input.password)]);
      await repo.restablecerPassword(challengeId, codigo, password);
    },
  };
}
