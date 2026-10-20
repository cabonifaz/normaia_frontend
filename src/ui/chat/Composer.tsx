import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import type { ArchivoAdjunto } from '@/application/ports/ChatRepository';
import { firmaImagenValida, LIMITES, MSG_CHAT, validarAdjuntos, validarMensaje } from '@/domain/chat/chat';

interface ComposerProps {
  disabled: boolean;
  enviando: boolean;
  placeholder: string;
  onEnviar: (texto: string, archivos: ArchivoAdjunto[]) => void;
  onDetener: () => void;
}

export interface ComposerHandle {
  focus: () => void;
  set: (texto: string) => void;
}

interface Adjunto extends ArchivoAdjunto {
  url: string;
}

const AVISO_CONTADOR = Math.floor(LIMITES.mensaje * 0.85);

async function firmaOk(f: File) {
  return firmaImagenValida(new Uint8Array(await f.slice(0, 12).arrayBuffer()));
}

export const Composer = forwardRef<ComposerHandle, ComposerProps>(function Composer({ disabled, enviando, placeholder, onEnviar, onDetener }, ref) {
  const [texto, setTexto] = useState('');
  const [adjuntos, setAdjuntos] = useState<Adjunto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({ focus: () => area.current?.focus(), set: (t) => setTexto(t) }), []);

  // Autoajuste de altura (hasta el máximo del CSS).
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [texto]);

  // Liberar URLs de previsualización al desmontar (las quitadas/enviadas se liberan al momento).
  const vivos = useRef<Adjunto[]>([]);
  vivos.current = adjuntos;
  useEffect(() => () => vivos.current.forEach((a) => URL.revokeObjectURL(a.url)), []);

  const agregar = async (files: File[]) => {
    setError(null);
    if (!files.length) return;
    const regla = validarAdjuntos(
      adjuntos.length,
      files.map((f) => ({ nombre: f.name, tipo: f.type, peso: f.size })),
    );
    if (regla) return setError(regla);
    for (const f of files) if (!(await firmaOk(f))) return setError(MSG_CHAT.adjuntoTipo);
    setAdjuntos((prev) => [...prev, ...files.map((f) => ({ nombre: f.name, tipo: f.type, contenido: f, url: URL.createObjectURL(f) }))]);
  };

  const enviar = () => {
    if (enviando || disabled) return;
    const err = validarMensaje(texto);
    if (err) {
      setError(err);
      area.current?.focus();
      return;
    }
    onEnviar(texto, adjuntos.map(({ nombre, tipo, contenido }) => ({ nombre, tipo, contenido })));
    setTexto('');
    adjuntos.forEach((a) => URL.revokeObjectURL(a.url));
    setAdjuntos([]);
    setError(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter envía; Shift+Enter salto de línea; no interferir con IME (acentos compuestos, etc.).
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      enviar();
    }
    if (e.key === 'Escape' && enviando) onDetener();
  };

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const imgs = [...e.clipboardData.files].filter((f) => f.type.startsWith('image/'));
    if (imgs.length) {
      e.preventDefault();
      void agregar(imgs);
    }
  };

  const largo = texto.length;

  return (
    <div className="composer-wrap">
      <div className="composer">
        {adjuntos.length > 0 && (
          <ul className="atts" aria-label="Imágenes adjuntas">
            {adjuntos.map((a, i) => (
              <li className="att" key={a.url}>
                <img src={a.url} alt={`Adjunto ${i + 1}: ${a.nombre}`} />
                <button type="button" aria-label={`Quitar ${a.nombre}`} onClick={() => {
                    URL.revokeObjectURL(a.url);
                    setAdjuntos((prev) => prev.filter((x) => x !== a));
                  }}>✕</button>
              </li>
            ))}
          </ul>
        )}
        <label htmlFor="composer-input" className="sr-only">Escribe tu consulta</label>
        <textarea
          id="composer-input"
          ref={area}
          rows={1}
          value={texto}
          maxLength={LIMITES.mensaje}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => {
            setTexto(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          aria-describedby="composer-hint composer-err"
          aria-invalid={!!error}
        />
        <div className="composer-bar">
          <div className="composer-tools">
            <input
              ref={file}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              hidden
              onChange={(e) => {
                void agregar([...(e.target.files ?? [])]);
                e.target.value = '';
              }}
            />
            <button
              className="btn btn--text"
              type="button"
              onClick={() => file.current?.click()}
              disabled={disabled || enviando || adjuntos.length >= LIMITES.adjuntos}
              aria-describedby="composer-att-count"
            >
              + Imagen
            </button>
            <span className="sr-only" id="composer-att-count">{`Adjunta hasta ${LIMITES.adjuntos} imágenes PNG, JPG o WEBP. Llevas ${adjuntos.length}.`}</span>
            <span className="hint" id="composer-hint">Enter para enviar · Shift+Enter nueva línea</span>
            {largo >= AVISO_CONTADOR && (
              <span className="composer-count" data-warn={largo >= LIMITES.mensaje || undefined} aria-live="polite">
                {largo}/{LIMITES.mensaje}
              </span>
            )}
          </div>
          {enviando ? (
            <button className="btn send send--stop" type="button" onClick={onDetener}>Detener</button>
          ) : (
            <button className="btn send" type="button" onClick={enviar} disabled={disabled || !texto.trim()} aria-label="Enviar consulta">
              Enviar
            </button>
          )}
        </div>
      </div>
      {error && <p className="error composer-err" id="composer-err" role="alert">{error}</p>}
      <p className="composer-note">
        <span className="largo">Norma IA orienta. </span>Verifica siempre la norma<span className="largo"> y el artículo</span> citados antes de aplicarlos.
      </p>
    </div>
  );
});
