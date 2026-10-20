import { describe, expect, it } from 'vitest';
import { fromBase64Url, toBase64Url } from './base64url';
import { encryptToJwe, resetKeyCache } from './payloadCrypto';

async function keyPair(bits = 3072) {
  const kp = await crypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: bits, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['encrypt', 'decrypt'],
  );
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', kp.publicKey));
  const pem = `-----BEGIN PUBLIC KEY-----\n${btoa(String.fromCharCode(...spki))}\n-----END PUBLIC KEY-----`;
  return { pem, privateKey: kp.privateKey };
}

/** Descifrado de referencia, como lo haría el backend. */
async function decryptJwe(jwe: string, privateKey: CryptoKey) {
  const [h, ek, iv, ct, tag] = jwe.split('.') as [string, string, string, string, string];
  const rawCek = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, fromBase64Url(ek));
  const cek = await crypto.subtle.importKey('raw', rawCek, 'AES-GCM', false, ['decrypt']);
  const sealed = new Uint8Array([...fromBase64Url(ct), ...fromBase64Url(tag)]);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64Url(iv), additionalData: new TextEncoder().encode(h), tagLength: 128 }, cek, sealed);
  return { header: JSON.parse(new TextDecoder().decode(fromBase64Url(h))) as Record<string, string>, plaintext: new TextDecoder().decode(pt) };
}

describe('encryptToJwe', () => {
  it('produce un JWE compacto RSA-OAEP-256/A256GCM descifrable por el backend', async () => {
    resetKeyCache();
    const { pem, privateKey } = await keyPair();
    const jwe = await encryptToJwe('Secreta#2026ñ', { pem, kid: 'k1' });

    expect(jwe.split('.')).toHaveLength(5);
    expect(jwe).not.toContain('Secreta');
    const { header, plaintext } = await decryptJwe(jwe, privateKey);
    expect(header).toEqual({ alg: 'RSA-OAEP-256', enc: 'A256GCM', kid: 'k1', cty: 'text/plain' });
    expect(plaintext).toBe('Secreta#2026ñ');
  });

  it('usa CEK e IV distintos en cada cifrado', async () => {
    resetKeyCache();
    const { pem } = await keyPair();
    const a = (await encryptToJwe('x', { pem, kid: 'k2' })).split('.');
    const b = (await encryptToJwe('x', { pem, kid: 'k2' })).split('.');
    expect(a[1]).not.toBe(b[1]);
    expect(a[2]).not.toBe(b[2]);
  });

  it('detecta manipulación del header (AAD)', async () => {
    resetKeyCache();
    const { pem, privateKey } = await keyPair();
    const parts = (await encryptToJwe('x', { pem, kid: 'k3' })).split('.');
    parts[0] = toBase64Url(new TextEncoder().encode(JSON.stringify({ alg: 'RSA-OAEP-256', enc: 'A256GCM', kid: 'evil' })));
    await expect(decryptJwe(parts.join('.'), privateKey)).rejects.toThrow();
  });

  it('rechaza claves RSA menores a 3072 bits', async () => {
    resetKeyCache();
    const { pem } = await keyPair(2048);
    await expect(encryptToJwe('x', { pem, kid: 'weak' })).rejects.toThrow(/3072/);
  });

  it('rechaza PEM con formato inválido', async () => {
    resetKeyCache();
    await expect(encryptToJwe('x', { pem: '-----BEGIN PUBLIC KEY-----\n<script>\n-----END PUBLIC KEY-----', kid: 'bad' })).rejects.toThrow();
  });
});
