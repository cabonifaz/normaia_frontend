import { useForm, useStore } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { userMessage } from '@/application/errors';
import { isEmail, MSG } from '@/domain/registro/registro';
import { useDependencies } from '@/ui/app/DependenciesContext';
import { useRegistroEntry } from '@/ui/app/RegistroEntryContext';
import { hasErrors, onFormSubmit } from '@/ui/hooks/formSubmit';

/** Si el correo es válido, solicita el código y salta directo al paso 2 (igual que el prototipo). */
export function HeroForm() {
  const { registro } = useDependencies();
  const entry = useRegistroEntry();
  const navigate = useNavigate();
  const solicitar = useMutation({ mutationFn: (email: string) => registro.solicitarCodigo(email) });

  const form = useForm({
    defaultValues: { email: '' },
    canSubmitWhenInvalid: true,
    validators: {
      onSubmit: ({ value }) => (isEmail(value.email) ? undefined : { fields: { email: MSG.email } }),
    },
    onSubmit: async ({ value }) => {
      const result = await solicitar.mutateAsync(value.email).catch(() => null);
      if (!result) return; // el error queda en solicitar.error
      entry.put(result);
      await navigate({ to: '/registro' });
    },
  });
  const submitting = useStore(form.store, (s) => s.isSubmitting);

  return (
    <form.Field name="email">
      {(field) => {
        const invalid = hasErrors(field.state.meta.errors);
        const error = invalid ? MSG.email : solicitar.isError ? userMessage(solicitar.error) : null;
        return (
          <>
            <form className="hero-form" onSubmit={onFormSubmit(form)} noValidate>
              <label className="sr-only" htmlFor="heroEmail">Correo electrónico</label>
              <input
                className="input"
                id="heroEmail"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="tu@correo.com"
                maxLength={254}
                required
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                aria-invalid={invalid}
                aria-describedby="heroError"
              />
              <button className="btn" type="submit" disabled={submitting} aria-busy={submitting}>Crear cuenta</button>
            </form>
            <p className="error" id="heroError" role="alert" hidden={!error}>{error}</p>
            <p className="hero-note">¿Ya tienes cuenta? <Link to="/ingresar">Ingresa aquí</Link>.</p>
          </>
        );
      }}
    </form.Field>
  );
}
