export type ApiErrorKind =
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
 * Error normalizado. `userMessage` es siempre un texto propio del front:
 * nunca se muestra el mensaje crudo del servidor (evita fuga de detalles internos).
 */
export class ApiError extends Error {
  override readonly name = 'ApiError';
  constructor(
    readonly kind: ApiErrorKind,
    readonly status: number,
    readonly requestId: string,
    /** Código de negocio opcional del backend, validado contra lista blanca. */
    readonly code: string | null = null,
    /** Segundos hasta poder reintentar (Retry-After). */
    readonly retryAfter: number | null = null,
  ) {
    super(`${kind} (${status}) req=${requestId}`);
  }
}

const GENERIC: Record<ApiErrorKind, string> = {
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

export function userMessage(err: unknown, overrides: Partial<Record<string, string>> = {}): string {
  if (err instanceof ApiError) {
    const byCode = err.code ? overrides[err.code] : undefined;
    return byCode ?? overrides[err.kind] ?? GENERIC[err.kind];
  }
  return GENERIC.server;
}

export function kindFromStatus(status: number): ApiErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 400 || status === 422) return 'validation';
  if (status === 409) return 'conflict';
  if (status === 429) return 'rate_limited';
  return 'server';
}
