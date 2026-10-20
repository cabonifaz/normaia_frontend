/** Puerto de salida: protección de valores sensibles antes de que salgan del cliente. */
export interface PayloadCipher {
  protect(plaintext: string): Promise<string>;
}
