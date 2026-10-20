/** Maestro de maestros: toda opción de combo/radio/checkbox viene del backend. */
export const MAESTRO = {
  FORMACION: 'FORMACION',
  INSTITUCION: 'INSTITUCION',
} as const;
export type MaestroGrupo = (typeof MAESTRO)[keyof typeof MAESTRO];

export interface MaestroItem {
  codigo: string;
  descripcion: string;
  orden?: number;
}

export function ordenarMaestro(items: readonly MaestroItem[]): MaestroItem[] {
  return [...items].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
}

export function codigosPermitidos(items: readonly MaestroItem[]): ReadonlySet<string> {
  return new Set(items.map((i) => i.codigo));
}
