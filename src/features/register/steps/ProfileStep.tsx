import { useActionState, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { completeRegistration } from '@/features/auth/registerApi';
import { userMessage } from '@/lib/http/errors';
import { MAESTRO } from '@/lib/maestros/maestrosApi';
import { useMaestro } from '@/lib/maestros/useMaestro';
import {
  PASSWORD_RULES,
  validateProfile,
  type PasswordRule,
  type ProfileField,
  type ProfileInput,
} from '@/lib/validation/register';
import { PasswordField } from '../PasswordField';

const RULE_LABELS: Record<PasswordRule, string> = {
  len: 'Mínimo 8 caracteres',
  num: 'Un número',
  up: 'Una mayúscula',
};

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

interface State {
  errors: string[];
  invalid: ReadonlySet<ProfileField>;
}

export function ProfileStep({ registrationToken, onDone }: ProfileStepProps) {
  const [form, setForm] = useState<ProfileInput>(EMPTY);
  const formaciones = useMaestro(MAESTRO.FORMACION);
  const instituciones = useMaestro(MAESTRO.INSTITUCION);
  const allowed = useMemo(
    () => ({
      formaciones: new Set(formaciones.items.map((i) => i.codigo)),
      instituciones: new Set(instituciones.items.map((i) => i.codigo)),
    }),
    [formaciones.items, instituciones.items],
  );
  const maestrosFailed = formaciones.status === 'error' || instituciones.status === 'error';
  const retryMaestros = () => {
    if (formaciones.status === 'error') formaciones.retry();
    if (instituciones.status === 'error') instituciones.retry();
  };
  const set = <K extends ProfileField>(k: K, v: ProfileInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const [state, action, pending] = useActionState<State>(
    async () => {
      const { errors, invalid } = validateProfile(form, allowed);
      if (errors.length) return { errors, invalid };
      try {
        // Aquí el backend crea la cuenta e inicia sesión (cookie HttpOnly).
        await completeRegistration(registrationToken, {
          nombres: form.nombres.trim(),
          apellidos: form.apellidos.trim(),
          formacion: form.formacion,
          fechaNacimiento: form.nacimiento,
          institucion: form.institucion,
          password: form.password,
          aceptaTerminos: true,
        });
        setForm(EMPTY); // no retener la contraseña en memoria más de lo necesario
        onDone();
        return { errors: [], invalid: new Set() };
      } catch (err) {
        return { errors: [userMessage(err)], invalid: new Set() };
      }
    },
    { errors: [], invalid: new Set() },
  );

  const bad = (f: ProfileField) => state.invalid.has(f);

  return (
    <section className="panel" data-panel="3" aria-labelledby="p3">
      <h1 className="display" id="p3" tabIndex={-1}>Completa tu perfil</h1>
      <p>Correo verificado. Estos datos nos ayudan a adaptar las respuestas a tu formación.</p>
      <form action={action} noValidate>
        <div className="row">
          <div className="field">
            <label htmlFor="nombres">Nombres</label>
            <input className="input" id="nombres" autoComplete="given-name" maxLength={80} value={form.nombres} onChange={(e) => set('nombres', e.target.value)} aria-invalid={bad('nombres')} />
          </div>
          <div className="field">
            <label htmlFor="apellidos">Apellidos</label>
            <input className="input" id="apellidos" autoComplete="family-name" maxLength={80} value={form.apellidos} onChange={(e) => set('apellidos', e.target.value)} aria-invalid={bad('apellidos')} />
          </div>
        </div>

        <fieldset className="field choices" id="formacion">
          <legend>Formación</legend>
          {formaciones.status === 'loading' && <p className="form-status">Cargando opciones…</p>}
          {formaciones.items.map((f) => (
            <label className="choice" key={f.codigo}>
              <input type="radio" name="formacion" value={f.codigo} checked={form.formacion === f.codigo} onChange={() => set('formacion', f.codigo)} aria-invalid={bad('formacion')} />
              <span>{f.descripcion}</span>
            </label>
          ))}
        </fieldset>

        <div className="row">
          <div className="field">
            <label htmlFor="nacimiento">Fecha de nacimiento</label>
            <input className="input" id="nacimiento" type="date" autoComplete="bday" min="1900-01-01" value={form.nacimiento} onChange={(e) => set('nacimiento', e.target.value)} aria-invalid={bad('nacimiento')} />
          </div>
          <div className="field">
            <label htmlFor="institucion">Institución de estudios</label>
            <div className="select">
              <select className="input" id="institucion" required autoComplete="organization" value={form.institucion} onChange={(e) => set('institucion', e.target.value)} aria-invalid={bad('institucion')} disabled={instituciones.status !== 'ready'} aria-busy={instituciones.status === 'loading'}>
                <option value="" disabled>{instituciones.status === 'loading' ? 'Cargando…' : 'Selecciona tu institución'}</option>
                {instituciones.items.map((i) => (
                  <option key={i.codigo} value={i.codigo}>{i.descripcion}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <PasswordField id="pass" label="Contraseña" value={form.password} onChange={(v) => set('password', v)} invalid={bad('password')} describedBy="reqs">
          <ul className="reqs" id="reqs">
            {(Object.keys(PASSWORD_RULES) as PasswordRule[]).map((r) => (
              <li key={r} data-rule={r} className={PASSWORD_RULES[r](form.password) ? 'ok' : undefined}>
                {RULE_LABELS[r]}
              </li>
            ))}
          </ul>
        </PasswordField>

        <PasswordField id="pass2" label="Confirma tu contraseña" value={form.password2} onChange={(v) => set('password2', v)} invalid={bad('password2')} />

        <label className="check">
          <input type="checkbox" id="terms" checked={form.terms} onChange={(e) => set('terms', e.target.checked)} aria-invalid={bad('terms')} />
          <span>
            Acepto los <Link to="/terminos">términos y condiciones</Link> y la <Link to="/privacidad">política de privacidad</Link>. Entiendo que las respuestas son referenciales.
          </span>
        </label>

        {maestrosFailed && (
          <p className="error" role="alert">
            No pudimos cargar las opciones del formulario.{' '}
            <button className="btn btn--text" type="button" onClick={retryMaestros}>Reintentar</button>
          </p>
        )}

        <div id="f3Errors" className="form-errors" role="alert">
          {state.errors.map((t) => (
            <p className="error" key={t}>{t}</p>
          ))}
        </div>
        <button className="btn" type="submit" disabled={pending || maestrosFailed} aria-busy={pending}>Crear cuenta</button>
      </form>
    </section>
  );
}
