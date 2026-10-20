import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import security from 'eslint-plugin-security';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'playwright-report', 'test-results'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  security.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-restricted-syntax': [
        'error',
        { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: 'Prohibido: riesgo de XSS. Renderiza texto o usa un sanitizador revisado.' },
        { selector: "MemberExpression[property.name=/^(innerHTML|outerHTML)$/]", message: 'Prohibido: riesgo de XSS.' },
        { selector: "CallExpression[callee.property.name='insertAdjacentHTML']", message: 'Prohibido: riesgo de XSS.' },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: 'No persistir datos sensibles en el navegador. La sesión vive en cookie HttpOnly.' },
        { name: 'sessionStorage', message: 'No persistir datos sensibles en el navegador.' },
      ],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      // Falsos positivos con índices numéricos y claves de uniones literales; TS strict
      // (noUncheckedIndexedAccess) ya acota esos accesos. Prototype pollution se evita no
      // indexando nunca con claves provenientes del usuario o del servidor.
      'security/detect-object-injection': 'off',
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'e2e/**', '*.config.ts', 'deploy/**'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'security/detect-non-literal-fs-filename': 'off', '@typescript-eslint/no-non-null-assertion': 'off', 'no-restricted-globals': 'off' },
  },
);
