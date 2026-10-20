import { useForm, useStore } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState, useRef } from 'react';
import { userMessage } from '@/application/errors';
import { codeSchema, MSG, type Challenge } from '@/domain/registro/registro';
import { useDependencies } from '@/ui/app/DependenciesContext';
import { ResendActions } from '@/ui/components/ResendActions';
import { useCountdown } from '@/ui/hooks/useCountdown';
import { focusFirstInvalid } from '@/ui/hooks/focusFirstInvalid';
import { hasErrors, onFormSubmit } from '@/ui/hooks/formSubmit';
import { CodeInput } from '@/ui/components/CodeInput';

const CODE_MISMATCH = 'El código no coincide. Revísalo o pide uno nuevo.';
const EMPTY_CODE = ['', '', '', ''];

interface CodeStepProps {
  email: string;
  challenge: Challenge;
  onChallenge: (c: Challenge) => void;
  onVerified: (registrationToken: string) => void;
  onChangeEmail: () => void;
}

export function CodeStep({ email, challenge, onChallenge, onVerified, onChangeEmail }: CodeStepProps) {
  const { registro } = useDependencies();
  const [resent, setResent] = useState(false);
  const { remaining, start, stop } = useCountdown();

  useEffect(() => {
    start(challenge.resendAfter);
  }, [challenge, start]);

  const verificar = useMutation({
    mutationFn: (code: string) => registro.verificarCodigo(challenge.challengeId, code),
  });
  const reenviar = useMutation({
    mutationFn: () => registro.reenviarCodigo(challenge.challengeId),
    onSuccess: (next) => {
      form.setFieldValue('digits', EMPTY_CODE);
      verificar.reset();
      setResent(true);
      onChallenge(next);
    },
  });

  const formRef = useRef<HTMLFormElement>(null);
  const form = useForm({
    defaultValues: { digits: EMPTY_CODE },
    canSubmitWhenInvalid: true,
    onSubmitInvalid: () => focusFirstInvalid(formRef.current),
    validators: {
      onSubmit: ({ value }) => (codeSchema.safeParse(value.digits.join('')).success ? undefined : { fields: { digits: MSG.code } }),
    },
    onSubmit: async ({ value }) => {
      const token = await verificar.mutateAsync(value.digits.join('')).catch(() => null);
      if (!token) return;
      stop();
      onVerified(token);
    },
  });
  const submitting = useStore(form.store, (s) => s.isSubmitting);

  return (
    <section className="panel" data-panel="2" aria-labelledby="p2">
      <h1 className="display" id="p2" tabIndex={-1}>Revisa tu correo</h1>
      <p>
        Enviamos un código de 4 dígitos a <strong id="sentTo">{email}</strong>. Si no lo ves, revisa tu carpeta de spam.
      </p>
      <form ref={formRef} onSubmit={onFormSubmit(form)} noValidate>
        <form.Field name="digits">
          {(field) => {
            const incomplete = hasErrors(field.state.meta.errors);
            const error = incomplete
              ? MSG.code
              : verificar.isError
                ? userMessage(verificar.error, { validation: CODE_MISMATCH, OTP_INVALID: CODE_MISMATCH, OTP_EXPIRED: CODE_MISMATCH })
                : null;
            return (
              <fieldset className="field fieldset-reset">
                <legend>Código de verificación</legend>
                <CodeInput value={field.state.value} onChange={field.handleChange} invalid={!!error} describedBy="codeErr" />
                <p className="error" id="codeErr" role="alert" hidden={!error}>{error}</p>
              </fieldset>
            );
          }}
        </form.Field>
        <button className="btn" type="submit" disabled={submitting} aria-busy={submitting}>Verificar correo</button>
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
