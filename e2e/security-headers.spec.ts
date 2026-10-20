import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { securityHeaders } from '../deploy/securityHeaders.ts';
import { E2E_API, E2E_ATTACHMENTS } from './keys';

const expected = securityHeaders(new URL(E2E_API).origin, E2E_ATTACHMENTS);

test('el documento se sirve con todas las cabeceras de seguridad', async ({ request }) => {
  const res = await request.get('/');
  const headers = res.headers();
  for (const [name, value] of Object.entries(expected)) {
    expect(headers[name.toLowerCase()], name).toBe(value);
  }
});

test('nginx.conf está alineado con las cabeceras de referencia', () => {
  const conf = readFileSync('deploy/nginx.conf', 'utf8');
  for (const [name, value] of Object.entries(expected)) {
    if (name === 'Content-Security-Policy') {
      expect(conf).toContain(value.replace(new URL(E2E_API).origin, '__API_ORIGIN__').split(E2E_ATTACHMENTS).join('__ATTACHMENTS_ORIGIN__'));
    } else {
      expect(conf, name).toContain(`add_header ${name} "${value}" always;`);
    }
  }
});

test('el bundle no incluye source maps ni la clave privada', async ({ request, page }) => {
  await page.goto('/');
  const scripts = await page.locator('script[src]').evaluateAll((els) => els.map((e) => (e as HTMLScriptElement).src));
  expect(scripts.length).toBeGreaterThan(0);
  for (const src of scripts) {
    const body = await (await request.get(src)).text();
    expect(body).not.toContain('sourceMappingURL');
    expect(body).not.toContain('PRIVATE KEY');
  }
});

test('la app no puede embeberse en un iframe (clickjacking)', async ({ page }) => {
  await page.goto('/');
  const blocked = await page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const f = document.createElement('iframe');
        f.src = '/';
        f.onload = () => {
          try {
            resolve(!f.contentDocument?.querySelector('#root'));
          } catch {
            resolve(true);
          }
        };
        document.body.appendChild(f);
        setTimeout(() => resolve(true), 3000);
      }),
  );
  expect(blocked).toBe(true);
});
