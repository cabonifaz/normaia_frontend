import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Par RSA solo para E2E. Se genera una vez y se comparte entre el proceso principal y los workers. */
const DIR = join(process.cwd(), 'node_modules', '.e2e-keys');

export function e2eKeys(): { publicPem: string; privatePem: string } {
  const pub = join(DIR, 'public.pem');
  const priv = join(DIR, 'private.pem');
  if (!existsSync(pub) || !existsSync(priv)) {
    mkdirSync(DIR, { recursive: true });
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 3072 });
    writeFileSync(pub, publicKey.export({ type: 'spki', format: 'pem' }));
    writeFileSync(priv, privateKey.export({ type: 'pkcs8', format: 'pem' }));
  }
  return { publicPem: readFileSync(pub, 'utf8'), privatePem: readFileSync(priv, 'utf8') };
}

export const E2E_API = 'https://api.normaia.test/api/v1';
/** Bucket simulado de adjuntos (presigned PUT + imágenes del historial). */
export const E2E_ATTACHMENTS = 'https://norma-adjuntos.s3.us-east-1.amazonaws.com';
export const E2E_KID = 'e2e-2026-10';
