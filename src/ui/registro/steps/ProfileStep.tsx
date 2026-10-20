import { useForm, useStore } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useMemo, useRef } from 'react';
import { userMessage } from '@/application/errors';
import { codigosPermitidos, MAESTRO } from '@/domain/maestros/maestro';
import {
  validateProfile,
  type AllowedOptions,
  type ProfileField,
  type ProfileInput,
} from '@/domain/registro/registro';
import { useDependencies } from '@/ui/app/DependenciesContext';
import { Combobox } from '@/ui/components/Combobox';
import { focusFirstInvalid } from '@/ui/hooks/focusFirstInvalid';
import { hasErrors, onFormSubmit } from '@/ui/hooks/formSubmit';
import { useMaestro } from '@/ui/hooks/useMaestro';
import { PasswordField } from '@/ui/components/PasswordField';
import { PasswordRules } from '@/ui/components/PasswordRules';

const EMPTY: ProfileInput = {
  nombres: '',
  apellidos: '',
  formacion: '',
  nacimiento: '',
  institucion: '',
  password: '',
  password2: '',
  terms: false,
};

interface ProfileStepProps {
  registrationToken: string;
  onDone: () => void;
}

export function ProfileStep({ registrationToken, onDone }: ProfileStepProps) {
  const { registro } = useDependencies();
  const formaciones = useMaestro(MAESTRO.FORMACION);
  const instituciones = useMaestro(MAESTRO.INSTITUCION);
  const maestrosFailed = formaciones.isError || instituciones.isError;
  const institucionOptions = useMemo(
    () => (instituciones.data ?? []).map((o) => ({ value: o.codigo, label: o.descripcion })),
    [instituciones.data],
  );
  const allowed: AllowedOptions = {
    formaciones: codigosPermitidos(formaciones.data ?? []),
    instituciones: codigosPermitidos(instituciones.data ?? []),
  };

  const crear = useMutation({
    mutationFn: (perfil: ProfileInput) => registro.completarRegistro(registrationToken, perfil, allowed),
  });

  const formRef = useRef<HTMLFormElement>(null);
  const form = useForm({
    defaultValues: EMPTY,
    canSubmitWhenInvalid: true,
    onSubmitInvalid: () => focusFirstInvalid(formRef.current),
    validators: {
      onSubmit: ({ value }) => {
        const { errors, invalid } = validateProfile(value, allowed);
        if (!errors.length) return undefined;
        const fields: Partial<Record<ProfileField, true>> = {};
        for (const f of invalid) fields[f] = true;
        return { form: errors, fields };
      },
    },
    onSubmit: async ({ value, formApi }) => {
      const ok = await crear.mutateAsync(value).then(
        () => true,
        () => false,
      );
      if (!ok) return;
      formApi.reset(); // no retener la contraseña en memoria más de lo necesario
      onDone();
    },
  });
  const submitting = useStore(form.store, (s) => s.isSubmitting);
  const formErrors = useStore(form.store, (s) => (s.errorMap.onSubmit as string[] | undefined) ?? []);
  const errorList = crear.isError ? [userMessage(crear.error)] : formErrors;

  return (
    <section className="panel" data-panel="3" aria-labelledby="p3">
      <h1 className="display" id="p3" tabIndex={-1}>Completa tu perfil</h1>
      <p>Correo verificado. Estos datos nos ayudan a adaptar las respuestas a tu formación.</p>
      <form ref={formRef} onSubmit={onFormSubmit(form)} noValidate>
        <div className="row">
          <form.Field name="nombres">
            {(f) => (
              <div className="field">
                <label htmlFor="nombres">Nombres</label>
                <input className="input" id="nombres" autoComplete="given-name" maxLength={80} value={f.state.value} onChange={(e) => f.handleChange(e.target.value)} onBlur={f.handleBlur} aria-invalid={hasErrors(f.state.meta.errors)} />
              </div>
            )}
          </form.Field>
          <form.Field name="apellidos">
            {(f) => (
              <div className="field">
                <label htmlFor="apellidos">Apellidos</label>
                <input className="input" id="apellidos" autoComplete="family-name" maxLength={80} value={f.state.value} onChange={(e) => f.handleChange(e.target.value)} onBlur={f.handleBlur} aria-invalid={hasErrors(f.state.meta.errors)} />
              </div>
            )}
          </form.Field>
        </div>

        <form.Field name="formacion">
          {(f) => (
            <fieldset className="field choices" id="formacion">
              <legend>Formación</legend>
              {formaciones.isPending && <p className="form-status">Cargando opciones…</p>}
              {formaciones.data?.map((o) => (
                <label className="choice" key={o.codigo}>
                  <input type="radio" name="formacion" value={o.codigo} checked={f.state.value === o.codigo} onChange={() => f.handleChange(o.codigo)} aria-invalid={hasErrors(f.state.meta.errors)} />
                  <span>{o.descripcion}</span>
                </label>
              ))}
            </fieldset>
          )}
        </form.Field>

        <div className="row">
          <form.Field name="nacimiento">
            {(f) => (
              <div className="field">
                <label htmlFor="nacimiento">Fecha de nacimiento</label>
                <input className="input" id="nacimiento" type="date" autoComplete="bday" min="1900-01-01" value={f.state.value} onChange={(e) => f.handleChange(e.target.value)} onBlur={f.handleBlur} aria-invalid={hasErrors(f.state.meta.errors)} />
              </div>
            )}
          </form.Field>
          <form.Field name="institucion">
            {(f) => (
              <div className="field">
                <label htmlFor="institucion">Institución de estudios</label>
                <Combobox
                  id="institucion"
                  label="Institución de estudios"
                  options={institucionOptions}
                  value={f.state.value}
                  onChange={f.handleChange}
                  onBlur={f.handleBlur}
                  placeholder={instituciones.isPending ? 'Cargando…' : 'Escribe para buscar tu institución'}
                  invalid={hasErrors(f.state.meta.errors)}
                  disabled={!instituciones.isSuccess}
                  busy={instituciones.isPending}
                />
              </div>
            )}
          </form.Field>
        </div>

        <form.Field name="password">
          {(f) => (
            <PasswordField id="pass" label="Contraseña" value={f.state.value} onChange={f.handleChange} invalid={hasErrors(f.state.meta.errors)} describedBy="reqs">
              <PasswordRules id="reqs" value={f.state.value} />
            </PasswordField>
          )}
        </form.Field>

        <form.Field name="password2">
          {(f) => <PasswordField id="pass2" label="Confirma tu contraseña" value={f.state.value} onChange={f.handleChange} invalid={hasErrors(f.state.meta.errors)} />}
        </form.Field>

        <form.Field name="terms">
          {(f) => (
            <label className="check">
              <input type="checkbox" id="terms" checked={f.state.value} onChange={(e) => f.handleChange(e.target.checked)} aria-invalid={hasErrors(f.state.meta.errors)} />
              <span>
                Acepto los <Link to="/terminos">términos y condiciones</Link> y la <Link to="/privacidad">política de privacidad</Link>. Entiendo que las respuestas son referenciales.
              </span>
            </label>
          )}
        </form.Field>

        {maestrosFailed && (
          <p className="error" role="alert">
            No pudimos cargar las opciones del formulario.{' '}
            <button
              className="btn btn--text"
              type="button"
              onClick={() => {
                if (formaciones.isError) void formaciones.refetch();
                if (instituciones.isError) void instituciones.refetch();
              }}
            >
              Reintentar
            </button>
          </p>
        )}

        <div id="f3Errors" className="form-errors" role="alert">
          {errorList.map((t) => (
            <p className="error" key={t}>{t}</p>
          ))}
        </div>
        <button className="btn" type="submit" disabled={submitting || maestrosFailed} aria-busy={submitting}>Crear cuenta</button>
      </form>
    </section>
  );
}
