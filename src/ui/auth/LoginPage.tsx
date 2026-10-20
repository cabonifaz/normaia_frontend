import { useForm, useStore } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useRef } from 'react';
import { AppError, userMessage } from '@/application/errors';
import { parseLoginMotivo, validateLogin, type LoginInput, type LoginMotivo } from '@/domain/auth/auth';
import { useDependencies } from '@/ui/app/DependenciesContext';
import { AuthLayout } from '@/ui/components/AuthLayout';
import { PasswordField } from '@/ui/components/PasswordField';
import { focusFirstInvalid } from '@/ui/hooks/focusFirstInvalid';
import { hasErrors, onFormSubmit } from '@/ui/hooks/formSubmit';

const NOTICES: Record<LoginMotivo, string> = {
  'sesion-expirada': 'Tu sesión terminó por seguridad. Vuelve a ingresar para continuar.',
  'clave-actualizada': 'Tu contraseña se actualizó. Ingresa con la nueva.',
  'sesion-cerrada': 'Cerraste sesión correctamente.',
  'sesion-requerida': 'Ingresa a tu cuenta para continuar.',
};

const BAD_CREDENTIALS = 'El correo o la contraseña no son correctos. Revísalos e inténtalo de nuevo.';

/** Mensaje de ingreso. Nunca distingue "correo no existe" de "contraseña incorrecta" (anti-enumeración). */
function loginErrorMessage(err: unknown): string {
  if (err instanceof AppError && err.kind === 'rate_limited') {
    const min = err.retryAfter ? Math.max(1, Math.ceil(err.retryAfter / 60)) : null;
    return `Por seguridad bloqueamos el ingreso temporalmente. ${min ? `Inténtalo de nuevo en ${min} ${min === 1 ? 'minuto' : 'minutos'}` : 'Inténtalo más tarde'} o recupera tu contraseña.`;
  }
  return userMessage(err, { unauthorized: BAD_CREDENTIALS, validation: BAD_CREDENTIALS, INVALID_CREDENTIALS: BAD_CREDENTIALS });
}

export function LoginPage({ motivo: rawMotivo }: { motivo: LoginMotivo | undefined }) {
  // Defensa en profundidad: aunque el router ya valida, el componente solo acepta la lista cerrada.
  const motivo = parseLoginMotivo(rawMotivo);
  const { auth } = useDependencies();
  const navigate = useNavigate();
  const passwordRef = useRef<HTMLInputElement>(null);
  const ingresar = useMutation({ mutationFn: (input: LoginInput) => auth.iniciarSesion(input) });

  const formRef = useRef<HTMLFormElement>(null);
  const form = useForm({
    defaultValues: { email: '', password: '' },
    canSubmitWhenInvalid: true,
    onSubmitInvalid: () => focusFirstInvalid(formRef.current),
    validators: {
      onSubmit: ({ value }) => {
        const fields = validateLogin(value);
        return Object.keys(fields).length ? { fields } : undefined;
      },
    },
    onSubmit: async ({ value, formApi }) => {
      const ok = await ingresar.mutateAsync(value).then(
        () => true,
        () => false,
      );
      if (ok) {
        await navigate({ to: '/app' });
        return;
      }
      // Buena práctica: tras un fallo, vaciar la contraseña y devolver el foco para reintentar.
      formApi.setFieldValue('password', '');
      passwordRef.current?.focus();
    },
  });
  const submitting = useStore(form.store, (s) => s.isSubmitting);
  const serverError = ingresar.isError ? loginErrorMessage(ingresar.error) : null;

  return (
    <AuthLayout intro={{ title: 'Accede al Reglamento Nacional de Edificaciones.', text: 'Pregunta en tus palabras y recibe la norma y el artículo exacto.' }}>
      <section className="panel" aria-labelledby="login-title">
        <h1 className="display" id="login-title">Ingresa a tu cuenta</h1>
        <p>Usa el correo y la contraseña con los que te registraste.</p>
        <form ref={formRef} onSubmit={onFormSubmit(form)} noValidate>
          {motivo && !serverError && (
            <p className="notice" role="status">{NOTICES[motivo]}</p>
          )}

          <form.Field name="email">
            {(f) => {
              const invalid = hasErrors(f.state.meta.errors);
              return (
                <div className="field">
                  <label htmlFor="login-email">Correo electrónico</label>
                  <input
                    className="input"
                    id="login-email"
                    name="username"
                    type="email"
                    inputMode="email"
                    autoComplete="username"
                    placeholder="tu@correo.com"
                    maxLength={254}
                    // El primer campo recibe el foco: la pantalla tiene un único propósito.
                    autoFocus
                    value={f.state.value}
                    onChange={(e) => f.handleChange(e.target.value)}
                    onBlur={f.handleBlur}
                    aria-invalid={invalid}
                    aria-describedby="login-email-err"
                  />
                  <p className="error" id="login-email-err" hidden={!invalid}>{String(f.state.meta.errors[0] ?? '')}</p>
                </div>
              );
            }}
          </form.Field>

          <form.Field name="password">
            {(f) => {
              const invalid = hasErrors(f.state.meta.errors);
              return (
                <div>
                  <PasswordField
                    id="login-pass"
                    label="Contraseña"
                    autoComplete="current-password"
                    inputRef={passwordRef}
                    value={f.state.value}
                    onChange={f.handleChange}
                    onBlur={f.handleBlur}
                    invalid={invalid}
                    describedBy="login-pass-err"
                    labelAside={<Link to="/recuperar">¿Olvidaste tu contraseña?</Link>}
                  />
                  <p className="error" id="login-pass-err" hidden={!invalid}>{String(f.state.meta.errors[0] ?? '')}</p>
                </div>
              );
            }}
          </form.Field>

          {serverError && (
            <p className="notice notice--error" role="alert">{serverError}</p>
          )}

          <button className="btn" type="submit" disabled={submitting} aria-busy={submitting}>
            {submitting ? 'Ingresando…' : 'Ingresar'}
          </button>
          <p className="auth-alt">
            ¿Aún no tienes cuenta? <Link to="/registro">Crea una aquí</Link>
          </p>
        </form>
      </section>
    </AuthLayout>
  );
}
