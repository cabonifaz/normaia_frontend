import { useCallback, useEffect, useState } from 'react';

/** Cuenta regresiva en segundos. Es solo UX: el rate-limit real lo aplica el backend. */
export function useCountdown() {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setTimeout(() => setRemaining((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining]);

  const start = useCallback((seconds: number) => setRemaining(Math.max(0, Math.floor(seconds))), []);
  const stop = useCallback(() => setRemaining(0), []);

  return { remaining, start, stop };
}
