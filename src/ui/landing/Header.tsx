import { Link, useNavigate } from '@tanstack/react-router';
import { useDependencies } from '@/ui/app/DependenciesContext';
import { Logo } from '@/ui/components/brand/Logo';

export function Header() {
  const navigate = useNavigate();
  // Con sesión activa (en memoria) la landing no debe parecer "sesión cerrada".
  const conSesion = useDependencies().auth.haySesion();
  return (
    <header className="header">
      <div className="wrap">
        <Logo label="Norma IA, inicio" />
        <nav aria-label="Cuenta">
          {conSesion ? (
            <Link className="btn" to="/app">Ir a mis consultas</Link>
          ) : (
            <>
              <Link className="btn btn--text" to="/ingresar">Ya tengo cuenta</Link>
              <button className="btn" type="button" onClick={() => void navigate({ to: '/registro' })}>Crear cuenta</button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
