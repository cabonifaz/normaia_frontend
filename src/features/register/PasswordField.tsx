import { useState, type ReactNode } from 'react';

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  invalid: boolean;
  describedBy?: string;
  children?: ReactNode;
}

export function PasswordField({ id, label, value, onChange, invalid, describedBy, children }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="pass">
        <input
          className="input"
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete="new-password"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={128}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid}
          aria-describedby={describedBy}
        />
        <button className="btn btn--text" type="button" aria-controls={id} aria-pressed={visible} onClick={() => setVisible((v) => !v)}>
          {visible ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
      {children}
    </div>
  );
}
