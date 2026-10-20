/** Lleva el foco al primer campo inválido del formulario (WCAG 3.3.1 · identificación de errores). */
export function focusFirstInvalid(form: HTMLFormElement | null): void {
  requestAnimationFrame(() => form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
}
