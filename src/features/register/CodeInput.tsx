import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from 'react';

const LENGTH = 4;

interface CodeInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  invalid: boolean;
  describedBy?: string;
}

/** Código de 4 dígitos con avance automático, retroceso y pegado (comportamiento del prototipo). */
export function CodeInput({ value, onChange, invalid, describedBy }: CodeInputProps) {
  const cells = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    cells.current[0]?.focus();
  }, []);

  const setAt = (i: number, digit: string) => {
    const next = [...value];
    next[i] = digit;
    onChange(next);
  };

  const handleInput = (i: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1);
    setAt(i, digit);
    if (digit) cells.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !value[i]) cells.current[i - 1]?.focus();
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const digits = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, LENGTH);
    if (!digits) return;
    e.preventDefault();
    const next = Array.from({ length: LENGTH }, (_, k) => digits[k] ?? value[k] ?? '');
    onChange(next);
    (cells.current[digits.length] ?? cells.current[LENGTH - 1])?.focus();
  };

  return (
    <div className="code" id="code">
      {Array.from({ length: LENGTH }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            cells.current[i] = el;
          }}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`Dígito ${i + 1}`}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          value={value[i] ?? ''}
          onChange={(e) => handleInput(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
        />
      ))}
    </div>
  );
}
