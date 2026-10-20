import { useNavigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { Logo } from '@/ui/components/brand/Logo';

interface Step {
  n: number;
  label: string;
}

interface AuthLayoutProps {
  intro: { title: string; text: string };
  /** Indicador de pasos (registro, recuperación). Sin pasos, se muestra el pie de marca. */
  steps?: readonly Step[];
  current?: number;
  children: ReactNode;
}

/** Composición de Norma para pantallas de cuenta: panel negro con marca + área de formulario. */
export function AuthLayout({ intro, steps, current = 0, children }: AuthLayoutProps) {
  const navigate = useNavigate();
  return (
    <div className="reg">
      <aside className="reg-aside">
        <Logo label="Volver al inicio de Norma IA" />
        <div className="intro">
          <h2 className="display">{intro.title}</h2>
          <p>{intro.text}</p>
        </div>
        {steps ? (
          <ol className="progress" aria-label="Progreso">
            {steps.map(({ n, label }) => (
              <li key={n} data-step={n} data-state={n < current ? 'done' : n === current ? 'current' : 'todo'} aria-current={n === current ? 'step' : undefined}>
                <i className="dot" />
                <span className="label">{label}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="aside-foot">
            <strong>Norma IA orienta. La decisión es tuya.</strong>
            <br />
            Verifica siempre la norma citada antes de aplicarla.
          </p>
        )}
      </aside>

      <main className="reg-main">
        <div className="reg-top">
          <button className="btn btn--text" type="button" onClick={() => void navigate({ to: '/' })}>Volver al inicio</button>
        </div>
        {children}
      </main>
    </div>
  );
}
