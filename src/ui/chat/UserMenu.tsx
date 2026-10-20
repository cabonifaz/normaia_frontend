import { useEffect, useRef, useState } from 'react';
import type { UsuarioSesion } from '@/domain/chat/chat';

function iniciales(u: UsuarioSesion | null) {
  if (!u) return '·';
  const n = `${u.nombres.trim()[0] ?? ''}${u.apellidos.trim()[0] ?? ''}`;
  return (n || u.correo[0] || '·').toUpperCase();
}

export function UserMenu({ usuario, onSalir, saliendo }: { usuario: UsuarioSesion | null; onSalir: () => void; saliendo: boolean }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    wrap.current?.querySelector<HTMLButtonElement>('.user-pop button')?.focus();
    const fuera = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const nombre = usuario ? `${usuario.nombres} ${usuario.apellidos}`.trim() || usuario.correo : '';
  const visible = usuario?.nombres || nombre;

  return (
    <div className="user-menu" ref={wrap}>
      <button ref={btn} className="user-btn" type="button" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="avatar" aria-hidden="true">{iniciales(usuario)}</span>
        <span className="who">{visible}</span>
        <span className="sr-only">, menú de cuenta</span>
      </button>
      {open && (
        <div className="user-pop">
          <p>
            <strong>{nombre}</strong>
            {usuario?.correo}
          </p>
          <button type="button" onClick={onSalir} disabled={saliendo} aria-busy={saliendo}>
            {saliendo ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </button>
        </div>
      )}
    </div>
  );
}
