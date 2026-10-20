import { useActionState, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { requestCode } from '@/features/auth/registerApi';
import type { RegisterEntryState } from '@/features/register/types';
import { userMessage } from '@/lib/http/errors';
import { emailSchema, MSG } from '@/lib/validation/register';

interface State {
  error: string | null;
  invalid: boolean;
}

/** Si el correo es válido, solicita el código y salta directo al paso 2 (igual que el prototipo). */
export function HeroForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');

  const [state, action, pending] = useActionState<State>(
    async () => {
      const parsed = emailSchema.safeParse(email);
      if (!parsed.success) return { error: MSG.email, invalid: true };
      try {
        const challenge = await requestCode(parsed.data);
        const entry: RegisterEntryState = { email: parsed.data, challenge };
        navigate('/registro', { state: entry });
        return { error: null, invalid: false };
      } catch (err) {
        return { error: userMessage(err), invalid: false };
      }
    },
    { error: null, invalid: false },
  );

  return (
    <>
      <form className="hero-form" action={action} noValidate>
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
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={state.invalid}
          aria-describedby="heroError"
        />
        <button className="btn" type="submit" disabled={pending} aria-busy={pending}>Crear cuenta</button>
      </form>
      <p className="error" id="heroError" role="alert" hidden={!state.error}>{state.error}</p>
      <p className="hero-note">¿Ya tienes cuenta? <Link to="/ingresar">Ingresa aquí</Link>.</p>
    </>
  );
}
