import { z } from 'zod';
import { AppError } from '@/application/errors';
import type { RegistroRepository } from '@/application/ports/RegistroRepository';
import type { SessionStore } from '@/infrastructure/auth/sessionStore';
import { endpoints } from '@/infrastructure/config/endpoints';
import { AnyEnvelope, envelope } from '@/infrastructure/http/envelope';
import type { HttpClient } from '@/infrastructure/http/httpClient';

/**
 * Adaptador del registro contra el backend Qamaq.
 *
 * Diferencias del contrato real respecto al puerto:
 *  - No hay "challengeId": el backend identifica el desafío por el correo → challengeId = correo normalizado.
 *  - No hay endpoint de reenvío: reenviar = volver a llamar accion=REGISTRAR.
 *  - El backend no informa el tiempo de espera para reenviar: se usa 30 s (prototipo).
 *  - El backend espera `codigo` y `clave` en claro (sin JWE): el PayloadCipher debe estar en modo "off".
 */
const RESEND_AFTER = 30;

const DominioSchema = envelope(z.object({ dominio: z.string().max(253).optional(), esValido: z.boolean() }));

/** PENDIENTE de confirmar con backend: nombre del campo del RegistroBearer en la respuesta de VALIDAR. */
function extractRegistrationToken(body: z.infer<typeof AnyEnvelope>): string {
  const data = (body.data ?? {}) as Record<string, unknown>;
  const candidates = [data.token, data.tokenRegistro, data.registroToken, data.access_token, (body as Record<string, unknown>).token];
  const token = candidates.find((c): c is string => typeof c === 'string' && c.length > 0);
  if (!token) throw new AppError('contract', 200, 'local');
  return token;
}

export function createRegistroRestRepository(http: HttpClient, session: SessionStore): RegistroRepository {
  const enviarCodigo = async (correo: string) => {
    await http(endpoints.auth.verificacionCodigo, { method: 'POST', body: { correo, accion: 'REGISTRAR' }, schema: AnyEnvelope, notifyUnauthorized: false });
    return { challengeId: correo, resendAfter: RESEND_AFTER };
  };

  return {
    async solicitarCodigo(correo) {
      const { data } = await http(endpoints.auth.validarCorreo, { method: 'POST', body: { correo }, schema: DominioSchema, notifyUnauthorized: false });
      if (!data.esValido) throw new AppError('validation', 200, 'local', 'DOMINIO_NO_PERMITIDO');
      return enviarCodigo(correo);
    },

    reenviarCodigo: (correo) => enviarCodigo(correo),

    async verificarCodigo(correo, codigo) {
      const body = await http(endpoints.auth.verificacionCodigo, {
        method: 'POST',
        body: { correo, accion: 'VALIDAR', codigo },
        schema: AnyEnvelope,
        notifyUnauthorized: false,
      });
      const token = extractRegistrationToken(body);
      // Disponible para los maestros del paso 3 (requieren Bearer y aún no hay sesión).
      session.setRegistration(token);
      return token;
    },

    async crearCuenta(registrationToken, cuenta) {
      const idFormacion = Number(cuenta.formacion);
      const idInstitucionEstudios = Number(cuenta.institucion);
      if (!Number.isInteger(idFormacion) || !Number.isInteger(idInstitucionEstudios)) throw new AppError('validation', 0, 'local');
      await http(endpoints.auth.crearUsuario, {
        method: 'POST',
        bearer: registrationToken,
        notifyUnauthorized: false,
        schema: AnyEnvelope,
        body: {
          nombres: cuenta.nombres,
          apellidos: cuenta.apellidos,
          idFormacion,
          fechaNacimiento: cuenta.fechaNacimiento,
          idInstitucionEstudios,
          clave: cuenta.passwordProtegida,
          confirmacionClave: cuenta.passwordProtegida,
          aceptaTerminos: cuenta.aceptaTerminos,
        },
      });
      session.setRegistration(null); // el token de registro es de un solo uso
    },
  };
}
