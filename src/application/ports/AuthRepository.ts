import type { Challenge } from '@/domain/registro/registro';

/** Puerto de salida: ingreso y recuperación de contraseña. Los secretos llegan ya protegidos. */
export interface AuthRepository {
  /** El backend emite la cookie de sesión HttpOnly. Credenciales inválidas → AppError (sin distinguir si el correo existe). */
  iniciarSesion(email: string, passwordProtegida: string): Promise<void>;
  /** Respuesta idéntica exista o no la cuenta (anti-enumeración). */
  solicitarRecuperacion(email: string): Promise<Challenge>;
  reenviarRecuperacion(challengeId: string): Promise<Challenge>;
  restablecerPassword(challengeId: string, codigoProtegido: string, passwordProtegida: string): Promise<void>;
  /** Hay una sesión de login vigente en este cliente (no implica validez en servidor). */
  haySesion(): boolean;
}
