import { z } from 'zod';
import type { MaestrosRepository } from '@/application/ports/MaestrosRepository';
import type { MaestroGrupo, MaestroItem } from '@/domain/maestros/maestro';
import type { SessionStore } from '@/infrastructure/auth/sessionStore';
import { endpoints } from '@/infrastructure/config/endpoints';
import { envelope } from '@/infrastructure/http/envelope';
import type { HttpClient } from '@/infrastructure/http/httpClient';

/**
 * Maestro de maestros del backend Qamaq: GET get_param_by_id_maestro?grp_id_maestro=N.
 * Contrato verificado contra el backend (2026-10-20):
 *   { data: [{ ID_PARAMETRO, ID_MAESTRO, NUM1, NUM2, NUM3, STRING1, STRING2, STRING3 }], result }
 * Formación = maestro 23, institución = maestro 24. crear-usuario espera NUM1 (no ID_PARAMETRO);
 * la descripción visible es STRING1.
 */
const GRUPO_ID: Record<MaestroGrupo, string> = {
  FORMACION: '23',
  INSTITUCION: '24',
};

const RowSchema = z
  .object({
    NUM1: z.number().int().min(0).max(999_999_999),
    STRING1: z.string().trim().min(1).max(200),
  })
  .passthrough();
const ParamsSchema = envelope(z.array(RowSchema).max(2000));

export function createMaestrosRestRepository(http: HttpClient, session: SessionStore): MaestrosRepository {
  return {
    async obtener(grupo) {
      const { data } = await http(endpoints.parametros.porMaestro, {
        query: { grp_id_maestro: GRUPO_ID[grupo] },
        // Hoy es público; si el backend vuelve a exigir Bearer, se envía el disponible.
        bearer: session.bearer(),
        schema: ParamsSchema,
      });
      // El orden de la respuesta se respeta (orden explícito por posición).
      return data.map((r, i): MaestroItem => ({ codigo: String(r.NUM1), descripcion: r.STRING1, orden: i }));
    },
  };
}
