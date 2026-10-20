import { z } from 'zod';
import { endpoints } from '@/config/endpoints';
import { request } from '@/lib/http/httpClient';
import { protectSensitive } from '@/lib/security/sensitive';

/**
 * PENDIENTE: ajustar request/response a los contratos reales del backend.
 * Los esquemas zod son el contrato: si el backend responde distinto, se rechaza.
 */

const ChallengeSchema = z.object({
  /** Identificador opaco del desafío OTP. */
  challengeId: z.string().min(16).max(256),
  /** Segundos hasta poder pedir otro código. */
  resendAfter: z.number().int().min(0).max(3600).default(30),
});
export type Challenge = z.infer<typeof ChallengeSchema>;

const VerifySchema = z.object({
  /** Token de registro de un solo uso y vida corta. Solo en memoria. */
  registrationToken: z.string().min(16).max(4096),
});

const CompleteSchema = z.object({ userId: z.string().min(1).max(128) }).passthrough();

export function requestCode(email: string, signal?: AbortSignal): Promise<Challenge> {
  return request(endpoints.auth.requestCode, { method: 'POST', body: { email }, schema: ChallengeSchema, ...(signal ? { signal } : {}) });
}

export function resendCode(challengeId: string): Promise<Challenge> {
  return request(endpoints.auth.resendCode, { method: 'POST', body: { challengeId }, schema: ChallengeSchema });
}

export async function verifyCode(challengeId: string, code: string): Promise<string> {
  const res = await request(endpoints.auth.verifyCode, {
    method: 'POST',
    body: { challengeId, code: await protectSensitive(code) },
    schema: VerifySchema,
  });
  return res.registrationToken;
}

export interface ProfilePayload {
  nombres: string;
  apellidos: string;
  formacion: string;
  fechaNacimiento: string;
  institucion: string;
  password: string;
  aceptaTerminos: true;
}

export async function completeRegistration(registrationToken: string, profile: ProfilePayload) {
  const { password, ...rest } = profile;
  return request(endpoints.auth.complete, {
    method: 'POST',
    body: { registrationToken, ...rest, password: await protectSensitive(password) },
    schema: CompleteSchema,
  });
}
