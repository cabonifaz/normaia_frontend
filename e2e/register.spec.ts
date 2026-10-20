import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { decryptJwe, fakeBackend } from './fakeBackend';
import { E2E_KID } from './keys';

const PASSWORD = 'Segura2026';

test.describe('registro', () => {
  test('flujo completo desde el hero con datos sensibles cifrados', async ({ page }) => {
    const captured = await fakeBackend(page);
    const cspViolations: string[] = [];
    page.on('console', (m) => {
      if (/Content Security Policy|Trusted Type/i.test(m.text())) cspViolations.push(m.text());
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('La norma, a una pregunta de distancia.');
    await page.locator('#heroEmail').fill('ana@correo.com');
    await page.locator('.hero-form').getByRole('button', { name: 'Crear cuenta' }).click();

    await expect(page.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible();
    await expect(page.locator('#sentTo')).toHaveText('ana@correo.com');
    await expect(page.locator('#resend')).toBeDisabled();
    await expect(page.locator('.progress li[data-step="1"]')).toHaveAttribute('data-state', 'done');
    await expect(page.locator('.progress li[data-step="2"]')).toHaveAttribute('aria-current', 'step');

    // Código: escribir con avance automático
    await page.getByLabel('Dígito 1').pressSequentially('1234');
    await page.getByRole('button', { name: 'Verificar correo' }).click();

    await expect(page.getByRole('heading', { name: 'Completa tu perfil' })).toBeVisible();
    await page.getByLabel('Nombres').fill('Ana');
    await page.getByLabel('Apellidos').fill('Quispe');
    await page.locator('label.choice', { hasText: 'Ingeniero civil' }).click();
    await page.getByLabel('Fecha de nacimiento').fill('1995-02-03');
    await page.getByLabel('Institución de estudios').selectOption('Universidad Nacional de Ingeniería');
    await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
    await expect(page.locator('#reqs li.ok')).toHaveCount(3);
    await page.getByRole('button', { name: 'Mostrar' }).first().click();
    await expect(page.getByLabel('Contraseña', { exact: true })).toHaveAttribute('type', 'text');
    await page.getByLabel('Confirma tu contraseña').fill(PASSWORD);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Crear cuenta' }).click();

    await expect(page.getByRole('heading', { name: 'Tu cuenta está lista' })).toBeVisible();

    // --- Verificaciones de seguridad sobre lo que salió por la red ---
    const complete = captured.find((c) => c.path === '/auth/register/complete')!;
    const verify = captured.find((c) => c.path === '/auth/register/verify')!;
    const wirePassword = String(complete.body?.password);
    expect(JSON.stringify(complete.body)).not.toContain(PASSWORD);
    expect(wirePassword.split('.')).toHaveLength(5);
    expect(decryptJwe(wirePassword)).toEqual({ header: { alg: 'RSA-OAEP-256', enc: 'A256GCM', kid: E2E_KID, cty: 'text/plain' }, plaintext: PASSWORD });
    expect(decryptJwe(String(verify.body?.code)).plaintext).toBe('1234');

    expect(complete.body).toMatchObject({ formacion: 'ING_CIVIL', institucion: 'UNI' });

    for (const c of captured.filter((x) => x.method === 'POST')) {
      expect(c.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
      expect(c.headers['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);
      expect(c.headers.referer).toBeUndefined();
    }

    // Nada sensible persistido en el navegador ni en la URL
    const storage = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + location.href);
    expect(storage).not.toContain(PASSWORD);
    expect(storage).not.toContain('ana@correo.com');
    expect(storage).not.toContain('reg_e2e_');
    expect(await page.evaluate(() => history.state?.usr ?? null)).toBeNull();

    expect(cspViolations).toEqual([]);
  });

  test('código incorrecto: mensaje propio, sin filtrar el del servidor', async ({ page }) => {
    await fakeBackend(page);
    await page.goto('/registro');
    await page.getByLabel('Correo electrónico').fill('ana@correo.com');
    await page.getByRole('button', { name: 'Enviar código' }).click();
    await page.getByLabel('Dígito 1').pressSequentially('9999');
    await page.getByRole('button', { name: 'Verificar correo' }).click();
    await expect(page.locator('#codeErr')).toHaveText('El código no coincide. Revísalo o pide uno nuevo.');
    await expect(page.locator('body')).not.toContainText('user id 42');
    await expect(page.getByLabel('Dígito 1')).toHaveAttribute('aria-invalid', 'true');
  });

  test('reenviar código se habilita al terminar la cuenta regresiva', async ({ page }) => {
    const captured = await fakeBackend(page, { resendAfter: 2 });
    await page.goto('/registro');
    await page.getByLabel('Correo electrónico').fill('ana@correo.com');
    await page.getByRole('button', { name: 'Enviar código' }).click();
    await expect(page.locator('#resend')).toBeDisabled();
    await expect(page.locator('#resend')).toBeEnabled({ timeout: 5000 });
    await page.locator('#resend').click();
    await expect(page.locator('#timer')).toContainText('Código reenviado.');
    expect(captured.filter((c) => c.path === '/auth/register/code/resend')).toHaveLength(1);
  });

  test('perfil vacío muestra todos los errores del prototipo', async ({ page }) => {
    await fakeBackend(page);
    await page.goto('/registro');
    await page.getByLabel('Correo electrónico').fill('ana@correo.com');
    await page.getByRole('button', { name: 'Enviar código' }).click();
    await page.getByLabel('Dígito 1').pressSequentially('1234');
    await page.getByRole('button', { name: 'Verificar correo' }).click();
    await expect(page.locator('label.choice')).toHaveCount(3);
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page.locator('#f3Errors .error')).toHaveCount(8);
  });

  test('si el maestro falla, bloquea el envío y permite reintentar', async ({ page }) => {
    await fakeBackend(page, { failMaestros: true });
    await page.goto('/registro');
    await page.getByLabel('Correo electrónico').fill('ana@correo.com');
    await page.getByRole('button', { name: 'Enviar código' }).click();
    await page.getByLabel('Dígito 1').pressSequentially('1234');
    await page.getByRole('button', { name: 'Verificar correo' }).click();
    await expect(page.getByText('No pudimos cargar las opciones del formulario.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Crear cuenta' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();
  });

  test('XSS reflejado: el correo se muestra como texto, no como HTML', async ({ page }) => {
    await fakeBackend(page);
    let dialog = false;
    page.on('dialog', async (d) => {
      dialog = true;
      await d.dismiss();
    });
    await page.goto('/registro');
    // Pasa la regex de email pero contiene markup
    const payload = '"><img/src=x/onerror=alert(1)>@x.co';
    await page.getByLabel('Correo electrónico').fill(payload);
    await page.getByRole('button', { name: 'Enviar código' }).click();
    await expect(page.locator('#sentTo')).toHaveText(payload.toLowerCase());
    await expect(page.locator('#sentTo img')).toHaveCount(0);
    expect(dialog).toBe(false);
  });
});

test.describe('accesibilidad (WCAG 2.1 AA)', () => {
  for (const path of ['/', '/registro']) {
    test(`sin violaciones en ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    });
  }
});
