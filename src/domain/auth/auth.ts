import { codeSchema, isEmail, MSG as REG_MSG, passwordOk } from '@/domain/registro/registro';

/** Reglas de ingreso y recuperación de contraseña. TypeScript puro. */
export const AUTH_MSG = {
  email: REG_MSG.email,
  passwordRequired: 'Escribe tu contraseña.',
  code: REG_MSG.code,
  password: REG_MSG.password,
  passwordMatch: REG_MSG.passwordMatch,
} as const;

export interface LoginInput {
  email: string;
  password: string;
}

export type LoginField = keyof LoginInput;

export function validateLogin(v: LoginInput): Partial<Record<LoginField, string>> {
  const errors: Partial<Record<LoginField, string>> = {};
  if (!isEmail(v.email)) errors.email = AUTH_MSG.email;
  // En el ingreso no se aplican reglas de complejidad: solo presencia y un tope defensivo.
  if (!v.password || v.password.length > 128) errors.password = AUTH_MSG.passwordRequired;
  return errors;
}

export interface ResetInput {
  digits: string[];
  password: string;
  password2: string;
}

export type ResetField = keyof ResetInput;

export function validateReset(v: ResetInput): Partial<Record<ResetField, string>> {
  const errors: Partial<Record<ResetField, string>> = {};
  if (!codeSchema.safeParse(v.digits.join('')).success) errors.digits = AUTH_MSG.code;
  if (!passwordOk(v.password)) errors.password = AUTH_MSG.password;
  if (!v.password || v.password !== v.password2) errors.password2 = AUTH_MSG.passwordMatch;
  return errors;
}

/** Motivos por los que se llega al ingreso. Lista cerrada: nunca se refleja texto de la URL. */
export const LOGIN_MOTIVOS = ['sesion-expirada', 'clave-actualizada', 'sesion-cerrada'] as const;
export type LoginMotivo = (typeof LOGIN_MOTIVOS)[number];

export function parseLoginMotivo(v: unknown): LoginMotivo | undefined {
  return typeof v === 'string' && (LOGIN_MOTIVOS as readonly string[]).includes(v) ? (v as LoginMotivo) : undefined;
}
