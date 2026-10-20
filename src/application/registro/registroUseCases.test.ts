import { describe, expect, it, vi } from 'vitest';
import type { PayloadCipher } from '@/application/ports/PayloadCipher';
import type { RegistroRepository } from '@/application/ports/RegistroRepository';
import type { ProfileInput } from '@/domain/registro/registro';
import { createRegistroUseCases } from './registroUseCases';

const challenge = { challengeId: 'ch_0123456789abcdef', resendAfter: 30 };

function setup() {
  const repo = {
    solicitarCodigo: vi.fn<RegistroRepository['solicitarCodigo']>().mockResolvedValue(challenge),
    reenviarCodigo: vi.fn<RegistroRepository['reenviarCodigo']>().mockResolvedValue(challenge),
    verificarCodigo: vi.fn<RegistroRepository['verificarCodigo']>().mockResolvedValue('reg_token'),
    crearCuenta: vi.fn<RegistroRepository['crearCuenta']>().mockResolvedValue(),
  } satisfies RegistroRepository;
  const cipher: PayloadCipher = { protect: vi.fn((v: string) => Promise.resolve(`enc(${v})`)) };
  return { repo, cipher, uc: createRegistroUseCases({ repo, cipher }) };
}

const perfil: ProfileInput = {
  nombres: '  Ana ',
  apellidos: 'Quispe',
  formacion: 'ARQ',
  nacimiento: '1995-02-03',
  institucion: 'UNI',
  password: 'Segura123',
  password2: 'Segura123',
  terms: true,
};
const allowed = { formaciones: new Set(['ARQ']), instituciones: new Set(['UNI']) };

describe('casos de uso de registro', () => {
  it('normaliza el correo antes de llamar al repositorio', async () => {
    const { repo, uc } = setup();
    await expect(uc.solicitarCodigo(' Ana@Correo.COM ')).resolves.toEqual({ email: 'ana@correo.com', challenge });
    expect(repo.solicitarCodigo).toHaveBeenCalledWith('ana@correo.com');
  });

  it('no llama al repositorio con un correo inválido', async () => {
    const { repo, uc } = setup();
    await expect(uc.solicitarCodigo('malo@')).rejects.toMatchObject({ kind: 'validation' });
    expect(repo.solicitarCodigo).not.toHaveBeenCalled();
  });

  it('el OTP sale cifrado hacia el repositorio', async () => {
    const { repo, uc } = setup();
    await uc.verificarCodigo(challenge.challengeId, '1234');
    expect(repo.verificarCodigo).toHaveBeenCalledWith(challenge.challengeId, 'enc(1234)');
  });

  it('rechaza OTP con formato inválido sin tocar red ni cifrado', async () => {
    const { repo, cipher, uc } = setup();
    await expect(uc.verificarCodigo(challenge.challengeId, '12a4')).rejects.toMatchObject({ kind: 'validation' });
    expect(cipher.protect).not.toHaveBeenCalled();
    expect(repo.verificarCodigo).not.toHaveBeenCalled();
  });

  it('la contraseña nunca llega en claro al puerto', async () => {
    const { repo, uc } = setup();
    await uc.completarRegistro('reg_token', perfil, allowed);
    const [, cuenta] = repo.crearCuenta.mock.calls[0]!;
    expect(cuenta).toEqual({
      nombres: 'Ana',
      apellidos: 'Quispe',
      formacion: 'ARQ',
      fechaNacimiento: '1995-02-03',
      institucion: 'UNI',
      passwordProtegida: 'enc(Segura123)',
      aceptaTerminos: true,
    });
    expect(JSON.stringify(cuenta)).not.toContain('"Segura123"');
  });

  it('revalida el perfil aunque la UI lo haya validado (la UI no es frontera de confianza)', async () => {
    const { repo, uc } = setup();
    await expect(uc.completarRegistro('reg_token', { ...perfil, institucion: 'INYECTADA' }, allowed)).rejects.toMatchObject({ kind: 'validation' });
    expect(repo.crearCuenta).not.toHaveBeenCalled();
  });
});
