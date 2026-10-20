import type { Challenge } from '@/features/auth/registerApi';

export type Step = 1 | 2 | 3 | 4;

/** Estado de navegación cuando se entra desde el hero con el código ya solicitado. */
export interface RegisterEntryState {
  email: string;
  challenge: Challenge;
}

export function isRegisterEntryState(v: unknown): v is RegisterEntryState {
  if (!v || typeof v !== 'object') return false;
  const s = v as Partial<RegisterEntryState>;
  return typeof s.email === 'string' && !!s.challenge && typeof s.challenge.challengeId === 'string' && typeof s.challenge.resendAfter === 'number';
}
