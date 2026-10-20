import type { MaestroGrupo, MaestroItem } from '@/domain/maestros/maestro';

/** Puerto de salida: maestro de maestros. */
export interface MaestrosRepository {
  obtener(grupo: MaestroGrupo): Promise<MaestroItem[]>;
}
