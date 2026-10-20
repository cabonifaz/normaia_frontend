import { z } from 'zod';

/**
 * Envoltorio estándar del backend Qamaq:
 *   éxito  → { data, result: { idTipoMensaje, mensaje } }
 *   error  → { error: { result: { idTipoMensaje, mensaje } }, status_code }
 * `mensaje` es texto del servidor: se valida pero NUNCA se muestra al usuario.
 */
const ResultSchema = z.object({ idTipoMensaje: z.number().int(), mensaje: z.string().max(1000) }).passthrough();

export function envelope<T extends z.ZodTypeAny>(data: T) {
  return z.object({ data, result: ResultSchema.optional() }).passthrough();
}

/** Para respuestas cuyo `data` aún no está documentado en el Swagger. */
export const AnyEnvelope = z.object({ data: z.unknown().optional(), result: ResultSchema.optional() }).passthrough();
