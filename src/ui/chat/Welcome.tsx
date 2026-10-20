import { COVERAGE } from '@/ui/landing/content';

interface WelcomeProps {
  nombre: string;
  disabled: boolean;
  onPregunta: (texto: string) => void;
}

/** Bienvenida orientada al RNE: preguntas de ejemplo por título del reglamento (mismas que la landing). */
export function Welcome({ nombre, disabled, onPregunta }: WelcomeProps) {
  return (
    <div className="welcome">
      <h2 className="display">{nombre ? `Hola, ${nombre}.` : 'Hola.'} ¿Qué norma necesitas hoy?</h2>
      <p>Pregunta con tus propias palabras. Norma IA identifica la norma del Reglamento Nacional de Edificaciones que aplica y te indica el artículo.</p>
      <ul className="suggest" aria-label="Consultas de ejemplo">
        {COVERAGE.slice(0, 4).map((c) => {
          const ej = c.examples[0];
          return (
            <li key={c.title}>
              <button type="button" disabled={disabled} onClick={() => onPregunta(ej.q)}>
                <small>{c.title}</small>
                <span>
                  {ej.q} <span className="norma-code">{ej.norma}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
