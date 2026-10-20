import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { decryptJwe, fakeBackend, REG_TOKEN } from './fakeBackend';
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
    // Combo con búsqueda: escribir sin tildes y elegir con teclado
    const combo = page.getByRole('combobox', { name: 'Institución de estudios' });
    await combo.fill('ingenieria');
    await expect(page.getByRole('option')).toHaveCount(1);
    await combo.press('ArrowDown');
    await combo.press('Enter');
    await expect(combo).toHaveValue('Universidad Nacional de Ingeniería');
    await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
    await expect(page.locator('#reqs li.ok')).toHaveCount(3);
    await page.getByRole('button', { name: 'Mostrar' }).first().click();
    await expect(page.getByLabel('Contraseña', { exact: true })).toHaveAttribute('type', 'text');
    await page.getByLabel('Confirma tu contraseña').fill(PASSWORD);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Crear cuenta' }).click();

    await expect(page.getByRole('heading', { name: 'Tu cuenta está lista' })).toBeVisible();

    // --- Verificaciones de seguridad sobre lo que salió por la red ---
    const complete = captured.find((c) => c.path === '/auth/crear-usuario')!;
    const verify = captured.find((c) => c.path === '/auth/verificacion-codigo' && c.body?.accion === 'VALIDAR')!;
    const wirePassword = String(complete.body?.clave);
    expect(JSON.stringify(complete.body)).not.toContain(PASSWORD);
    expect(wirePassword.split('.')).toHaveLength(5);
    expect(decryptJwe(wirePassword)).toEqual({ header: { alg: 'RSA-OAEP-256', enc: 'A256GCM', kid: E2E_KID, cty: 'text/plain' }, plaintext: PASSWORD });
    expect(decryptJwe(String(verify.body?.codigo)).plaintext).toBe('1234');

    // Contrato Qamaq: NUM1 de los maestros 23/24 y RegistroBearer en crear-usuario
    expect(complete.body).toMatchObject({ idFormacion: 1, idInstitucionEstudios: 10, aceptaTerminos: true, fechaNacimiento: '1995-02-03' });
    expect(complete.headers.authorization).toBe(`Bearer ${REG_TOKEN}`);
    const maestros = captured.filter((c) => c.path === '/parametros/get_param_by_id_maestro');
    expect(maestros.map((m) => m.query.grp_id_maestro).sort()).toEqual(['23', '24']);

    for (const c of captured.filter((x) => x.method === 'POST')) {
      expect(c.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
      expect(c.headers['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);
      expect(c.headers.referer).toBeUndefined();
    }

    // Nada sensible persistido en el navegador ni en la URL
    const storage = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + location.href);
    expect(storage).not.toContain(PASSWORD);
    expect(storage).not.toContain('ana@correo.com');
    expect(storage).not.toContain(REG_TOKEN);
    expect(await page.evaluate(() => JSON.stringify(history.state))).not.toContain('ana@correo.com');

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
    await expect(page.locator('body')).not.toContainText('usuario id 42');
    await expect(page.locator('body')).not.toContainText('SP_VERIFICACION');
    await expect(page.getByLabel('Dígito 1')).toHaveAttribute('aria-invalid', 'true');
  });

  test('reenviar código se habilita al terminar la cuenta regresiva', async ({ page }) => {
    const captured = await fakeBackend(page);
    await page.clock.install();
    await page.goto('/registro');
    await page.getByLabel('Correo electrónico').fill('ana@correo.com');
    await page.getByRole('button', { name: 'Enviar código' }).click();
    await expect(page.locator('#resend')).toBeDisabled();
    await page.clock.runFor(31_000);
    await expect(page.locator('#resend')).toBeEnabled();
    await page.locator('#resend').click();
    await expect(page.locator('#timer')).toContainText('Código reenviado.');
    // Sin endpoint de reenvío: se vuelve a llamar accion=REGISTRAR
    expect(captured.filter((c) => c.path === '/auth/verificacion-codigo' && c.body?.accion === 'REGISTRAR')).toHaveLength(2);
  });

  test('dominio no habilitado: lo informa sin enviar código', async ({ page }) => {
    const captured = await fakeBackend(page);
    await page.goto('/registro');
    await page.getByLabel('Correo electrónico').fill('ana@gmail.com');
    await page.getByRole('button', { name: 'Enviar código' }).click();
    await expect(page.locator('#emailErr')).toHaveText('Este correo no pertenece a un dominio habilitado. Usa tu correo institucional o corporativo.');
    expect(captured.some((c) => c.path === '/auth/verificacion-codigo')).toBe(false);
  });

  test('correo ya registrado: lo dice claramente (no como dominio inválido)', async ({ page }) => {
    const captured = await fakeBackend(page);
    await page.goto('/registro');
    await page.getByLabel('Correo electrónico').fill('existe@correo.com');
    await page.getByRole('button', { name: 'Enviar código' }).click();
    await expect(page.locator('#emailErr')).toHaveText('Ya existe una cuenta con este correo. Ingresa con tu contraseña o recupérala.');
    expect(captured.some((c) => c.path === '/auth/verificacion-codigo')).toBe(false);
  });

  test('verificación vencida (15 min): mensaje claro y vuelta a pedir código con el correo conservado', async ({ page }) => {
    await fakeBackend(page, { expiredRegistration: true });
    await page.goto('/registro');
    await page.getByLabel('Correo electrónico').fill('ana@correo.com');
    await page.getByRole('button', { name: 'Enviar código' }).click();
    await page.getByLabel('Dígito 1').pressSequentially('1234');
    await page.getByRole('button', { name: 'Verificar correo' }).click();
    await page.getByLabel('Nombres').fill('Ana');
    await page.getByLabel('Apellidos').fill('Quispe');
    await page.locator('label.choice').first().click();
    await page.getByLabel('Fecha de nacimiento').fill('1995-02-03');
    const combo = page.getByRole('combobox', { name: 'Institución de estudios' });
    await combo.fill('lima');
    await combo.press('Enter');
    await page.getByLabel('Contraseña', { exact: true }).fill('Segura2026');
    await page.getByLabel('Confirma tu contraseña').fill('Segura2026');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page.locator('#f3Errors')).toContainText('Tu verificación de correo venció');
    await expect(page).toHaveURL(/\/registro$/); // no expulsa al login
    await page.getByRole('button', { name: 'Solicitar un código nuevo' }).click();
    await expect(page.getByRole('heading', { name: 'Crea tu cuenta' })).toBeVisible();
    await expect(page.getByLabel('Correo electrónico')).toHaveValue('ana@correo.com');
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
  for (const path of ['/', '/registro', '/ingresar', '/ingresar?motivo=sesion-expirada', '/recuperar']) {
    test(`sin violaciones en ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    });
  }
});
