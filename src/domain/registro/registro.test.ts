import { describe, expect, it } from 'vitest';

import { isEmail, MSG, passwordOk, validateProfile, type AllowedOptions, type ProfileInput } from './registro';

const ALLOWED: AllowedOptions = { formaciones: new Set(['ARQ', 'ING_CIVIL']), instituciones: new Set(['ULIMA', 'UNI']) };

const valid: ProfileInput = {
  nombres: 'María José',
  apellidos: "Núñez-O'Brien",
  formacion: 'ARQ',
  nacimiento: '1990-04-12',
  institucion: 'ULIMA',
  password: 'Segura123',
  password2: 'Segura123',
  terms: true,
};
const TODAY = new Date('2026-10-20T12:00:00');

describe('validaciones de registro', () => {
  it('email', () => {
    expect(isEmail('nombre@correo.com')).toBe(true);
    expect(isEmail(' Nombre@Correo.PE ')).toBe(true);
    expect(isEmail('nombre@correo')).toBe(false);
    expect(isEmail('a b@c.com')).toBe(false);
    expect(isEmail(`${'a'.repeat(250)}@c.com`)).toBe(false);
  });

  it('contraseña: 8+, número, mayúscula (incluye Ñ y acentos)', () => {
    expect(passwordOk('Segura123')).toBe(true);
    expect(passwordOk('Ñandú1234')).toBe(true);
    expect(passwordOk('segura123')).toBe(false);
    expect(passwordOk('Segura')).toBe(false);
    expect(passwordOk('SeguraSin')).toBe(false);
  });

  it('perfil válido no produce errores', () => {
    expect(validateProfile(valid, ALLOWED, TODAY).errors).toEqual([]);
  });

  it('perfil vacío devuelve los errores en el orden del prototipo', () => {
    const r = validateProfile({ nombres: '', apellidos: '', formacion: '', nacimiento: '', institucion: '', password: '', password2: '', terms: false }, ALLOWED, TODAY);
    expect(r.errors).toEqual([MSG.nombres, MSG.apellidos, MSG.nacimiento, MSG.institucion, MSG.formacion, MSG.password, MSG.passwordMatch, MSG.terms]);
  });

  it('rechaza fecha futura o de hoy', () => {
    expect(validateProfile({ ...valid, nacimiento: '2026-10-20' }, ALLOWED, TODAY).errors).toEqual([MSG.nacimientoFutura]);
    expect(validateProfile({ ...valid, nacimiento: '2030-01-01' }, ALLOWED, TODAY).errors).toEqual([MSG.nacimientoFutura]);
  });

  it('rechaza markup y valores fuera de la lista blanca del maestro', () => {
    const r = validateProfile({ ...valid, nombres: '<script>alert(1)</script>', institucion: 'Universidad Falsa', formacion: 'admin' }, ALLOWED, TODAY);
    expect(r.invalid).toEqual(new Set(['nombres', 'institucion', 'formacion']));
  });

  it('contraseñas distintas', () => {
    expect(validateProfile({ ...valid, password2: 'Segura124' }, ALLOWED, TODAY).errors).toEqual([MSG.passwordMatch]);
  });
});

