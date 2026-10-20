import { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** <dialog> nativo: foco atrapado, Escape y backdrop accesibles sin dependencias. */
export function ConfirmDialog({ open, title, body, confirmLabel, pending, onConfirm, onClose }: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal?.();
      cancelRef.current?.focus(); // acción destructiva: el foco empieza en "Cancelar"
    } else if (!open && d.open) d.close?.();
  }, [open]);

  return (
    <dialog ref={ref} className="confirm" aria-labelledby="confirm-title" aria-describedby="confirm-body" onClose={onClose} onCancel={onClose}>
      <h2 id="confirm-title" className="display">{title}</h2>
      <p id="confirm-body">{body}</p>
      <div className="confirm-actions">
        <button ref={cancelRef} className="btn btn--ghost" type="button" onClick={onClose}>Cancelar</button>
        <button className="btn btn--danger" type="button" onClick={onConfirm} disabled={pending} aria-busy={pending}>
          {pending ? 'Eliminando…' : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
