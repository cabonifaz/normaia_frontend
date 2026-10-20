import type { FormEvent } from 'react';

/** Adapta el submit nativo a TanStack Form (sin envío del navegador). */
export function onFormSubmit(form: { handleSubmit: () => Promise<unknown> }) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    void form.handleSubmit();
  };
}

/** True si el campo tiene algún error de validación. */
export const hasErrors = (errors: readonly unknown[]) => errors.some(Boolean);
