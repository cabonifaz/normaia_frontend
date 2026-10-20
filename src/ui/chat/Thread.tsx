import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Mensaje } from '@/domain/chat/chat';
import { Markdown } from './Markdown';

const hora = new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit' });
const fecha = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function cuando(ms: number) {
  if (!ms) return '';
  const d = new Date(ms);
  return new Date().toDateString() === d.toDateString() ? hora.format(d) : fecha.format(d);
}

interface ThreadProps {
  mensajes: Mensaje[];
  /** Mensaje del asistente en curso (streaming), si existe. */
  enCurso: Mensaje | null;
  progreso: string | null;
  activo: boolean;
  hayAnteriores: boolean;
  cargandoAnteriores: boolean;
  onAnteriores: () => void;
  extra?: React.ReactNode;
}

const UMBRAL = 120;

export function Thread({ mensajes, enCurso, progreso, activo, hayAnteriores, cargandoAnteriores, onAnteriores, extra }: ThreadProps) {
  const box = useRef<HTMLDivElement>(null);
  const tope = useRef<HTMLDivElement>(null);
  const [abajo, setAbajo] = useState(true);
  const prevAltura = useRef<number | null>(null);
  const primerId = mensajes[0]?.id;

  // Seguir el final solo si el usuario ya estaba abajo (no arrastrarlo mientras lee).
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    if (prevAltura.current !== null) {
      // Se cargaron mensajes anteriores: conservar la posición visual.
      el.scrollTop += el.scrollHeight - prevAltura.current;
      prevAltura.current = null;
      return;
    }
    if (abajo) el.scrollTop = el.scrollHeight;
  }, [mensajes.length, enCurso?.texto, progreso, abajo, primerId]);

  // Paginación hacia atrás al llegar arriba.
  useEffect(() => {
    const el = tope.current;
    if (!el || !hayAnteriores) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting && !cargandoAnteriores) {
          prevAltura.current = box.current?.scrollHeight ?? null;
          onAnteriores();
        }
      },
      { root: box.current, rootMargin: '200px 0px 0px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hayAnteriores, cargandoAnteriores, onAnteriores]);

  return (
    <div
      className="thread"
      ref={box}
      onScroll={(e) => {
        const el = e.currentTarget;
        setAbajo(el.scrollHeight - el.scrollTop - el.clientHeight < UMBRAL);
      }}
    >
      <div className="thread-inner">
        {(hayAnteriores || cargandoAnteriores) && (
          <div ref={tope} className="thread-older" role="status">
            {cargandoAnteriores ? 'Cargando mensajes anteriores…' : ''}
          </div>
        )}
        {mensajes.map((m) => (
          <MessageItem key={m.id} m={m} />
        ))}
        {activo && !enCurso && (
          <div className="msg">
            <div className="progress-line" role="status">
              <span className="nodes" aria-hidden="true"><i /><i /><i /></span>
              {progreso ?? 'Pensando…'}
            </div>
          </div>
        )}
        {enCurso && <MessageItem m={enCurso} streaming />}
        {extra}
      </div>
      {!abajo && (
        <button
          className="btn btn--ghost to-bottom"
          type="button"
          onClick={() => {
            box.current?.scrollTo({ top: box.current.scrollHeight, behavior: 'smooth' });
            setAbajo(true);
          }}
        >
          Ir al final
        </button>
      )}
    </div>
  );
}

function MessageItem({ m, streaming = false }: { m: Mensaje; streaming?: boolean }) {
  const [copiado, setCopiado] = useState(false);
  const esUsuario = m.remitente === 'usuario';

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(m.texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* portapapeles no disponible: sin efecto */
    }
  };

  return (
    <article className={`msg ${esUsuario ? 'msg--user' : 'msg--ai'}`} aria-label={esUsuario ? 'Tu consulta' : 'Respuesta de Norma IA'}>
      <header className="msg-head">
        <strong>{esUsuario ? 'Tú' : 'Norma IA'}</strong>
        <time dateTime={m.creadoEn ? new Date(m.creadoEn).toISOString() : undefined}>{cuando(m.creadoEn)}</time>
      </header>
      {m.adjuntos.length > 0 && (
        <div className="msg-atts">
          {m.adjuntos.map((u, i) => (
            <Adjunto key={u} url={u} n={i + 1} />
          ))}
        </div>
      )}
      {esUsuario ? (
        <div className="msg-body">{m.texto}</div>
      ) : (
        <Markdown text={m.texto} trailing={streaming ? <span className="cursor" aria-hidden="true" /> : null} />
      )}
      {!esUsuario && !streaming && m.texto && (
        <div className="msg-actions">
          <button className="btn btn--text" type="button" onClick={copiar}>{copiado ? 'Copiado' : 'Copiar respuesta'}</button>
          <span className="sr-only" aria-live="polite">{copiado ? 'Respuesta copiada al portapapeles' : ''}</span>
        </div>
      )}
    </article>
  );
}

/** Las URLs prefirmadas de S3 caducan: si la imagen ya no carga, se muestra una casilla clara. */
function Adjunto({ url, n }: { url: string; n: number }) {
  const [roto, setRoto] = useState(false);
  if (roto) {
    return (
      <span className="att-broken" role="img" aria-label={`Imagen adjunta ${n} no disponible`}>
        Imagen no disponible
      </span>
    );
  }
  // Solo las URLs https (S3) se ofrecen como enlace; las blob: locales son previsualizaciones.
  const abrible = url.startsWith('https://');
  const img = <img src={url} alt={`Imagen adjunta ${n}`} loading="lazy" referrerPolicy="no-referrer" onError={() => setRoto(true)} />;
  return abrible ? (
    <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir imagen adjunta ${n} en una pestaña nueva`}>
      {img}
    </a>
  ) : (
    img
  );
}
