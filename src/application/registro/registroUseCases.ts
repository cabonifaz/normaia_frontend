import { AppError } from '@/application/errors';
import type { PayloadCipher } from '@/application/ports/PayloadCipher';
import type { RegistroRepository } from '@/application/ports/RegistroRepository';
import {
  codeSchema,
  emailSchema,
  validateProfile,
  type AllowedOptions,
  type Challenge,
  type ProfileInput,
} from '@/domain/registro/registro';

export interface RegistroUseCases {
  solicitarCodigo(email: string): Promise<{ email: string; challenge: Challenge }>;
  reenviarCodigo(challengeId: string): Promise<Challenge>;
  verificarCodigo(challengeId: string, codigo: string): Promise<string>;
  completarRegistro(registrationToken: string, perfil: ProfileInput, allowed: AllowedOptions): Promise<void>;
}

/** Los casos de uso revalidan siempre con el dominio: la UI no es una frontera de confianza. */
export function createRegistroUseCases(deps: { repo: RegistroRepository; cipher: PayloadCipher }): RegistroUseCases {
  const { repo, cipher } = deps;
  const invalid = () => new AppError('validation', 0, 'local');

  return {
    async solicitarCodigo(raw) {
      const parsed = emailSchema.safeParse(raw);
      if (!parsed.success) throw invalid();
      return { email: parsed.data, challenge: await repo.solicitarCodigo(parsed.data) };
    },

    reenviarCodigo(challengeId) {
      return repo.reenviarCodigo(challengeId);
    },

    async verificarCodigo(challengeId, codigo) {
      const parsed = codeSchema.safeParse(codigo);
      if (!parsed.success) throw invalid();
      return repo.verificarCodigo(challengeId, await cipher.protect(parsed.data));
    },

    async completarRegistro(registrationToken, perfil, allowed) {
      if (validateProfile(perfil, allowed).errors.length) throw invalid();
      await repo.crearCuenta(registrationToken, {
        nombres: perfil.nombres.trim(),
        apellidos: perfil.apellidos.trim(),
        formacion: perfil.formacion,
        fechaNacimiento: perfil.nacimiento,
        institucion: perfil.institucion,
        passwordProtegida: await cipher.protect(perfil.password),
        aceptaTerminos: true,
      });
    },
  };
}
