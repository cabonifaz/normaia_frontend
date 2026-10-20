import { toBase64Url } from './base64url';

/**
 * Cifrado de campos sensibles en cliente como JWE compacto (RFC 7516):
 *   alg = RSA-OAEP-256, enc = A256GCM.
 * Interoperable con nimbus-jose-jwt, jose (Node), python-jose, Microsoft.IdentityModel.
 *
 * Es defensa en profundidad sobre TLS: protege el valor frente a terminaciones TLS
 * intermedias (WAF, balanceadores, APM) y logs de request body. No sustituye a TLS
 * ni al hash en servidor (Argon2id). La clave privada solo existe en el backend.
 */

const ENC = 'A256GCM';
const ALG = 'RSA-OAEP-256';
const encoder = new TextEncoder();

export interface PublicKeyRef {
  pem: string;
  kid: string;
}

const keyCache = new Map<string, Promise<CryptoKey>>();

function pemToSpki(pem: string): Uint8Array<ArrayBuffer> {
  const body = pem.replace(/-----(BEGIN|END) PUBLIC KEY-----/g, '').replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]+=*$/.test(body)) throw new Error('Clave pública con formato inválido.');
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function importKey(ref: PublicKeyRef): Promise<CryptoKey> {
  let p = keyCache.get(ref.kid);
  if (!p) {
    p = crypto.subtle.importKey('spki', pemToSpki(ref.pem), { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
    keyCache.set(ref.kid, p);
    p.catch(() => keyCache.delete(ref.kid));
  }
  return p;
}

export async function encryptToJwe(plaintext: string, ref: PublicKeyRef): Promise<string> {
  const rsaKey = await importKey(ref);
  const algo = rsaKey.algorithm as RsaHashedKeyAlgorithm;
  if (algo.modulusLength < 3072) throw new Error('La clave pública debe ser RSA de al menos 3072 bits.');

  const header = toBase64Url(encoder.encode(JSON.stringify({ alg: ALG, enc: ENC, kid: ref.kid, cty: 'text/plain' })));

  // CEK efímera de un solo uso, extraíble solo para envolverla.
  const cek = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
  const rawCek = new Uint8Array(await crypto.subtle.exportKey('raw', cek));
  try {
    const encryptedKey = new Uint8Array(await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, rsaKey, rawCek));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const sealed = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: encoder.encode(header), tagLength: 128 },
        cek,
        encoder.encode(plaintext),
      ),
    );
    const ciphertext = sealed.subarray(0, sealed.length - 16);
    const tag = sealed.subarray(sealed.length - 16);
    return [header, toBase64Url(encryptedKey), toBase64Url(iv), toBase64Url(ciphertext), toBase64Url(tag)].join('.');
  } finally {
    rawCek.fill(0);
  }
}

/** Limpia la caché de claves (rotación de kid). */
export function resetKeyCache(): void {
  keyCache.clear();
}
