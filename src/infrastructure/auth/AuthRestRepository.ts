import { z } from 'zod';
import { AppError } from '@/application/errors';
import type { AuthRepository } from '@/application/ports/AuthRepository';
import { endpoints } from '@/infrastructure/config/endpoints';
import type { HttpClient } from '@/infrastructure/http/httpClient';
import type { SessionStore } from './sessionStore';

/**
 * Ingreso contra el backend Qamaq: POST /auth/login { usuario, clave_acceso, ref } → { token }.
 *
 *  - `ref` es la secret_key de la empresa (multi-tenant). Norma IA no muestra selector de empresa:
 *    se toma de configuración (VITE_COMPANY_REF). Ver README: un valor en el bundle NO es secreto.
 *  - El JWT llega en el cuerpo y se guarda solo en memoria (SessionStore).
 *  - Recuperación de contraseña: el backend aún no expone endpoints → falla cerrado.
 */
const LoginSchema = z.object({ token: z.string().min(1).max(8192), status: z.string().optional() }).passthrough();

const notAvailable = () => Promise.reject(new AppError('server', 501, 'local', 'RECUPERACION_NO_DISPONIBLE'));

export function createAuthRestRepository(http: HttpClient, session: SessionStore, config: { companyRef: string }): AuthRepository {
  return {
    async iniciarSesion(email, passwordProtegida) {
      const { token } = await http(endpoints.auth.login, {
        method: 'POST',
        body: { usuario: email, clave_acceso: passwordProtegida, ref: config.companyRef },
        schema: LoginSchema,
        notifyUnauthorized: false,
      });
      session.setSession(token);
    },
    solicitarRecuperacion: notAvailable,
    reenviarRecuperacion: notAvailable,
    restablecerPassword: notAvailable,
  };
}
