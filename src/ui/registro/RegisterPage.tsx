import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import type { Challenge } from '@/domain/registro/registro';
import { useRegistroEntry } from '@/ui/app/RegistroEntryContext';
import { Logo } from '@/ui/components/brand/Logo';
import { CodeStep } from './steps/CodeStep';
import { EmailStep } from './steps/EmailStep';
import { ProfileStep } from './steps/ProfileStep';
import { SuccessStep } from './steps/SuccessStep';

type Step = 1 | 2 | 3 | 4;

const STEPS = [
  { n: 1, label: 'Correo' },
  { n: 2, label: 'Verificación' },
  { n: 3, label: 'Tus datos' },
] as const;

export function RegisterPage() {
  const navigate = useNavigate();
  const entryStore = useRegistroEntry();
  const [entry] = useState(() => entryStore.peek());

  const [step, setStep] = useState<Step>(entry ? 2 : 1);
  const [email, setEmail] = useState(entry?.email ?? '');
  const [challenge, setChallenge] = useState<Challenge | null>(entry?.challenge ?? null);
  // Token de registro: solo en memoria, nunca en storage ni URL.
  const [registrationToken, setRegistrationToken] = useState<string | null>(null);
  const [cameBack, setCameBack] = useState(false);

  useEffect(() => {
    entryStore.clear(); // consumo único
    window.scrollTo(0, 0);
  }, [entryStore]);

  useEffect(() => {
    // En el paso 2 el foco va al primer dígito (lo gestiona CodeInput).
    if (step !== 2) document.getElementById(`p${step}`)?.focus({ preventScroll: true });
  }, [step]);

  return (
    <div id="registro" className="reg">
      <aside className="reg-aside">
        <Logo label="Volver al inicio de Norma IA" />
        <div className="intro">
          <h2 className="display">Accede al Reglamento Nacional de Edificaciones.</h2>
          <p>Pregunta en tus palabras y recibe la norma y el artículo exacto.</p>
        </div>
        <ol className="progress" aria-label="Progreso del registro">
          {STEPS.map(({ n, label }) => (
            <li key={n} data-step={n} data-state={n < step ? 'done' : n === step ? 'current' : 'todo'} aria-current={n === step ? 'step' : undefined}>
              <i className="dot" />
              <span className="label">{label}</span>
            </li>
          ))}
        </ol>
      </aside>

      <main className="reg-main">
        <div className="reg-top">
          <button className="btn btn--text" type="button" onClick={() => void navigate({ to: '/' })}>Volver al inicio</button>
        </div>

        {step === 1 && (
          <EmailStep
            initialEmail={email}
            selectOnMount={cameBack}
            onSent={(e, c) => {
              setEmail(e);
              setChallenge(c);
              setStep(2);
            }}
          />
        )}

        {step === 2 && challenge && (
          <CodeStep
            email={email}
            challenge={challenge}
            onChallenge={setChallenge}
            onVerified={(token) => {
              setRegistrationToken(token);
              setStep(3);
            }}
            onChangeEmail={() => {
              setChallenge(null);
              setCameBack(true);
              setStep(1);
            }}
          />
        )}

        {step === 3 && registrationToken && (
          <ProfileStep
            registrationToken={registrationToken}
            onDone={() => {
              setRegistrationToken(null);
              setChallenge(null);
              setStep(4);
            }}
          />
        )}

        {step === 4 && <SuccessStep />}
      </main>
    </div>
  );
}
