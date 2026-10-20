import { z } from 'zod';

/**
 * Configuración de entorno validada al arrancar (fail-fast).
 * Todo lo que viene de import.meta.env termina en el bundle: aquí NO hay secretos.
 */
const EnvSchema = z
  .object({
    // Absoluta (https://api…) o relativa al mismo origen (/api/v1, detrás de reverse proxy: sin CORS).
    VITE_API_BASE_URL: z.string().refine((v) => /^\/[A-Za-z0-9/_-]*$/.test(v) || z.string().url().safeParse(v).success, 'URL o ruta relativa inválida'),
    /** secret_key de empresa que exige /auth/login. */
    VITE_COMPANY_REF: z.string().max(256).optional().default(''),
    VITE_PAYLOAD_ENCRYPTION: z.enum(['required', 'off']).default('required'),
    VITE_PAYLOAD_PUBLIC_KEY: z.string().optional().default(''),
    VITE_PAYLOAD_KEY_ID: z.string().optional().default(''),
    VITE_HTTP_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(15000),
    VITE_USE_MOCKS: z.enum(['true', 'false']).default('false'),
    PROD: z.boolean(),
  })
  .superRefine((env, ctx) => {
    if (env.PROD && env.VITE_USE_MOCKS === 'true') {
      ctx.addIssue({ code: 'custom', path: ['VITE_USE_MOCKS'], message: 'Los adaptadores mock solo se permiten en desarrollo.' });
    }
    if (env.PROD && !env.VITE_API_BASE_URL.startsWith('https://') && !env.VITE_API_BASE_URL.startsWith('/')) {
      ctx.addIssue({ code: 'custom', path: ['VITE_API_BASE_URL'], message: 'En producción el API debe servirse por HTTPS.' });
    }
    if (env.PROD && env.VITE_PAYLOAD_ENCRYPTION !== 'required') {
      ctx.addIssue({ code: 'custom', path: ['VITE_PAYLOAD_ENCRYPTION'], message: 'En producción el cifrado de campos sensibles es obligatorio.' });
    }
    if (env.VITE_PAYLOAD_ENCRYPTION === 'required' && (!env.VITE_PAYLOAD_PUBLIC_KEY || !env.VITE_PAYLOAD_KEY_ID)) {
      ctx.addIssue({ code: 'custom', path: ['VITE_PAYLOAD_PUBLIC_KEY'], message: 'Cifrado requerido sin clave pública o kid.' });
    }
  });

function load() {
  const parsed = EnvSchema.safeParse(import.meta.env);
  if (!parsed.success) {
    // Sin valores en el mensaje: solo qué variable falla.
    const detail = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Configuración inválida. ${detail}`);
  }
  const e = parsed.data;
  return Object.freeze({
    apiBaseUrl: e.VITE_API_BASE_URL.replace(/\/+$/, ''),
    encryption: Object.freeze({
      required: e.VITE_PAYLOAD_ENCRYPTION === 'required',
      // .env guarda el PEM en una línea con "\n" escapados
      publicKeyPem: e.VITE_PAYLOAD_PUBLIC_KEY.replace(/\\n/g, '\n'),
      keyId: e.VITE_PAYLOAD_KEY_ID,
    }),
    httpTimeoutMs: e.VITE_HTTP_TIMEOUT_MS,
    useMocks: e.VITE_USE_MOCKS === 'true',
    companyRef: e.VITE_COMPANY_REF,
  });
}

export const env = load();
