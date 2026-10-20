import type { Challenge, NuevaCuenta } from '@/domain/registro/registro';

/** Puerto de salida: operaciones de registro contra el backend. */
export interface RegistroRepository {
  /** La respuesta no debe revelar si el correo ya existe (anti-enumeración). */
  solicitarCodigo(email: string): Promise<Challenge>;
  reenviarCodigo(challengeId: string): Promise<Challenge>;
  /** `codigoProtegido` ya viene cifrado por el PayloadCipher. Devuelve el token de registro. */
  verificarCodigo(challengeId: string, codigoProtegido: string): Promise<string>;
  /** Crea la cuenta e inicia sesión (cookie HttpOnly emitida por el backend). */
  crearCuenta(registrationToken: string, cuenta: NuevaCuenta): Promise<void>;
}
