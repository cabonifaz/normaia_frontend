import { Link } from 'react-router';

/** Supuesto del prototipo: el usuario entra directo al sistema, sin volver a iniciar sesión. */
export function SuccessStep() {
  return (
    <section className="panel" data-panel="4" aria-labelledby="p4">
      <svg className="done-mark" viewBox="0 0 72 72" aria-hidden="true">
        <rect x="1" y="1" width="70" height="70" fill="none" stroke="#000" strokeWidth="2" />
        <path d="M21 37 L31 47 L51 26" fill="none" stroke="#000" strokeWidth="4" strokeLinecap="square" strokeLinejoin="miter" />
      </svg>
      <h1 className="display" id="p4" tabIndex={-1}>Tu cuenta está lista</h1>
      <p>Ya puedes consultar el Reglamento Nacional de Edificaciones. Empieza con una pregunta de tu proyecto actual.</p>
      <Link className="btn" to="/app">Ir a Norma IA</Link>
    </section>
  );
}
