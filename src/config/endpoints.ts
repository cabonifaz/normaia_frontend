/**
 * Catálogo único de endpoints REST.
 * PENDIENTE: reemplazar por los contratos reales del backend RAG.
 */
export const endpoints = {
  auth: {
    /** Solicita el código OTP de 4 dígitos para el correo. Respuesta idéntica exista o no el correo (anti-enumeración). */
    requestCode: '/auth/register/code',
    /** Reenvía el código. El rate-limit real lo aplica el backend. */
    resendCode: '/auth/register/code/resend',
    /** Verifica el código y devuelve un token de registro de un solo uso y corta vida. */
    verifyCode: '/auth/register/verify',
    /** Crea la cuenta e inicia sesión (Set-Cookie HttpOnly; Secure; SameSite=Strict). */
    complete: '/auth/register/complete',
    session: '/auth/session',
    logout: '/auth/logout',
  },
  maestros: {
    /** Maestro de maestros: opciones de combos por grupo. */
    byGrupo: (grupo: string) => `/maestros/${encodeURIComponent(grupo)}`,
  },
} as const;
