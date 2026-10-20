import { useState, type KeyboardEvent, type ReactNode, type Ref } from 'react';

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  invalid: boolean;
  describedBy?: string;
  autoComplete?: 'new-password' | 'current-password';
  /** Contenido junto a la etiqueta (p. ej. "¿Olvidaste tu contraseña?"). */
  labelAside?: ReactNode;
  inputRef?: Ref<HTMLInputElement>;
  children?: ReactNode;
}

export function PasswordField({ id, label, value, onChange, onBlur, invalid, describedBy, autoComplete = 'new-password', labelAside, inputRef, children }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const [caps, setCaps] = useState(false);
  const capsId = `${id}-caps`;
  const trackCaps = (e: KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState('CapsLock'));
  const describedByAll = [describedBy, caps ? capsId : undefined].filter(Boolean).join(' ') || undefined;

  return (
    <div className="field">
      {labelAside ? (
        <div className="field-head">
          <label htmlFor={id}>{label}</label>
          {labelAside}
        </div>
      ) : (
        <label htmlFor={id}>{label}</label>
      )}
      <div className="pass">
        <input
          ref={inputRef}
          className="input"
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={128}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={trackCaps}
          onKeyUp={trackCaps}
          onBlur={() => {
            setCaps(false);
            onBlur?.();
          }}
          aria-invalid={invalid}
          aria-describedby={describedByAll}
        />
        <button className="btn btn--text" type="button" aria-controls={id} aria-pressed={visible} onClick={() => setVisible((v) => !v)}>
          {visible ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
      {caps && (
        <p className="caps" id={capsId} role="status">
          Bloq Mayús está activado.
        </p>
      )}
      {children}
    </div>
  );
}
