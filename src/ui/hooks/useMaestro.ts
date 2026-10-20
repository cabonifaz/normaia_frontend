import { useQuery } from '@tanstack/react-query';
import type { MaestroGrupo } from '@/domain/maestros/maestro';
import { useDependencies } from '@/ui/app/DependenciesContext';

export const maestroKey = (grupo: MaestroGrupo) => ['maestros', grupo] as const;

/** Los maestros cambian poco: caché larga en memoria, compartida entre pantallas. */
export function useMaestro(grupo: MaestroGrupo) {
  const { maestros } = useDependencies();
  return useQuery({
    queryKey: maestroKey(grupo),
    queryFn: () => maestros.obtener(grupo),
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
  });
}
