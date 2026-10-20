import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PasswordField } from './PasswordField';

describe('PasswordField', () => {
  it('avisa cuando Bloq Mayús está activado y lo asocia al campo', () => {
    render(<PasswordField id="p" label="Contraseña" value="" onChange={() => {}} invalid={false} />);
    const input = screen.getByLabelText('Contraseña');
    // jsdom no soporta modifierCapsLock: se simula el estado del modificador en el evento nativo.
    const ev = new KeyboardEvent('keydown', { key: 'A', bubbles: true });
    Object.defineProperty(ev, 'getModifierState', { value: (k: string) => k === 'CapsLock' });
    act(() => {
      input.dispatchEvent(ev);
    });
    const hint = screen.getByText('Bloq Mayús está activado.');
    expect(input.getAttribute('aria-describedby')).toContain(hint.id);
    fireEvent.blur(input);
    expect(screen.queryByText('Bloq Mayús está activado.')).not.toBeInTheDocument();
  });

  it('mostrar/ocultar alterna el tipo y expone aria-pressed', () => {
    render(<PasswordField id="p" label="Contraseña" value="x" onChange={() => {}} invalid={false} />);
    const btn = screen.getByRole('button', { name: 'Mostrar' });
    fireEvent.click(btn);
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Ocultar' })).toHaveAttribute('aria-pressed', 'true');
  });
});
