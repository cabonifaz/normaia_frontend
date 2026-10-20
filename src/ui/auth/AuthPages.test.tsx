import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AppError } from '@/application/errors';
import { challenge, fakeDeps, renderApp } from '@/ui/test/renderApp';

describe('ingreso', () => {
  it('"Ya tengo cuenta" lleva al ingreso y el correo recibe el foco', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/');
    await user.click(await screen.findByRole('link', { name: 'Ya tengo cuenta' }));
    expect(await screen.findByRole('heading', { name: 'Ingresa a tu cuenta' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/ingresar');
    expect(screen.getByLabelText('Correo electrónico')).toHaveFocus();
  });

  it('valida antes de llamar al caso de uso', async () => {
    const user = userEvent.setup();
    const { deps } = renderApp('/ingresar');
    await user.click(await screen.findByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByText('Escribe un correo válido, por ejemplo nombre@correo.com.')).toBeVisible();
    expect(screen.getByText('Escribe tu contraseña.')).toBeVisible();
    expect(deps.auth.iniciarSesion).not.toHaveBeenCalled();
  });

  it('al enviar con errores, el foco va al primer campo inválido (WCAG 3.3.1)', async () => {
    const user = userEvent.setup();
    renderApp('/ingresar');
    await user.type(await screen.findByLabelText('Correo electrónico'), 'ana@correo.com');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));
    await waitFor(() => expect(screen.getByLabelText('Contraseña')).toHaveFocus());
  });

  it('credenciales inválidas: mensaje genérico, limpia la contraseña y le devuelve el foco', async () => {
    const deps = fakeDeps();
    deps.auth.iniciarSesion.mockRejectedValue(new AppError('unauthorized', 401, 'r', 'INVALID_CREDENTIALS'));
    const user = userEvent.setup();
    renderApp('/ingresar', deps);
    await user.type(await screen.findByLabelText('Correo electrónico'), 'ana@correo.com');
    await user.type(screen.getByLabelText('Contraseña'), 'Mala1234');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El correo o la contraseña no son correctos');
    expect(screen.getByLabelText('Contraseña')).toHaveValue('');
    expect(screen.getByLabelText('Contraseña')).toHaveFocus();
  });

  it('bloqueo temporal muestra minutos de espera', async () => {
    const deps = fakeDeps();
    deps.auth.iniciarSesion.mockRejectedValue(new AppError('rate_limited', 429, 'r', 'ACCOUNT_LOCKED', 300));
    const user = userEvent.setup();
    renderApp('/ingresar', deps);
    await user.type(await screen.findByLabelText('Correo electrónico'), 'ana@correo.com');
    await user.type(screen.getByLabelText('Contraseña'), 'Mala1234');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Inténtalo de nuevo en 5 minutos');
  });

  it('éxito lleva a la app', async () => {
    const user = userEvent.setup();
    const { deps, router } = renderApp('/ingresar');
    await user.type(await screen.findByLabelText('Correo electrónico'), 'ana@correo.com');
    await user.type(screen.getByLabelText('Contraseña'), 'Norma2026');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/app'));
    expect(deps.auth.iniciarSesion).toHaveBeenCalledWith({ email: 'ana@correo.com', password: 'Norma2026' });
  });

  it('muestra solo avisos de la lista cerrada (no refleja la URL)', async () => {
    renderApp('/ingresar?motivo=sesion-expirada');
    expect(await screen.findByRole('status')).toHaveTextContent('Tu sesión terminó por seguridad');
  });

  it('ignora motivos desconocidos', async () => {
    renderApp('/ingresar?motivo=%3Cscript%3Ealert(1)%3C%2Fscript%3E');
    await screen.findByRole('heading', { name: 'Ingresa a tu cuenta' });
    expect(document.querySelector('.notice')).toBeNull();
    expect(document.body.textContent).not.toContain('alert(1)');
  });
});

describe('recuperar contraseña', () => {
  it('flujo completo: correo → código + nueva contraseña → ingreso con aviso', async () => {
    const user = userEvent.setup();
    const { deps, router } = renderApp('/ingresar');
    await user.click(await screen.findByRole('link', { name: '¿Olvidaste tu contraseña?' }));
    expect(await screen.findByRole('heading', { name: 'Recupera tu contraseña' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Correo electrónico'), 'ana@correo.com');
    await user.click(screen.getByRole('button', { name: 'Enviar código' }));
    expect(await screen.findByRole('heading', { name: 'Crea una nueva contraseña' })).toBeInTheDocument();
    expect(deps.auth.solicitarRecuperacion).toHaveBeenCalledWith('ana@correo.com');

    await user.click(screen.getByLabelText('Dígito 1'));
    await user.paste('1234');
    await user.type(screen.getByLabelText('Nueva contraseña'), 'Nueva2026');
    await user.type(screen.getByLabelText('Confirma tu nueva contraseña'), 'Nueva2026');
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/ingresar'));
    expect(await screen.findByRole('status')).toHaveTextContent('Tu contraseña se actualizó');
    expect(deps.auth.restablecerPassword).toHaveBeenCalledWith(challenge.challengeId, { digits: ['1', '2', '3', '4'], password: 'Nueva2026', password2: 'Nueva2026' });
  });

  it('código incorrecto se informa sobre el campo de código', async () => {
    const deps = fakeDeps();
    deps.auth.restablecerPassword.mockRejectedValue(new AppError('validation', 400, 'r', 'OTP_INVALID'));
    const user = userEvent.setup();
    renderApp('/recuperar', deps);
    await user.type(await screen.findByLabelText('Correo electrónico'), 'ana@correo.com');
    await user.click(screen.getByRole('button', { name: 'Enviar código' }));
    await screen.findByRole('heading', { name: 'Crea una nueva contraseña' });
    await user.click(screen.getByLabelText('Dígito 1'));
    await user.paste('9999');
    await user.type(screen.getByLabelText('Nueva contraseña'), 'Nueva2026');
    await user.type(screen.getByLabelText('Confirma tu nueva contraseña'), 'Nueva2026');
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(await screen.findByText('El código no coincide. Revísalo o pide uno nuevo.')).toBeVisible();
  });
});
