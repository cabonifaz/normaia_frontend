import { z } from 'zod';
import type { MaestrosRepository } from '@/application/ports/MaestrosRepository';
import { endpoints } from '@/infrastructure/config/endpoints';
import type { HttpClient } from '@/infrastructure/http/httpClient';

/**
 * Adaptador REST del maestro de maestros.
 * PENDIENTE: ajustar al contrato real (ruta, nombres de campos, códigos de grupo).
 */
const MaestroSchema = z.object({
  items: z
    .array(
      z.object({
        codigo: z.string().min(1).max(64).regex(/^[A-Za-z0-9_.-]+$/),
        descripcion: z.string().min(1).max(200),
        orden: z.number().int().optional(),
      }),
    )
    .max(1000),
});

export function createMaestrosRestRepository(http: HttpClient): MaestrosRepository {
  return {
    async obtener(grupo) {
      const { items } = await http(endpoints.maestros.byGrupo(grupo), { schema: MaestroSchema });
      // exactOptionalPropertyTypes: no propagar `orden: undefined`
      return items.map(({ orden, ...i }) => (orden === undefined ? i : { ...i, orden }));
    },
  };
}
