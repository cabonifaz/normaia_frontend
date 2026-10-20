import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AppError } from '@/application/errors';
import { MSG } from '@/domain/registro/registro';
import { challenge, fakeDeps, renderApp } from '@/ui/test/renderApp';

async function goToCode(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText('Correo electrónico'), 'ana@correo.com');
  await user.click(screen.getByRole('button', { name: 'Enviar código' }));
  await screen.findByRole('heading', { name: 'Revisa tu correo' });
}

describe('registro', () => {
  it('flujo completo desde el hero: correo → código (pegado) → perfil → éxito', async () => {
    const user = userEvent.setup();
    const { deps, router } = renderApp('/');

    await user.type(await screen.findByLabelText('Correo electrónico'), 'Ana@Correo.com');
    await user.click(screen.getAllByRole('button', { name: 'Crear cuenta' })[1]!);

    expect(await screen.findByRole('heading', { name: 'Revisa tu correo' })).toBeInTheDocument();
    expect(deps.registro.solicitarCodigo).toHaveBeenCalledWith('Ana@Correo.com');
    expect(screen.getByText('ana@correo.com')).toBeInTheDocument();
    expect(JSON.stringify(router.state.location)).not.toContain('ana@correo.com'); // sin PII en URL ni history.state
    expect(await screen.findByText(/Puedes pedir otro en (30|29) s/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reenviar código' })).toBeDisabled();

    expect(screen.getByLabelText('Dígito 1')).toHaveFocus();
    await user.paste('12a34');
    expect(screen.getByLabelText('Dígito 4')).toHaveValue('4');
    await user.click(screen.getByRole('button', { name: 'Verificar correo' }));
    expect(deps.registro.verificarCodigo).toHaveBeenCalledWith(challenge.challengeId, '1234');

    expect(await screen.findByRole('heading', { name: 'Completa tu perfil' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Nombres'), 'Ana');
    await user.type(screen.getByLabelText('Apellidos'), 'Quispe');
    await user.click(await screen.findByLabelText('Arquitecto'));
    await user.type(screen.getByLabelText('Fecha de nacimiento'), '1995-02-03');
    await waitFor(() => expect(screen.getByLabelText('Institución de estudios')).toBeEnabled());
    await user.selectOptions(screen.getByLabelText('Institución de estudios'), 'Universidad de Lima');
    await user.type(screen.getByLabelText('Contraseña'), 'Segura123');
    expect(screen.getByText('Mínimo 8 caracteres')).toHaveClass('ok');
    await user.type(screen.getByLabelText('Confirma tu contraseña'), 'Segura123');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByRole('heading', { name: 'Tu cuenta está lista' })).toBeInTheDocument();
    expect(deps.registro.completarRegistro).toHaveBeenCalledWith(
      'reg_token_0123456789',
      expect.objectContaining({ nombres: 'Ana', formacion: 'ARQ', institucion: 'ULIMA', password: 'Segura123' }),
      { formaciones: new Set(['ING_CIVIL', 'ARQ', 'EST']), instituciones: new Set(['ULIMA', 'UNI']) },
    );
  });

  it('hero muestra error con correo inválido y no llama al caso de uso', async () => {
    const user = userEvent.setup();
    const { deps } = renderApp('/');
    await user.type(await screen.findByLabelText('Correo electrónico'), 'malo@');
    await user.click(screen.getAllByRole('button', { name: 'Crear cuenta' })[1]!);
    expect(await screen.findByText(MSG.email)).toBeVisible();
    expect(screen.getByLabelText('Correo electrónico')).toHaveAttribute('aria-invalid', 'true');
    expect(deps.registro.solicitarCodigo).not.toHaveBeenCalled();
  });

  it('código incorrecto muestra mensaje propio, no el del servidor', async () => {
    const deps = fakeDeps();
    deps.registro.verificarCodigo.mockRejectedValue(new AppError('validation', 400, 'r1', 'OTP_INVALID'));
    const user = userEvent.setup();
    renderApp('/registro', deps);
    await goToCode(user);
    await user.click(screen.getByRole('button', { name: 'Verificar correo' }));
    expect(await screen.findByText(MSG.code)).toBeVisible();
    await user.click(screen.getByLabelText('Dígito 1'));
    await user.paste('9999');
    await user.click(screen.getByRole('button', { name: 'Verificar correo' }));
    expect(await screen.findByText('El código no coincide. Revísalo o pide uno nuevo.')).toBeVisible();
  });

  it('perfil vacío lista todos los errores y no envía', async () => {
    const user = userEvent.setup();
    const { deps } = renderApp('/registro');
    await goToCode(user);
    await user.paste('1234');
    await user.click(screen.getByRole('button', { name: 'Verificar correo' }));
    await screen.findByLabelText('Arquitecto');
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    const alert = document.getElementById('f3Errors')!;
    await waitFor(() => expect(alert.children).toHaveLength(8));
    expect(screen.getByLabelText('Nombres')).toHaveAttribute('aria-invalid', 'true');
    expect(deps.registro.completarRegistro).not.toHaveBeenCalled();
  });

  it('si el maestro falla, bloquea el envío y permite reintentar', async () => {
    const deps = fakeDeps();
    deps.maestros.obtener.mockRejectedValueOnce(new AppError('server', 503, 'r2'));
    const user = userEvent.setup();
    renderApp('/registro', deps);
    await goToCode(user);
    await user.paste('1234');
    await user.click(screen.getByRole('button', { name: 'Verificar correo' }));
    expect(await screen.findByText(/No pudimos cargar las opciones/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeEnabled());
  });

  it('cambiar correo vuelve al paso 1 conservando el correo', async () => {
    const user = userEvent.setup();
    renderApp('/registro');
    await goToCode(user);
    await user.click(screen.getByRole('button', { name: 'Cambiar correo' }));
    expect(await screen.findByRole('heading', { name: 'Crea tu cuenta' })).toBeInTheDocument();
    expect(screen.getByLabelText('Correo electrónico')).toHaveValue('ana@correo.com');
  });

  it('reenviar código llama al caso de uso al terminar la cuenta regresiva', async () => {
    const deps = fakeDeps();
    deps.registro.solicitarCodigo.mockResolvedValue({ email: 'ana@correo.com', challenge: { ...challenge, resendAfter: 0 } });
    const user = userEvent.setup();
    renderApp('/registro', deps);
    await goToCode(user);
    await user.click(screen.getByRole('button', { name: 'Reenviar código' }));
    await waitFor(() => expect(deps.registro.reenviarCodigo).toHaveBeenCalledWith(challenge.challengeId));
  });
});
