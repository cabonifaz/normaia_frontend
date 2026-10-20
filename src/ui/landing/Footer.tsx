import { Link } from '@tanstack/react-router';

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <p>
          <strong>Norma IA orienta. La decisión es tuya.</strong>
          <br />
          Las respuestas son referenciales y no reemplazan el texto oficial del Reglamento Nacional de Edificaciones. Verifica siempre la norma citada antes de aplicarla.
          <br />© 2026 Norma IA
        </p>
        <p>
          <Link to="/terminos">Términos y condiciones</Link> &nbsp; <Link to="/privacidad">Política de privacidad</Link>
        </p>
      </div>
    </footer>
  );
}
