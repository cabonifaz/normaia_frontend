import { useForm, useStore } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, type ReactNode } from 'react';
import { userMessage } from '@/application/errors';
import { isEmail, MSG, type Challenge } from '@/domain/registro/registro';
import { focusFirstInvalid } from '@/ui/hooks/focusFirstInvalid';
import { hasErrors, onFormSubmit } from '@/ui/hooks/formSubmit';

interface EmailRequestStepProps {
  title: string;
  description: string;
  submitLabel: string;
  initialEmail: string;
  selectOnMount: boolean;
  request: (email: string) => Promise<{ email: string; challenge: Challenge }>;
  onSent: (email: string, challenge: Challenge) => void;
  footer: ReactNode;
}

/** Paso "escribe tu correo y te enviamos un código". Compartido por registro y recuperación. */
export function EmailRequestStep({ title, description, submitLabel, initialEmail, selectOnMount, request, onSent, footer }: EmailRequestStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const solicitar = useMutation({ mutationFn: (email: string) => request(email) });

  useEffect(() => {
    if (selectOnMount) inputRef.current?.select();
  }, [selectOnMount]);

  const formRef = useRef<HTMLFormElement>(null);
  const form = useForm({
    defaultValues: { email: initialEmail },
    canSubmitWhenInvalid: true,
    onSubmitInvalid: () => focusFirstInvalid(formRef.current),
    validators: {
      onSubmit: ({ value }) => (isEmail(value.email) ? undefined : { fields: { email: MSG.email } }),
    },
    onSubmit: async ({ value }) => {
      // La respuesta del backend no revela si el correo existe.
      const result = await solicitar.mutateAsync(value.email).catch(() => null);
      if (result) onSent(result.email, result.challenge);
    },
  });
  const submitting = useStore(form.store, (s) => s.isSubmitting);

  return (
    <section className="panel" data-panel="1" aria-labelledby="p1">
      <h1 className="display" id="p1" tabIndex={-1}>{title}</h1>
      <p>{description}</p>
      <form ref={formRef} onSubmit={onFormSubmit(form)} noValidate>
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
        <button className="btn" type="submit" disabled={submitting} aria-busy={submitting}>
          {submitting ? 'Enviando…' : submitLabel}
        </button>
        {footer}
      </form>
    </section>
  );
}
