import { z } from 'zod';
import type { MaestrosRepository } from '@/application/ports/MaestrosRepository';
import type { MaestroGrupo, MaestroItem } from '@/domain/maestros/maestro';
import type { SessionStore } from '@/infrastructure/auth/sessionStore';
import { endpoints } from '@/infrastructure/config/endpoints';
import { envelope } from '@/infrastructure/http/envelope';
import type { HttpClient } from '@/infrastructure/http/httpClient';

/**
 * Maestro de maestros del backend Qamaq (GET get_param_by_id_maestro?grp_id_maestro=N).
 * Según el Swagger de crear-usuario: formación = maestro 23, institución = maestro 24, y el valor
 * a enviar es NUM1 (no ID_PARAMETRO).
 *
 * PENDIENTE de confirmar con backend:
 *  - nombre de la columna de descripción (se aceptan las variantes habituales);
 *  - que el endpoint acepte el RegistroBearer durante el registro (hoy exige JWT).
 */
const GRUPO_ID: Record<MaestroGrupo, string> = {
  FORMACION: '23',
  INSTITUCION: '24',
};

const DESCRIPCION_KEYS = ['DESCRIPCION', 'DESCRIPCION_PARAMETRO', 'NOMBRE', 'VALOR', 'TEXTO1', 'descripcion', 'nombre'] as const;

const RowSchema = z.record(z.unknown());
const ParamsSchema = envelope(z.array(RowSchema).max(2000));

function toItem(row: Record<string, unknown>): MaestroItem | null {
  const num1 = row.NUM1 ?? row.num1;
  const activo = row.ESTADO ?? row.ACTIVO ?? row.estado;
  if (activo === 0 || activo === false || activo === 'I') return null;
  const descripcion = DESCRIPCION_KEYS.map((k) => row[k]).find((v): v is string => typeof v === 'string' && v.trim().length > 0);
  if ((typeof num1 !== 'number' && typeof num1 !== 'string') || !descripcion) return null;
  const codigo = String(num1);
  if (!/^\d{1,9}$/.test(codigo)) return null;
  const orden = typeof row.ORDEN === 'number' ? row.ORDEN : undefined;
  return { codigo, descripcion: descripcion.trim().slice(0, 200), ...(orden === undefined ? {} : { orden }) };
}

export function createMaestrosRestRepository(http: HttpClient, session: SessionStore): MaestrosRepository {
  return {
    async obtener(grupo) {
      const { data } = await http(endpoints.parametros.porMaestro, {
        query: { grp_id_maestro: GRUPO_ID[grupo] },
        bearer: session.bearer(),
        schema: ParamsSchema,
      });
      return data.map(toItem).filter((i): i is MaestroItem => i !== null);
    },
  };
}
