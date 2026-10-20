import { useForm, useStore } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { userMessage } from '@/application/errors';
import { isEmail, MSG, type Challenge } from '@/domain/registro/registro';
import { useDependencies } from '@/ui/app/DependenciesContext';
import { hasErrors, onFormSubmit } from '@/ui/hooks/formSubmit';

interface EmailStepProps {
  initialEmail: string;
  onSent: (email: string, challenge: Challenge) => void;
  selectOnMount: boolean;
}

export function EmailStep({ initialEmail, onSent, selectOnMount }: EmailStepProps) {
  const { registro } = useDependencies();
  const inputRef = useRef<HTMLInputElement>(null);
  const solicitar = useMutation({ mutationFn: (email: string) => registro.solicitarCodigo(email) });

  useEffect(() => {
    if (selectOnMount) inputRef.current?.select();
  }, [selectOnMount]);

  const form = useForm({
    defaultValues: { email: initialEmail },
    canSubmitWhenInvalid: true,
    validators: {
      onSubmit: ({ value }) => (isEmail(value.email) ? undefined : { fields: { email: MSG.email } }),
    },
    onSubmit: async ({ value }) => {
      // El backend envía el código. La respuesta no revela si el correo ya existe.
      const result = await solicitar.mutateAsync(value.email).catch(() => null);
      if (result) onSent(result.email, result.challenge);
    },
  });
  const submitting = useStore(form.store, (s) => s.isSubmitting);

  return (
    <section className="panel" data-panel="1" aria-labelledby="p1">
      <h1 className="display" id="p1" tabIndex={-1}>Crea tu cuenta</h1>
      <p>Escribe tu correo. Te enviaremos un código de 4 dígitos para verificarlo.</p>
      <form onSubmit={onFormSubmit(form)} noValidate>
        <form.Field name="email">
          {(field) => {
            const invalid = hasErrors(field.state.meta.errors);
            const error = invalid ? MSG.email : solicitar.isError ? userMessage(solicitar.error) : null;
            return (
              <div className="field">
                <label htmlFor="email">Correo electrónico</label>
                <input
                  ref={inputRef}
                  className="input"
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="tu@correo.com"
                  maxLength={254}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  aria-invalid={invalid}
                  aria-describedby="emailErr"
                />
                <p className="error" id="emailErr" role="alert" hidden={!error}>{error}</p>
              </div>
            );
          }}
        </form.Field>
        <button className="btn" type="submit" disabled={submitting} aria-busy={submitting}>Enviar código</button>
        <p className="muted alt-link">¿Ya tienes cuenta? <Link to="/ingresar">Ingresa aquí</Link></p>
      </form>
    </section>
  );
}
