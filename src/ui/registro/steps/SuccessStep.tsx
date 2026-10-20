import { Link } from '@tanstack/react-router';

/** El backend no inicia sesión al crear la cuenta (no devuelve JWT): el siguiente paso es ingresar. */
export function SuccessStep() {
  return (
    <section className="panel" data-panel="4" aria-labelledby="p4">
      <svg className="done-mark" viewBox="0 0 72 72" aria-hidden="true">
        <rect x="1" y="1" width="70" height="70" fill="none" stroke="#000" strokeWidth="2" />
        <path d="M21 37 L31 47 L51 26" fill="none" stroke="#000" strokeWidth="4" strokeLinecap="square" strokeLinejoin="miter" />
      </svg>
      <h1 className="display" id="p4" tabIndex={-1}>Tu cuenta está lista</h1>
      <p>Ya puedes consultar el Reglamento Nacional de Edificaciones. Empieza con una pregunta de tu proyecto actual.</p>
      <Link className="btn" to="/ingresar">Ingresar a Norma IA</Link>
    </section>
  );
}
