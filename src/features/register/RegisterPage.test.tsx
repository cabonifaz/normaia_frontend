import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/features/auth/registerApi';
import { ApiError } from '@/lib/http/errors';
import { MSG } from '@/lib/validation/register';
import { routes } from '@/routes';

vi.mock('@/lib/maestros/maestrosApi', async (orig) => ({
  ...(await orig<typeof import('@/lib/maestros/maestrosApi')>()),
  getMaestro: vi.fn((grupo: string) =>
    Promise.resolve(
      grupo === 'FORMACION'
        ? [{ codigo: 'ING_CIVIL', descripcion: 'Ingeniero civil' }, { codigo: 'ARQ', descripcion: 'Arquitecto' }, { codigo: 'EST', descripcion: 'Estudiante' }]
        : [{ codigo: 'ULIMA', descripcion: 'Universidad de Lima' }, { codigo: 'UNI', descripcion: 'Universidad Nacional de Ingeniería' }],
    ),
  ),
}));

vi.mock('@/features/auth/registerApi', () => ({
  requestCode: vi.fn(),
  resendCode: vi.fn(),
  verifyCode: vi.fn(),
  completeRegistration: vi.fn(),
}));

const challenge = { challengeId: 'ch_0123456789abcdef', resendAfter: 30 };

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => {
  vi.mocked(api.requestCode).mockResolvedValue(challenge);
  vi.mocked(api.verifyCode).mockResolvedValue('reg_token_0123456789');
  vi.mocked(api.completeRegistration).mockResolvedValue({ userId: 'u1' });
});

describe('registro', () => {
  it('flujo completo desde el hero: correo → código (pegado) → perfil → éxito', async () => {
    const user = userEvent.setup();
    const router = renderAt('/');

    await user.type(screen.getByLabelText('Correo electrónico'), 'Ana@Correo.com');
    await user.click(screen.getAllByRole('button', { name: 'Crear cuenta' })[1]!);

    expect(await screen.findByRole('heading', { name: 'Revisa tu correo' })).toBeInTheDocument();
    expect(api.requestCode).toHaveBeenCalledWith('ana@correo.com');
    expect(screen.getByText('ana@correo.com')).toBeInTheDocument();
    expect(router.state.location.state).toBeNull(); // sin PII en history.state
    expect(await screen.findByText(/Puedes pedir otro en (30|29) s/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reenviar código' })).toBeDisabled();

    const first = screen.getByLabelText('Dígito 1');
    expect(first).toHaveFocus();
    await user.paste('12a34');
    expect(screen.getByLabelText('Dígito 4')).toHaveValue('4');
    await user.click(screen.getByRole('button', { name: 'Verificar correo' }));
    expect(api.verifyCode).toHaveBeenCalledWith(challenge.challengeId, '1234');

    expect(await screen.findByRole('heading', { name: 'Completa tu perfil' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Nombres'), 'Ana');
    await user.type(screen.getByLabelText('Apellidos'), 'Quispe');
    await user.click(await screen.findByLabelText('Arquitecto'));
    await user.type(screen.getByLabelText('Fecha de nacimiento'), '1995-02-03');
    await user.selectOptions(screen.getByLabelText('Institución de estudios'), 'Universidad de Lima');
    await user.type(screen.getByLabelText('Contraseña'), 'Segura123');
    expect(screen.getByText('Mínimo 8 caracteres')).toHaveClass('ok');
    await user.type(screen.getByLabelText('Confirma tu contraseña'), 'Segura123');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByRole('heading', { name: 'Tu cuenta está lista' })).toBeInTheDocument();
    expect(api.completeRegistration).toHaveBeenCalledWith('reg_token_0123456789', expect.objectContaining({ nombres: 'Ana', formacion: 'ARQ', institucion: 'ULIMA', password: 'Segura123' }));
  });

  it('hero muestra error con correo inválido y no llama al API', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await user.type(screen.getByLabelText('Correo electrónico'), 'malo@');
    await user.click(screen.getAllByRole('button', { name: 'Crear cuenta' })[1]!);
    expect(await screen.findByText(MSG.email)).toBeVisible();
    expect(screen.getByLabelText('Correo electrónico')).toHaveAttribute('aria-invalid', 'true');
    expect(api.requestCode).not.toHaveBeenCalled();
  });

  it('código incorrecto muestra mensaje propio, no el del servidor', async () => {
    vi.mocked(api.verifyCode).mockRejectedValue(new ApiError('validation', 400, 'r1', 'OTP_INVALID'));
    const user = userEvent.setup();
    renderAt('/registro');
    await user.type(screen.getByLabelText('Correo electrónico'), 'ana@correo.com');
    await user.click(screen.getByRole('button', { name: 'Enviar código' }));
    await screen.findByRole('heading', { name: 'Revisa tu correo' });
    await user.click(screen.getByRole('button', { name: 'Verificar correo' }));
    expect(await screen.findByText(MSG.code)).toBeVisible();
    await user.click(screen.getByLabelText('Dígito 1'));
    await user.paste('9999');
    await user.click(screen.getByRole('button', { name: 'Verificar correo' }));
    expect(await screen.findByText('El código no coincide. Revísalo o pide uno nuevo.')).toBeVisible();
  });

  it('perfil vacío lista todos los errores y no envía', async () => {
    const user = userEvent.setup();
    renderAt('/registro');
    await user.type(screen.getByLabelText('Correo electrónico'), 'ana@correo.com');
    await user.click(screen.getByRole('button', { name: 'Enviar código' }));
    await screen.findByRole('heading', { name: 'Revisa tu correo' });
    await user.paste('1234');
    await user.click(screen.getByRole('button', { name: 'Verificar correo' }));
    await screen.findByRole('heading', { name: 'Completa tu perfil' });
    await screen.findByLabelText('Arquitecto');
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    const alert = document.getElementById('f3Errors')!;
    await waitFor(() => expect(alert.children).toHaveLength(8));
    expect(api.completeRegistration).not.toHaveBeenCalled();
  });

  it('cambiar correo vuelve al paso 1 conservando el correo', async () => {
    const user = userEvent.setup();
    renderAt('/registro');
    await user.type(screen.getByLabelText('Correo electrónico'), 'ana@correo.com');
    await user.click(screen.getByRole('button', { name: 'Enviar código' }));
    await screen.findByRole('heading', { name: 'Revisa tu correo' });
    await user.click(screen.getByRole('button', { name: 'Cambiar correo' }));
    expect(await screen.findByRole('heading', { name: 'Crea tu cuenta' })).toBeInTheDocument();
    expect(screen.getByLabelText('Correo electrónico')).toHaveValue('ana@correo.com');
  });
});
