/**
 * Cabeceras HTTP de seguridad. Fuente única para `vite preview` y los E2E;
 * deploy/nginx.conf debe mantenerse alineado (lo verifica e2e/security-headers.spec.ts).
 */
/**
 * @param apiOrigin origen absoluto del API (vacío si va por el mismo origen vía reverse proxy)
 * @param attachmentsOrigin origen EXACTO del almacenamiento de adjuntos (S3). Sin comodines:
 *        *.amazonaws.com permitiría exfiltrar datos hacia cualquier bucket.
 */
export function buildCsp(apiOrigin: string, attachmentsOrigin = ''): string {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    `img-src 'self' data: blob: ${attachmentsOrigin}`.trim(),
    "font-src 'self'",
    `connect-src 'self' ${apiOrigin} ${attachmentsOrigin}`.replace(/\s+/g, ' ').trim(),
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
    "worker-src 'none'",
    "require-trusted-types-for 'script'",
    "trusted-types 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

export function securityHeaders(apiOrigin: string, attachmentsOrigin = ''): Record<string, string> {
  return {
    'Content-Security-Policy': buildCsp(apiOrigin, attachmentsOrigin),
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy':
      'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    // credentialless: permite imágenes de S3 (no envía CORP) cargándolas sin credenciales.
    // No se necesita aislamiento cross-origin (no hay SharedArrayBuffer).
    'Cross-Origin-Embedder-Policy': 'credentialless',
  };
}
