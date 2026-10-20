import { useActionState, useEffect, useState, useTransition } from 'react';
import { resendCode, verifyCode, type Challenge } from '@/features/auth/registerApi';
import { userMessage } from '@/lib/http/errors';
import { codeSchema, MSG } from '@/lib/validation/register';
import { CodeInput } from '../CodeInput';
import { useCountdown } from '../useCountdown';

const CODE_MISMATCH = 'El código no coincide. Revísalo o pide uno nuevo.';

interface CodeStepProps {
  email: string;
  challenge: Challenge;
  onChallenge: (c: Challenge) => void;
  onVerified: (registrationToken: string) => void;
  onChangeEmail: () => void;
}

interface State {
  error: string | null;
  invalid: boolean;
}

export function CodeStep({ email, challenge, onChallenge, onVerified, onChangeEmail }: CodeStepProps) {
  const [digits, setDigits] = useState<string[]>(['', '', '', '']);
  const [resent, setResent] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resending, startResend] = useTransition();
  const { remaining, start, stop } = useCountdown();

  useEffect(() => {
    start(challenge.resendAfter);
  }, [challenge, start]);

  const [state, action, pending] = useActionState<State>(
    async () => {
      const parsed = codeSchema.safeParse(digits.join(''));
      if (!parsed.success) return { error: MSG.code, invalid: true };
      try {
        const token = await verifyCode(challenge.challengeId, parsed.data);
        stop();
        onVerified(token);
        return { error: null, invalid: false };
      } catch (err) {
        return { error: userMessage(err, { validation: CODE_MISMATCH, OTP_INVALID: CODE_MISMATCH, OTP_EXPIRED: CODE_MISMATCH }), invalid: true };
      }
    },
    { error: null, invalid: false },
  );

  const onResend = () => {
    setResendError(null);
    startResend(async () => {
      try {
        const next = await resendCode(challenge.challengeId);
        setDigits(['', '', '', '']);
        setResent(true);
        onChallenge(next);
      } catch (err) {
        setResendError(userMessage(err));
      }
    });
  };

  const timerText = remaining > 0 ? `${resent && remaining === challenge.resendAfter ? 'Código reenviado. ' : ''}Puedes pedir otro en ${remaining} s` : '';

  return (
    <section className="panel" data-panel="2" aria-labelledby="p2">
      <h1 className="display" id="p2" tabIndex={-1}>Revisa tu correo</h1>
      <p>
        Enviamos un código de 4 dígitos a <strong id="sentTo">{email}</strong>. Si no lo ves, revisa tu carpeta de spam.
      </p>
      <form action={action} noValidate>
        <fieldset className="field fieldset-reset">
          <legend>Código de verificación</legend>
          <CodeInput value={digits} onChange={setDigits} invalid={state.invalid} describedBy="codeErr" />
          <p className="error" id="codeErr" role="alert" hidden={!state.error}>{state.error}</p>
        </fieldset>
        <button className="btn" type="submit" disabled={pending} aria-busy={pending}>Verificar correo</button>
        <div className="code-actions">
          <button className="btn btn--text" type="button" id="resend" disabled={remaining > 0 || resending} onClick={onResend}>
            Reenviar código
          </button>
          <span className="muted" id="timer" aria-live="polite">{timerText}</span>
          <button className="btn btn--text" type="button" id="changeEmail" onClick={() => { stop(); onChangeEmail(); }}>
            Cambiar correo
          </button>
        </div>
        {resendError && <p className="error" role="alert">{resendError}</p>}
      </form>
    </section>
  );
}
