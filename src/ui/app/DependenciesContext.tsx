import { createContext, useContext, type ReactNode } from 'react';
import type { AppDependencies } from '@/application/AppDependencies';

const DependenciesContext = createContext<AppDependencies | null>(null);

/** Inyección de casos de uso en la UI. En tests se inyectan fakes de los puertos. */
export function DependenciesProvider({ value, children }: { value: AppDependencies; children: ReactNode }) {
  return <DependenciesContext value={value}>{children}</DependenciesContext>;
}

export function useDependencies(): AppDependencies {
  const deps = useContext(DependenciesContext);
  if (!deps) throw new Error('DependenciesProvider no configurado.');
  return deps;
}
