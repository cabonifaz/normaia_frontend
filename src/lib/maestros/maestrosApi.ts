import { z } from 'zod';
import { endpoints } from '@/config/endpoints';
import { request } from '@/lib/http/httpClient';

/**
 * Maestro de maestros: toda opción de combo/radio/checkbox viene del backend.
 * PENDIENTE: ajustar al contrato real (ruta, nombres de campos, códigos de grupo).
 */
export const MAESTRO = {
  FORMACION: 'FORMACION',
  INSTITUCION: 'INSTITUCION',
} as const;
export type MaestroGrupo = (typeof MAESTRO)[keyof typeof MAESTRO];

const ItemSchema = z.object({
  codigo: z.string().min(1).max(64).regex(/^[A-Za-z0-9_.-]+$/),
  descripcion: z.string().min(1).max(200),
  orden: z.number().int().optional(),
});
export type MaestroItem = z.infer<typeof ItemSchema>;

const MaestroSchema = z.object({ items: z.array(ItemSchema).max(1000) });

const cache = new Map<MaestroGrupo, Promise<MaestroItem[]>>();

export function getMaestro(grupo: MaestroGrupo): Promise<MaestroItem[]> {
  let p = cache.get(grupo);
  if (!p) {
    p = request(endpoints.maestros.byGrupo(grupo), { schema: MaestroSchema }).then(({ items }) =>
      [...items].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)),
    );
    cache.set(grupo, p);
    p.catch(() => cache.delete(grupo)); // permitir reintento
  }
  return p;
}

export function clearMaestrosCache(): void {
  cache.clear();
}
