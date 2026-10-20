interface ResendActionsProps {
  remaining: number;
  /** Mostrar "Código reenviado." mientras la cuenta regresiva no haya avanzado. */
  justResent: boolean;
  pending: boolean;
  onResend: () => void;
  onChangeEmail: () => void;
}

/** Reenviar código + cuenta regresiva + cambiar correo (comportamiento del prototipo). */
export function ResendActions({ remaining, justResent, pending, onResend, onChangeEmail }: ResendActionsProps) {
  const timerText = remaining > 0 ? `${justResent ? 'Código reenviado. ' : ''}Puedes pedir otro en ${remaining} s` : '';
  return (
    <div className="code-actions">
      <button className="btn btn--text" type="button" id="resend" disabled={remaining > 0 || pending} onClick={onResend}>
        Reenviar código
      </button>
      <span className="muted" id="timer" aria-live="polite">{timerText}</span>
      <button className="btn btn--text" type="button" id="changeEmail" onClick={onChangeEmail}>
        Cambiar correo
      </button>
    </div>
  );
}
