import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';

export interface ComboOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  id: string;
  label: string;
  options: readonly ComboOption[];
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder: string;
  invalid?: boolean;
  disabled?: boolean;
  busy?: boolean;
}

/** Normaliza para búsqueda: minúsculas y sin tildes ("catolica" encuentra "Católica"). */
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

/**
 * Combobox con búsqueda (patrón ARIA 1.2 "combobox + listbox", autocompletado de lista).
 * Solo admite valores de la lista: el texto libre nunca se envía como valor.
 */
export function Combobox({ id, label, options, value, onChange, onBlur, placeholder, invalid, disabled, busy }: ComboboxProps) {
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const selected = options.find((o) => o.value === value);
  const [query, setQuery] = useState<string | null>(null); // null = mostrando la selección
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const text = query ?? selected?.label ?? '';
  const filtered = useMemo(() => {
    const q = fold(query ?? '');
    return q ? options.filter((o) => fold(o.label).includes(q)) : options;
  }, [options, query]);

  const scrollTo = (i: number) => listRef.current?.children[i]?.scrollIntoView?.({ block: 'nearest' });

  const openList = (startAt?: number) => {
    const idx = startAt ?? Math.max(0, filtered.findIndex((o) => o.value === value));
    setActive(idx);
    setOpen(true);
    requestAnimationFrame(() => scrollTo(idx));
  };

  const close = () => {
    setOpen(false);
    setQuery(null); // restaura el texto de la selección vigente
  };

  const choose = (o: ComboOption) => {
    onChange(o.value);
    setQuery(null);
    setOpen(false);
  };

  const move = (delta: number) => {
    if (!open) return openList();
    if (!filtered.length) return;
    const next = (active + delta + filtered.length) % filtered.length;
    setActive(next);
    scrollTo(next);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (e.altKey) openList();
        else move(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        move(-1);
        break;
      case 'Home':
      case 'End':
        if (open && filtered.length) {
          e.preventDefault();
          const i = e.key === 'Home' ? 0 : filtered.length - 1;
          setActive(i);
          scrollTo(i);
        }
        break;
      case 'Enter': {
        const o = filtered[active];
        if (open && o) {
          e.preventDefault(); // no enviar el formulario al elegir
          choose(o);
        }
        break;
      }
      case 'Escape':
        if (open) {
          e.preventDefault();
          close();
        } else if (query) {
          setQuery(null);
        }
        break;
      case 'Tab': {
        // Si hay una única coincidencia, Tab la confirma (atajo de teclado habitual).
        const only = filtered.length === 1 ? filtered[0] : undefined;
        if (open && query && only) choose(only);
        else close();
        break;
      }
    }
  };

  const activeOption = open ? filtered[active] : undefined;

  return (
    <div className="combo">
      <input
        className="input"
        id={id}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={activeOption ? `${listId}-${activeOption.value}` : undefined}
        aria-invalid={invalid}
        aria-busy={busy}
        autoComplete="off"
        spellCheck={false}
        maxLength={120}
        placeholder={placeholder}
        disabled={disabled}
        value={text}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={(e) => e.target.select()}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
        onBlur={() => {
          close();
          onBlur?.();
        }}
      />
      <span className="combo-caret" aria-hidden="true" />
      <ul className="combo-list" id={listId} role="listbox" aria-label={label} ref={listRef} hidden={!open}>
        {filtered.map((o, i) => (
          <li
            key={o.value}
            id={`${listId}-${o.value}`}
            role="option"
            aria-selected={o.value === value}
            data-active={i === active || undefined}
            // mousedown en lugar de click: se ejecuta antes del blur del input
            onMouseDown={(e) => {
              e.preventDefault();
              choose(o);
            }}
            onMouseMove={() => setActive(i)}
          >
            {o.label}
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="combo-empty" role="presentation">
            Sin resultados para “{query}”
          </li>
        )}
      </ul>
      <span className="sr-only" aria-live="polite">
        {open ? (filtered.length ? `${filtered.length} resultados` : 'Sin resultados') : ''}
      </span>
    </div>
  );
}
