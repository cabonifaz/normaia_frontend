import { expect, test } from '@playwright/test';
import { decryptJwe, E2E_PASSWORD, fakeBackend, SESSION_TOKEN } from './fakeBackend';

test.describe('ingreso', () => {
  test('"Ya tengo cuenta" → login → app, con clave cifrada y token solo en memoria', async ({ page }) => {
    const captured = await fakeBackend(page);
    await page.goto('/');
    // En móvil el diseño oculta "Ya tengo cuenta" del header: el acceso es "Ingresa aquí" del hero.
    const header = page.getByRole('link', { name: 'Ya tengo cuenta' });
    await ((await header.isVisible()) ? header : page.locator('.hero-note').getByRole('link', { name: 'Ingresa aquí' })).click();
    await expect(page.getByRole('heading', { name: 'Ingresa a tu cuenta' })).toBeVisible();
    await expect(page.getByLabel('Correo electrónico')).toBeFocused();

    await page.getByLabel('Correo electrónico').fill('ana@correo.com');
    await page.getByLabel('Contraseña').fill(E2E_PASSWORD);
    await page.getByLabel('Contraseña').press('Enter');
    await expect(page).toHaveURL(/\/app$/);

    const login = captured.find((c) => c.path === '/auth/login')!;
    expect(login.body).toMatchObject({ usuario: 'ana@correo.com', ref: 'e2e-company-ref' });
    expect(JSON.stringify(login.body)).not.toContain(E2E_PASSWORD);
    expect(decryptJwe(String(login.body?.clave_acceso)).plaintext).toBe(E2E_PASSWORD);

    // El JWT nunca se persiste en el navegador
    const persisted = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + document.cookie);
    expect(persisted).not.toContain(SESSION_TOKEN);
  });

  test('credenciales inválidas: mensaje genérico, limpia la clave y no filtra el texto del servidor', async ({ page }) => {
    await fakeBackend(page);
    await page.goto('/ingresar');
    await page.getByLabel('Correo electrónico').fill('ana@correo.com');
    await page.getByLabel('Contraseña').fill('Equivocada1');
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page.getByRole('alert')).toHaveText('El correo o la contraseña no son correctos. Revísalos e inténtalo de nuevo.');
    await expect(page.getByLabel('Contraseña')).toHaveValue('');
    await expect(page.getByLabel('Contraseña')).toBeFocused();
    await expect(page.locator('body')).not.toContainText('acceso a empresa');
  });

  test('bloqueo temporal (429) indica cuánto esperar', async ({ page }) => {
    await fakeBackend(page);
    await page.goto('/ingresar');
    await page.getByLabel('Correo electrónico').fill('bloqueado@correo.com');
    await page.getByLabel('Contraseña').fill('Cualquiera1');
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page.getByRole('alert')).toContainText('Inténtalo de nuevo en 5 minutos');
  });

  test('/app sin sesión redirige al ingreso; tras recargar se pierde la sesión (solo memoria)', async ({ page }) => {
    await fakeBackend(page);
    await page.goto('/app');
    await expect(page).toHaveURL(/\/ingresar\?motivo=sesion-requerida$/);
    await page.getByLabel('Correo electrónico').fill('ana@correo.com');
    await page.getByLabel('Contraseña').fill(E2E_PASSWORD);
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page).toHaveURL(/\/app$/);
    await page.reload();
    await expect(page).toHaveURL(/\/ingresar/);
  });

  test('parámetros de URL desconocidos no se reflejan', async ({ page }) => {
    await page.goto('/ingresar?motivo=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E');
    await expect(page.getByRole('heading', { name: 'Ingresa a tu cuenta' })).toBeVisible();
    await expect(page.locator('.notice')).toHaveCount(0);
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
  });
});

test.describe('recuperar contraseña', () => {
  test('sin endpoint en el backend: lo comunica de forma clara (falla cerrado)', async ({ page }) => {
    await fakeBackend(page);
    await page.goto('/ingresar');
    await page.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).click();
    await expect(page.getByRole('heading', { name: 'Recupera tu contraseña' })).toBeVisible();
    await page.getByLabel('Correo electrónico').fill('ana@correo.com');
    await page.getByRole('button', { name: 'Enviar código' }).click();
    await expect(page.locator('#emailErr')).toContainText('La recuperación de contraseña aún no está disponible');
  });
});
