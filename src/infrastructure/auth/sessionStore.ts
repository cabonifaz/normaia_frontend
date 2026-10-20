/**
 * Credenciales Bearer SOLO en memoria (nunca localStorage/sessionStorage: un XSS no puede leerlas
 * tras una recarga y no quedan en disco). Consecuencia aceptada: recargar la página pide ingresar de nuevo.
 *
 * El backend actual devuelve el JWT en el cuerpo. Recomendación al backend: emitirlo como cookie
 * HttpOnly; Secure; SameSite=Strict y eliminar este almacén.
 */
export interface SessionStore {
  /** JWT de sesión (login). */
  session(): string | null;
  /** Token temporal de registro (RegistroBearer), válido solo para crear la cuenta. */
  registration(): string | null;
  /** El token más fuerte disponible para endpoints con HTTPBearer. */
  bearer(): string | null;
  setSession(token: string): void;
  setRegistration(token: string | null): void;
  clear(): void;
}

const JWT_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/;

export function createSessionStore(): SessionStore {
  let session: string | null = null;
  let registration: string | null = null;
  const check = (t: string) => {
    if (t.length > 8192 || !JWT_RE.test(t)) throw new Error('Token con formato inválido.');
    return t;
  };
  return {
    session: () => session,
    registration: () => registration,
    bearer: () => session ?? registration,
    setSession: (t) => {
      session = check(t);
      registration = null;
    },
    setRegistration: (t) => {
      registration = t === null ? null : check(t);
    },
    clear: () => {
      session = null;
      registration = null;
    },
  };
}
