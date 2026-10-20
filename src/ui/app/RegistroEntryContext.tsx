import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react';
import type { Challenge } from '@/domain/registro/registro';

export interface RegistroEntry {
  email: string;
  challenge: Challenge;
}

interface RegistroEntryStore {
  put(entry: RegistroEntry): void;
  peek(): RegistroEntry | null;
  clear(): void;
}

const Ctx = createContext<RegistroEntryStore | null>(null);

/**
 * Traspaso en memoria del hero al registro (correo + desafío OTP).
 * Evita poner PII en la URL o en history.state.
 */
export function RegistroEntryProvider({ children }: { children: ReactNode }) {
  const ref = useRef<RegistroEntry | null>(null);
  const store = useMemo<RegistroEntryStore>(
    () => ({
      put: (e) => {
        ref.current = e;
      },
      peek: () => ref.current,
      clear: () => {
        ref.current = null;
      },
    }),
    [],
  );
  return <Ctx value={store}>{children}</Ctx>;
}

export function useRegistroEntry(): RegistroEntryStore {
  const store = useContext(Ctx);
  if (!store) throw new Error('RegistroEntryProvider no configurado.');
  return store;
}
