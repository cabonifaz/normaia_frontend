import type { MaestrosRepository } from '@/application/ports/MaestrosRepository';
import { ordenarMaestro, type MaestroGrupo, type MaestroItem } from '@/domain/maestros/maestro';

export interface MaestrosUseCases {
  obtener(grupo: MaestroGrupo): Promise<MaestroItem[]>;
}

export function createMaestrosUseCases(deps: { repo: MaestrosRepository }): MaestrosUseCases {
  return {
    async obtener(grupo) {
      return ordenarMaestro(await deps.repo.obtener(grupo));
    },
  };
}
