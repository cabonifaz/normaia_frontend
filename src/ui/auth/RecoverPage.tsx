import { useForm, useStore } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, useRef } from 'react';
import { userMessage } from '@/application/errors';
import { validateReset, type ResetInput } from '@/domain/auth/auth';
import type { Challenge } from '@/domain/registro/registro';
import { useDependencies } from '@/ui/app/DependenciesContext';
import { AuthLayout } from '@/ui/components/AuthLayout';
import { CodeInput } from '@/ui/components/CodeInput';
import { EmailRequestStep } from '@/ui/components/EmailRequestStep';
import { PasswordField } from '@/ui/components/PasswordField';
import { PasswordRules } from '@/ui/components/PasswordRules';
import { ResendActions } from '@/ui/components/ResendActions';
import { useCountdown } from '@/ui/hooks/useCountdown';
import { focusFirstInvalid } from '@/ui/hooks/focusFirstInvalid';
import { hasErrors, onFormSubmit } from '@/ui/hooks/formSubmit';

const STEPS = [
  { n: 1, label: 'Correo' },
  { n: 2, label: 'Nueva contraseña' },
] as const;

const CODE_MISMATCH = 'El código no coincide. Revísalo o pide uno nuevo.';
const EMPTY: ResetInput = { digits: ['', '', '', ''], password: '', password2: '' };

export function RecoverPage() {
  const { auth } = useDependencies();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [cameBack, setCameBack] = useState(false);

  useEffect(() => {
    if (step === 1) document.getElementById('p1')?.focus({ preventScroll: true });
  }, [step]);

  return (
    <AuthLayout intro={{ title: 'Recupera el acceso a tu cuenta.', text: 'Te enviaremos un código a tu correo para que crees una nueva contraseña.' }} steps={STEPS} current={step}>
      {step === 1 && (
        <EmailRequestStep
          title="Recupera tu contraseña"
          description="Escribe el correo de tu cuenta. Te enviaremos un código de 4 dígitos para crear una nueva contraseña."
          submitLabel="Enviar código"
          initialEmail={email}
          selectOnMount={cameBack}
          request={auth.solicitarRecuperacion}
          onSent={(e, c) => {
            setEmail(e);
            setChallenge(c);
            setStep(2);
          }}
          footer={<p className="auth-alt">¿La recordaste? <Link to="/ingresar">Vuelve a ingresar</Link></p>}
        />
      )}
      {step === 2 && challenge && (
        <ResetStep
          email={email}
          challenge={challenge}
          onChallenge={setChallenge}
          onChangeEmail={() => {
            setChallenge(null);
            setCameBack(true);
            setStep(1);
          }}
        />
      )}
    </AuthLayout>
  );
}

interface ResetStepProps {
  email: string;
  challenge: Challenge;
  onChallenge: (c: Challenge) => void;
  onChangeEmail: () => void;
}

function ResetStep({ email, challenge, onChallenge, onChangeEmail }: ResetStepProps) {
  const { auth } = useDependencies();
  const navigate = useNavigate();
  const [resent, setResent] = useState(false);
  const { remaining, start, stop } = useCountdown();

  useEffect(() => {
    start(challenge.resendAfter);
  }, [challenge, start]);

  const restablecer = useMutation({ mutationFn: (input: ResetInput) => auth.restablecerPassword(challenge.challengeId, input) });
  const reenviar = useMutation({
    mutationFn: () => auth.reenviarRecuperacion(challenge.challengeId),
    onSuccess: (next) => {
      form.setFieldValue('digits', EMPTY.digits);
      restablecer.reset();
      setResent(true);
      onChallenge(next);
    },
  });

  const formRef = useRef<HTMLFormElement>(null);
  const form = useForm({
    defaultValues: EMPTY,
    canSubmitWhenInvalid: true,
    onSubmitInvalid: () => focusFirstInvalid(formRef.current),
    validators: {
      onSubmit: ({ value }) => {
        const fields = validateReset(value);
        return Object.keys(fields).length ? { fields } : undefined;
      },
    },
    onSubmit: async ({ value, formApi }) => {
      const ok = await restablecer.mutateAsync(value).then(
        () => true,
        () => false,
      );
      if (!ok) return;
      stop();
      formApi.reset();
      await navigate({ to: '/ingresar', search: { motivo: 'clave-actualizada' } });
    },
  });
  const submitting = useStore(form.store, (s) => s.isSubmitting);
  const serverError = restablecer.isError
    ? userMessage(restablecer.error, { validation: CODE_MISMATCH, OTP_INVALID: CODE_MISMATCH, OTP_EXPIRED: CODE_MISMATCH })
    : null;

  return (
    <section className="panel" data-panel="2" aria-labelledby="p2">
      <h1 className="display" id="p2" tabIndex={-1}>Crea una nueva contraseña</h1>
      <p>
        Si <strong id="sentTo">{email}</strong> tiene una cuenta, le enviamos un código de 4 dígitos. Revisa también tu carpeta de spam.
      </p>
      <form ref={formRef} onSubmit={onFormSubmit(form)} noValidate>
        <form.Field name="digits">
          {(f) => {
            const invalid = hasErrors(f.state.meta.errors);
            const error = invalid ? String(f.state.meta.errors[0]) : serverError;
            return (
              <fieldset className="field fieldset-reset">
                <legend>Código de verificación</legend>
                <CodeInput value={f.state.value} onChange={f.handleChange} invalid={!!error} describedBy="codeErr" />
                <p className="error" id="codeErr" role="alert" hidden={!error}>{error}</p>
              </fieldset>
            );
          }}
        </form.Field>

        <form.Field name="password">
          {(f) => (
            <div>
              <PasswordField id="pass" label="Nueva contraseña" value={f.state.value} onChange={f.handleChange} onBlur={f.handleBlur} invalid={hasErrors(f.state.meta.errors)} describedBy="reqs">
                <PasswordRules id="reqs" value={f.state.value} />
              </PasswordField>
            </div>
          )}
        </form.Field>

        <form.Field name="password2">
          {(f) => {
            const invalid = hasErrors(f.state.meta.errors);
            return (
              <div>
                <PasswordField id="pass2" label="Confirma tu nueva contraseña" value={f.state.value} onChange={f.handleChange} onBlur={f.handleBlur} invalid={invalid} describedBy="pass2Err" />
                <p className="error" id="pass2Err" hidden={!invalid}>{String(f.state.meta.errors[0] ?? '')}</p>
              </div>
            );
          }}
        </form.Field>

        <button className="btn" type="submit" disabled={submitting} aria-busy={submitting}>
          {submitting ? 'Guardando…' : 'Guardar contraseña'}
        </button>
        <ResendActions
          remaining={remaining}
          justResent={resent && remaining === challenge.resendAfter}
          pending={reenviar.isPending}
          onResend={() => reenviar.mutate()}
          onChangeEmail={() => {
            stop();
            onChangeEmail();
          }}
        />
        {reenviar.isError && <p className="error" role="alert">{userMessage(reenviar.error)}</p>}
      </form>
    </section>
  );
}
