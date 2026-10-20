import { useActionState, useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { requestCode, type Challenge } from '@/features/auth/registerApi';
import { userMessage } from '@/lib/http/errors';
import { emailSchema, MSG } from '@/lib/validation/register';

interface EmailStepProps {
  email: string;
  onEmailChange: (v: string) => void;
  onSent: (email: string, challenge: Challenge) => void;
  selectOnMount: boolean;
}

interface State {
  error: string | null;
  invalid: boolean;
}

export function EmailStep({ email, onEmailChange, onSent, selectOnMount }: EmailStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectOnMount) inputRef.current?.select();
  }, [selectOnMount]);

  const [state, action, pending] = useActionState<State>(
    async () => {
      const parsed = emailSchema.safeParse(email);
      if (!parsed.success) return { error: MSG.email, invalid: true };
      try {
        // Aquí el backend envía el código. La respuesta no revela si el correo ya existe.
        onSent(parsed.data, await requestCode(parsed.data));
        return { error: null, invalid: false };
      } catch (err) {
        return { error: userMessage(err), invalid: false };
      }
    },
    { error: null, invalid: false },
  );

  return (
    <section className="panel" data-panel="1" aria-labelledby="p1">
      <h1 className="display" id="p1" tabIndex={-1}>Crea tu cuenta</h1>
      <p>Escribe tu correo. Te enviaremos un código de 4 dígitos para verificarlo.</p>
      <form action={action} noValidate>
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
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            aria-invalid={state.invalid}
            aria-describedby="emailErr"
          />
          <p className="error" id="emailErr" role="alert" hidden={!state.error}>{state.error}</p>
        </div>
        <button className="btn" type="submit" disabled={pending} aria-busy={pending}>Enviar código</button>
        <p className="muted alt-link">¿Ya tienes cuenta? <Link to="/ingresar">Ingresa aquí</Link></p>
      </form>
    </section>
  );
}
