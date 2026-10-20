import { Link, useNavigate } from '@tanstack/react-router';
import { Logo } from '@/ui/components/brand/Logo';

export function Header() {
  const navigate = useNavigate();
  return (
    <header className="header">
      <div className="wrap">
        <Logo label="Norma IA, inicio" />
        <nav aria-label="Cuenta">
          <Link className="btn btn--text" to="/ingresar">Ya tengo cuenta</Link>
          <button className="btn" type="button" onClick={() => void navigate({ to: '/registro' })}>Crear cuenta</button>
        </nav>
      </div>
    </header>
  );
}
