import { z } from 'zod';

/** Mensajes y reglas tomados del prototipo de Claude Design. */
export const MSG = {
  email: 'Escribe un correo válido, por ejemplo nombre@correo.com.',
  code: 'Ingresa los 4 dígitos del código.',
  nombres: 'Escribe tus nombres.',
  apellidos: 'Escribe tus apellidos.',
  formacion: 'Elige tu formación.',
  nacimiento: 'Ingresa tu fecha de nacimiento.',
  nacimientoFutura: 'La fecha de nacimiento debe ser anterior a hoy.',
  institucion: 'Elige la institución donde estudiaste.',
  password: 'La contraseña debe tener mínimo 8 caracteres, un número y una mayúscula.',
  passwordMatch: 'Las contraseñas no coinciden.',
  terms: 'Acepta los términos y condiciones para continuar.',
} as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const emailSchema = z.string().trim().toLowerCase().max(254).regex(EMAIL_RE, MSG.email);
export const isEmail = (v: string) => emailSchema.safeParse(v).success;

export const codeSchema = z.string().regex(/^\d{4}$/, MSG.code);

export const PASSWORD_RULES = {
  len: (v: string) => v.length >= 8,
  num: (v: string) => /\d/.test(v),
  up: (v: string) => /[A-ZÁÉÍÓÚÑ]/.test(v),
} as const;
export type PasswordRule = keyof typeof PASSWORD_RULES;
export const passwordOk = (v: string) => Object.values(PASSWORD_RULES).every((r) => r(v));

// Nombres: letras (incl. acentos), espacios, apóstrofo y guion. Bloquea markup y caracteres de control.
const NAME_RE = /^[\p{L}][\p{L}\p{M}' -]{0,79}$/u;

function isPastDate(iso: string, today = new Date()): boolean {
  const d = new Date(`${iso}T00:00:00`);
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return !Number.isNaN(d.getTime()) && d < t && d.getFullYear() >= 1900;
}

/**
 * Valida el perfil y devuelve los errores en el mismo orden que el prototipo,
 * más los campos marcados como inválidos (para aria-invalid).
 */
export interface ProfileInput {
  nombres: string;
  apellidos: string;
  formacion: string;
  nacimiento: string;
  institucion: string;
  password: string;
  password2: string;
  terms: boolean;
}
export type ProfileField = keyof ProfileInput;

/** Valores permitidos según el maestro de maestros (lista blanca). */
export interface AllowedOptions {
  formaciones: ReadonlySet<string>;
  instituciones: ReadonlySet<string>;
}

export function validateProfile(v: ProfileInput, allowed: AllowedOptions, today = new Date()) {
  const errors: string[] = [];
  const invalid = new Set<ProfileField>();
  const flag = (f: ProfileField, msg: string) => {
    invalid.add(f);
    errors.push(msg);
  };
  // Orden del prototipo: campos requeridos en orden DOM, luego fecha, formación, contraseña, match, términos.
  if (!v.nombres.trim()) flag('nombres', MSG.nombres);
  else if (!NAME_RE.test(v.nombres.trim())) flag('nombres', MSG.nombres);
  if (!v.apellidos.trim()) flag('apellidos', MSG.apellidos);
  else if (!NAME_RE.test(v.apellidos.trim())) flag('apellidos', MSG.apellidos);
  if (!v.nacimiento) flag('nacimiento', MSG.nacimiento);
  if (!allowed.instituciones.has(v.institucion)) flag('institucion', MSG.institucion);
  if (v.nacimiento && !isPastDate(v.nacimiento, today)) flag('nacimiento', MSG.nacimientoFutura);
  if (!allowed.formaciones.has(v.formacion)) flag('formacion', MSG.formacion);
  if (!passwordOk(v.password)) flag('password', MSG.password);
  if (!v.password || v.password !== v.password2) flag('password2', MSG.passwordMatch);
  if (!v.terms) flag('terms', MSG.terms);
  return { errors, invalid };
}
