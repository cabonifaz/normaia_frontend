/**
 * CSRF double-submit: el backend emite una cookie legible (no HttpOnly) `XSRF-TOKEN`
 * y valida que la cabecera `X-XSRF-TOKEN` coincida. Complementa SameSite=Strict.
 */
export const CSRF_COOKIE = 'XSRF-TOKEN';
export const CSRF_HEADER = 'X-XSRF-TOKEN';

export function readCsrfToken(cookieSource: string = document.cookie): string | null {
  for (const part of cookieSource.split(';')) {
    const [rawName, ...rest] = part.trim().split('=');
    if (rawName === CSRF_COOKIE) {
      const value = decodeURIComponent(rest.join('='));
      return /^[A-Za-z0-9._~+/=-]{16,512}$/.test(value) ? value : null;
    }
  }
  return null;
}
