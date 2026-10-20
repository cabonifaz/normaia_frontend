import type { PayloadCipher } from '@/application/ports/PayloadCipher';
import { encryptToJwe } from './jwe';

export interface JweCipherConfig {
  required: boolean;
  publicKeyPem: string;
  keyId: string;
}

/**
 * Adaptador del puerto PayloadCipher: JWE RSA-OAEP-256 + A256GCM.
 * Con `required: false` (solo desarrollo local) deja pasar el valor; si falta la clave, falla cerrado.
 */
export function createJweCipher(config: JweCipherConfig): PayloadCipher {
  return {
    protect(plaintext) {
      if (!config.required) return Promise.resolve(plaintext);
      return encryptToJwe(plaintext, { pem: config.publicKeyPem, kid: config.keyId });
    },
  };
}
