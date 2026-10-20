import { AppError } from '@/application/errors';
import type { AuthRepository } from '@/application/ports/AuthRepository';
import type { MaestrosRepository } from '@/application/ports/MaestrosRepository';
import type { RegistroRepository } from '@/application/ports/RegistroRepository';
import type { MaestroItem } from '@/domain/maestros/maestro';

/**
 * Adaptadores en memoria SOLO para desarrollo local sin backend (VITE_USE_MOCKS=true).
 * env.ts impide activarlos en un build de producción.
 * Código OTP válido: 1234.
 */
const delay = <T>(v: T, ms = 400) => new Promise<T>((r) => setTimeout(() => r(v), ms));

const MAESTROS: Record<string, MaestroItem[]> = {
  FORMACION: [
    { codigo: 'ING_CIVIL', descripcion: 'Ingeniero civil', orden: 1 },
    { codigo: 'ARQ', descripcion: 'Arquitecto', orden: 2 },
    { codigo: 'EST', descripcion: 'Estudiante', orden: 3 },
  ],
  INSTITUCION: [
    'Universidad Nacional de Ingeniería',
    'Pontificia Universidad Católica del Perú',
    'Universidad Peruana de Ciencias Aplicadas',
    'Universidad Ricardo Palma',
    'Universidad Nacional Mayor de San Marcos',
    'Universidad Nacional Federico Villarreal',
    'Universidad de Lima',
    'Universidad de San Martín de Porres',
    'Universidad Privada del Norte',
    'Universidad César Vallejo',
    'Universidad Nacional de San Agustín de Arequipa',
    'Otra institución',
  ].map((descripcion, i) => ({ codigo: `INST_${String(i + 1).padStart(2, '0')}`, descripcion, orden: i + 1 })),
};

export const MOCK_OTP = '1234';

export function createMockRegistroRepository(): RegistroRepository {
  const challenge = () => ({ challengeId: `mock_${crypto.randomUUID()}`, resendAfter: 30 });
  return {
    solicitarCodigo: () => delay(challenge()),
    reenviarCodigo: () => delay(challenge()),
    verificarCodigo: (_id, codigo) =>
      codigo === MOCK_OTP ? delay(`mock_reg_${crypto.randomUUID()}`) : Promise.reject(new AppError('validation', 400, 'mock', 'OTP_INVALID')),
    crearCuenta: () => delay(undefined, 700),
  };
}

/**
 * Ingreso simulado:
 *  - contraseña "Norma2026" → éxito
 *  - correo "bloqueado@correo.com" → 429 (bloqueo temporal)
 *  - cualquier otra → credenciales inválidas
 * Recuperación: código 1234.
 */
export const MOCK_PASSWORD = 'Norma2026';

/** Estado de sesión simulado, compartido con los adaptadores mock de perfil y chat. */
export const mockSesion = { activa: false };

export function createMockAuthRepository(): AuthRepository {
  const challenge = () => ({ challengeId: `mock_${crypto.randomUUID()}`, resendAfter: 30 });
  return {
    iniciarSesion(email, password) {
      if (email === 'bloqueado@correo.com') return Promise.reject(new AppError('rate_limited', 429, 'mock', 'ACCOUNT_LOCKED', 300));
      return password === MOCK_PASSWORD
        ? delay(undefined, 600).then(() => {
            mockSesion.activa = true;
          })
        : new Promise((_, rej) => setTimeout(() => rej(new AppError('unauthorized', 401, 'mock', 'INVALID_CREDENTIALS')), 600));
    },
    solicitarRecuperacion: () => delay(challenge()),
    reenviarRecuperacion: () => delay(challenge()),
    restablecerPassword: (_id, codigo) =>
      codigo === MOCK_OTP ? delay(undefined, 600) : Promise.reject(new AppError('validation', 400, 'mock', 'OTP_INVALID')),
    haySesion: () => mockSesion.activa,
  };
}

export function createMockMaestrosRepository(): MaestrosRepository {
  return { obtener: (grupo) => delay(MAESTROS[grupo] ?? []) };
}
