import { Link, useNavigate } from 'react-router';
import { Logo } from '@/components/brand/Logo';

export function Header() {
  const navigate = useNavigate();
  return (
    <header className="header">
      <div className="wrap">
        <Logo label="Norma IA, inicio" />
        <nav aria-label="Cuenta">
          <Link className="btn btn--text" to="/ingresar">Ya tengo cuenta</Link>
          <button className="btn" type="button" onClick={() => navigate('/registro')}>Crear cuenta</button>
        </nav>
      </div>
    </header>
  );
}
