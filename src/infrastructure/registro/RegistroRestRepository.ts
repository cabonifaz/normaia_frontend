import { z } from 'zod';
import type { RegistroRepository } from '@/application/ports/RegistroRepository';
import { endpoints } from '@/infrastructure/config/endpoints';
import type { HttpClient } from '@/infrastructure/http/httpClient';

/**
 * Adaptador REST del puerto RegistroRepository.
 * PENDIENTE: ajustar request/response a los contratos reales del backend.
 * Los esquemas zod son el contrato: si el backend responde distinto, se rechaza.
 */
const ChallengeSchema = z.object({
  challengeId: z.string().min(16).max(256),
  resendAfter: z.number().int().min(0).max(3600).default(30),
});

const VerifySchema = z.object({
  /** Token de registro de un solo uso y vida corta. Solo en memoria. */
  registrationToken: z.string().min(16).max(4096),
});

const CreateSchema = z.object({ userId: z.string().min(1).max(128) }).passthrough();

export function createRegistroRestRepository(http: HttpClient): RegistroRepository {
  return {
    solicitarCodigo: (email) => http(endpoints.auth.requestCode, { method: 'POST', body: { email }, schema: ChallengeSchema }),

    reenviarCodigo: (challengeId) => http(endpoints.auth.resendCode, { method: 'POST', body: { challengeId }, schema: ChallengeSchema }),

    async verificarCodigo(challengeId, codigoProtegido) {
      const res = await http(endpoints.auth.verifyCode, { method: 'POST', body: { challengeId, code: codigoProtegido }, schema: VerifySchema });
      return res.registrationToken;
    },

    async crearCuenta(registrationToken, cuenta) {
      const { passwordProtegida, ...rest } = cuenta;
      await http(endpoints.auth.complete, {
        method: 'POST',
        body: { registrationToken, ...rest, password: passwordProtegida },
        schema: CreateSchema,
      });
    },
  };
}
