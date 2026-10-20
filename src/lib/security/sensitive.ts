import { env } from '@/config/env';
import { encryptToJwe } from './payloadCrypto';

/**
 * Prepara un valor sensible para viajar al backend.
 * Con cifrado requerido devuelve un JWE; si falta la clave, falla cerrado.
 */
export async function protectSensitive(value: string): Promise<string> {
  if (!env.encryption.required) return value;
  return encryptToJwe(value, { pem: env.encryption.publicKeyPem, kid: env.encryption.keyId });
}
