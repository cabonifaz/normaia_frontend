import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Combobox } from './Combobox';

const OPTIONS = [
  { value: 'UNI', label: 'Universidad Nacional de Ingeniería' },
  { value: 'PUCP', label: 'Pontificia Universidad Católica del Perú' },
  { value: 'ULIMA', label: 'Universidad de Lima' },
];

function Harness() {
  const [v, setV] = useState('');
  return (
    <>
      <label htmlFor="c">Institución</label>
      <Combobox id="c" label="Institución" options={OPTIONS} value={v} onChange={setV} placeholder="Buscar" />
      <output data-testid="value">{v}</output>
    </>
  );
}

describe('Combobox', () => {
  it('filtra sin distinguir tildes ni mayúsculas', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByRole('combobox'), 'CATOLICA');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option')).toHaveTextContent('Pontificia Universidad Católica del Perú');
  });

  it('teclado: flechas + Enter eligen sin enviar el formulario', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const combo = screen.getByRole('combobox');
    await user.click(combo); // abre
    expect(combo).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(screen.getByTestId('value')).toHaveTextContent('PUCP');
    expect(combo).toHaveValue('Pontificia Universidad Católica del Perú');
    expect(combo).toHaveAttribute('aria-expanded', 'false');
  });

  it('Escape cierra y restaura la selección vigente', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const combo = screen.getByRole('combobox');
    await user.type(combo, 'lima');
    await user.click(screen.getByRole('option', { name: 'Universidad de Lima' }));
    await user.clear(combo);
    await user.type(combo, 'xyz');
    expect(screen.getByText(/Sin resultados para/)).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(combo).toHaveValue('Universidad de Lima');
    expect(screen.getByTestId('value')).toHaveTextContent('ULIMA');
  });

  it('el texto libre nunca se convierte en valor', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByRole('combobox'), 'Universidad inventada');
    await user.tab();
    expect(screen.getByTestId('value')).toBeEmptyDOMElement();
    expect(screen.getByRole('combobox')).toHaveValue('');
  });

  it('expone aria-activedescendant para lectores de pantalla', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const combo = screen.getByRole('combobox');
    await user.click(combo);
    await user.keyboard('{ArrowDown}');
    const active = combo.getAttribute('aria-activedescendant');
    expect(active).toBeTruthy();
    expect(document.getElementById(active!)).toHaveTextContent('Pontificia');
  });
});
