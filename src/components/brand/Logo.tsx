import { Link } from 'react-router';

interface LogoProps {
  label: string;
}

export function Logo({ label }: LogoProps) {
  return (
    <Link className="logo" to="/" aria-label={label}>
      <svg aria-hidden="true">
        <use href="#isotipo" />
      </svg>
      <span>NORMA IA</span>
    </Link>
  );
}
