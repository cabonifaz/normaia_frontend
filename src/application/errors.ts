export type AppErrorKind =
  | 'network'
  | 'timeout'
  | 'aborted'
  | 'unauthorized'
  | 'forbidden'
  | 'validation'
  | 'conflict'
  | 'rate_limited'
  | 'server'
  | 'contract';

/**
 * Error de aplicación normalizado. Los adaptadores traducen sus fallos a este tipo.
 * El texto al usuario sale siempre de `userMessage`: nunca el mensaje crudo del servidor.
 */
export class AppError extends Error {
  override readonly name = 'AppError';
  constructor(
    readonly kind: AppErrorKind,
    readonly status: number,
    /** Correlación con logs del backend (X-Request-Id). */
    readonly requestId: string,
    /** Código de negocio opcional, validado por el adaptador contra un formato seguro. */
    readonly code: string | null = null,
    /** Segundos hasta poder reintentar (Retry-After). */
    readonly retryAfter: number | null = null,
  ) {
    super(`${kind} (${status}) req=${requestId}`);
  }
}

const GENERIC: Record<AppErrorKind, string> = {
  network: 'No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.',
  timeout: 'El servicio tardó demasiado en responder. Inténtalo de nuevo.',
  aborted: 'La operación se canceló.',
  unauthorized: 'Tu sesión terminó. Vuelve a ingresar.',
  forbidden: 'No tienes permiso para realizar esta acción.',
  validation: 'Revisa los datos ingresados.',
  conflict: 'No pudimos completar la operación. Inténtalo de nuevo.',
  rate_limited: 'Hiciste demasiados intentos. Espera un momento antes de volver a intentarlo.',
  server: 'Tuvimos un problema. Inténtalo de nuevo en unos minutos.',
  contract: 'Tuvimos un problema. Inténtalo de nuevo en unos minutos.',
};

/** Mensajes por código de negocio, válidos en cualquier pantalla. */
const BY_CODE: Partial<Record<string, string>> = {
  DOMINIO_NO_PERMITIDO: 'Este correo no pertenece a un dominio habilitado. Usa tu correo institucional o corporativo.',
  REGISTRO_EXPIRADO: 'Tu verificación de correo venció (dura 15 minutos). Vuelve a solicitar un código para continuar.',
  RECUPERACION_NO_DISPONIBLE: 'La recuperación de contraseña aún no está disponible. Comunícate con soporte para restablecer tu acceso.',
};

export function userMessage(err: unknown, overrides: Partial<Record<string, string>> = {}): string {
  if (err instanceof AppError) {
    const byCode = err.code ? (overrides[err.code] ?? BY_CODE[err.code]) : undefined;
    return byCode ?? overrides[err.kind] ?? GENERIC[err.kind];
  }
  return GENERIC.server;
}

export function kindFromStatus(status: number): AppErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 400 || status === 422) return 'validation';
  if (status === 409) return 'conflict';
  if (status === 429) return 'rate_limited';
  return 'server';
}
