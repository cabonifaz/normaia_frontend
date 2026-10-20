import { useCallback, useEffect, useState } from 'react';
import { getMaestro, type MaestroGrupo, type MaestroItem } from './maestrosApi';

type Result = { key: string; ok: true; items: readonly MaestroItem[] } | { key: string; ok: false };

const EMPTY: readonly MaestroItem[] = [];

export function useMaestro(grupo: MaestroGrupo) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const key = `${grupo}#${attempt}`;

  useEffect(() => {
    let alive = true;
    getMaestro(grupo).then(
      (items) => alive && setResult({ key, ok: true, items }),
      () => alive && setResult({ key, ok: false }),
    );
    return () => {
      alive = false;
    };
  }, [grupo, key]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // Un resultado de otra petición (grupo o intento anterior) cuenta como "cargando".
  if (!result || result.key !== key) return { status: 'loading' as const, items: EMPTY, retry };
  if (!result.ok) return { status: 'error' as const, items: EMPTY, retry };
  return { status: 'ready' as const, items: result.items, retry };
}
