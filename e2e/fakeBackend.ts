import { constants, createDecipheriv, createPrivateKey, privateDecrypt } from 'node:crypto';
import type { Page, Route } from '@playwright/test';
import { E2E_API, e2eKeys } from './keys';

/** Descifra un JWE compacto RSA-OAEP-256/A256GCM, como lo haría el backend. */
export function decryptJwe(jwe: string): { header: Record<string, string>; plaintext: string } {
  const [h, ek, iv, ct, tag] = jwe.split('.') as [string, string, string, string, string];
  const key = createPrivateKey(e2eKeys().privatePem);
  const cek = privateDecrypt({ key, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(ek, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', cek, Buffer.from(iv, 'base64url'));
  decipher.setAAD(Buffer.from(h, 'ascii'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ct, 'base64url')), decipher.final()]).toString('utf8');
  return { header: JSON.parse(Buffer.from(h, 'base64url').toString('utf8')) as Record<string, string>, plaintext };
}

export interface Captured {
  path: string;
  method: string;
  headers: Record<string, string>;
  body: Record<string, unknown> | null;
}

interface Options {
  validCode?: string;
  resendAfter?: number;
  failMaestros?: boolean;
}

/** Backend simulado con CORS estricto (origen exacto + credenciales), como el real. */
export async function fakeBackend(page: Page, opts: Options = {}) {
  const validCode = opts.validCode ?? '1234';
  const captured: Captured[] = [];
  const origin = 'http://localhost:4173';
  const cors = {
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': 'content-type, x-request-id, idempotency-key, x-xsrf-token',
    'access-control-allow-methods': 'GET, POST',
    'cross-origin-resource-policy': 'cross-origin',
    vary: 'Origin',
  };
  const json = (route: Route, status: number, body: unknown) =>
    route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });

  await page.route(`${E2E_API}/**`, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const path = new URL(req.url()).pathname.replace('/api/v1', '');
    const body = req.postData() ? (JSON.parse(req.postData()!) as Record<string, unknown>) : null;
    captured.push({ path, method: req.method(), headers: await req.allHeaders(), body });

    switch (path) {
      case '/maestros/FORMACION':
        return json(route, 200, { items: [{ codigo: 'ING_CIVIL', descripcion: 'Ingeniero civil', orden: 1 }, { codigo: 'ARQ', descripcion: 'Arquitecto', orden: 2 }, { codigo: 'EST', descripcion: 'Estudiante', orden: 3 }] });
      case '/maestros/INSTITUCION':
        return opts.failMaestros
          ? json(route, 503, {})
          : json(route, 200, { items: [{ codigo: 'UNI', descripcion: 'Universidad Nacional de Ingeniería', orden: 1 }, { codigo: 'PUCP', descripcion: 'Pontificia Universidad Católica del Perú', orden: 2 }, { codigo: 'OTRA', descripcion: 'Otra institución', orden: 99 }] });
      case '/auth/register/code':
      case '/auth/register/code/resend':
        return json(route, 200, { challengeId: 'ch_e2e_0123456789abcdef', resendAfter: opts.resendAfter ?? 30 });
      case '/auth/register/verify': {
        const code = decryptJwe(String(body?.code)).plaintext;
        return code === validCode
          ? json(route, 200, { registrationToken: 'reg_e2e_0123456789abcdef' })
          : json(route, 400, { code: 'OTP_INVALID', message: 'otp mismatch for user id 42' });
      }
      case '/auth/register/complete':
        return json(route, 201, { userId: 'u_e2e' });
      default:
        return json(route, 404, {});
    }
  });
  return captured;
}
