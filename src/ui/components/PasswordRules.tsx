import { PASSWORD_RULES, type PasswordRule } from '@/domain/registro/registro';

const RULE_LABELS: Record<PasswordRule, string> = {
  len: 'Mínimo 8 caracteres',
  num: 'Un número',
  up: 'Una mayúscula',
};

/** Requisitos de contraseña marcados en vivo (prototipo). */
export function PasswordRules({ id, value }: { id: string; value: string }) {
  return (
    <ul className="reqs" id={id}>
      {(Object.keys(PASSWORD_RULES) as PasswordRule[]).map((r) => (
        <li key={r} data-rule={r} className={PASSWORD_RULES[r](value) ? 'ok' : undefined}>
          {RULE_LABELS[r]}
        </li>
      ))}
    </ul>
  );
}
