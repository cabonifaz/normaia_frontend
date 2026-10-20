import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { E2E_PASSWORD, fakeBackend, SESSION_TOKEN } from './fakeBackend';
import { E2E_ATTACHMENTS } from './keys';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52]);

async function ingresar(page: Page) {
  await page.goto('/ingresar');
  await page.getByLabel('Correo electrónico').fill('ana@correo.com');
  await page.getByLabel('Contraseña').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/app$/);
}

function vigilarCsp(page: Page) {
  const v: string[] = [];
  page.on('console', (m) => /Content Security Policy|Trusted Type|Cross-Origin/i.test(m.text()) && v.push(m.text()));
  return v;
}

const sidebar = (page: Page) => page.getByRole('complementary', { name: 'Conversaciones' });

/** En móvil el historial vive en un panel deslizable: abrirlo antes de usarlo. */
async function historial(page: Page) {
  const abrir = page.getByRole('button', { name: 'Abrir historial de consultas' });
  if (await abrir.isVisible()) await abrir.click();
  return sidebar(page);
}

test.describe('chat RAG (usuario final)', () => {
  test('consulta completa con streaming, historial del área y seguridad de la petición', async ({ page }) => {
    const captured = await fakeBackend(page);
    const csp = vigilarCsp(page);
    await ingresar(page);

    await expect(page.getByRole('heading', { name: 'Hola, Ana. ¿Qué norma necesitas hoy?' })).toBeVisible();
    await expect((await historial(page)).getByRole('button', { name: 'Dotación de agua IS.010', exact: true })).toBeVisible();
    await expect(sidebar(page).getByText('De otra área (no debe verse)')).toHaveCount(0);
    if (await page.getByRole('button', { name: 'Cerrar panel de conversaciones' }).isVisible()) await page.getByRole('button', { name: 'Cerrar panel de conversaciones' }).click();

    await page.getByLabel('Escribe tu consulta').fill('¿Cuántas salidas necesita un centro comercial?');
    await page.getByLabel('Escribe tu consulta').press('Enter');

    const resp = page.getByRole('article', { name: 'Respuesta de Norma IA' });
    await expect(resp).toContainText('un centro comercial requiere 2 salidas por nivel.');
    await expect(resp.locator('.norma-code', { hasText: 'A.130' })).toBeVisible();
    await expect(resp.getByRole('table')).toBeVisible();
    await expect(resp).not.toContainText('Según la Según'); // acumulado, sin duplicar
    await expect((await historial(page)).locator('li[aria-current="true"]')).toContainText('Salidas en centro comercial');
    if (await page.getByRole('button', { name: 'Cerrar panel de conversaciones' }).isVisible()) await page.getByRole('button', { name: 'Cerrar panel de conversaciones' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Salidas en centro comercial');

    const chatReq = captured.find((c) => c.path === '/rag/chat-streaming')!;
    expect(chatReq.headers.authorization).toBe(`Bearer ${SESSION_TOKEN}`);
    expect(chatReq.body).toMatchObject({ message: '¿Cuántas salidas necesita un centro comercial?', user_id: 4049, company_id: 1, area_id: 7, chat_id: null, tts: false });
    expect(typeof chatReq.body?.request_timezone).toBe('string');
    // El SECRET_KEY que trae company-areas nunca se reenvía
    expect(captured.some((c) => JSON.stringify(c.body ?? {}).includes('NO-DEBE-USARSE') || JSON.stringify(c.query).includes('NO-DEBE-USARSE'))).toBe(false);

    // Segunda consulta en el mismo chat: reutiliza el chat_id asignado
    await page.getByLabel('Escribe tu consulta').fill('¿Y el ancho mínimo?');
    await page.getByRole('button', { name: 'Enviar consulta' }).click();
    await expect(page.getByRole('article', { name: 'Respuesta de Norma IA' })).toHaveCount(2);
    const segunda = captured.filter((c) => c.path === '/rag/chat-streaming')[1]!;
    expect(segunda.body?.chat_id).toBe(chatReq ? 300 : null);

    const persisted = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + document.cookie);
    expect(persisted).not.toContain(SESSION_TOKEN);
    expect(persisted).not.toContain('centro comercial'); // la conversación no se persiste en el navegador
    expect(csp).toEqual([]);
  });

  test('abre una consulta del historial con su imagen adjunta (S3 permitido por CSP)', async ({ page }) => {
    const captured = await fakeBackend(page);
    const csp = vigilarCsp(page);
    await ingresar(page);
    await (await historial(page)).getByRole('button', { name: 'Dotación de agua IS.010', exact: true }).click();
    await expect(page.getByText('¿Cómo se calcula la dotación de agua?')).toBeVisible();
    const img = page.getByRole('img', { name: 'Imagen adjunta 1', exact: true });
    await expect(img).toHaveAttribute('src', new RegExp(`^${E2E_ATTACHMENTS}`));
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(1); // cargó bajo la CSP
    await expect(page.getByRole('link', { name: 'Abrir imagen adjunta 1 en una pestaña nueva' })).toHaveAttribute('rel', 'noopener noreferrer');
    const req = captured.find((c) => c.path === '/messages/chat')!;
    expect(req.body).toEqual({ chat_id: '201', company_id: 1, area_id: 7 });
    expect(csp).toEqual([]);
  });

  test('imagen del historial con URL caducada: casilla "no disponible", sin romper la retícula', async ({ page }) => {
    await fakeBackend(page, { expiredAttachments: true });
    await ingresar(page);
    await (await historial(page)).getByRole('button', { name: 'Dotación de agua IS.010', exact: true }).click();
    await expect(page.getByRole('img', { name: 'Imagen adjunta 1 no disponible' })).toBeVisible();
  });

  test('adjuntar imagen: URL prefirmada, PUT a S3 sin token y consulta VLM', async ({ page }) => {
    const captured = await fakeBackend(page);
    const csp = vigilarCsp(page);
    await ingresar(page);
    await page.locator('input[type="file"]').setInputFiles({ name: '../Plano Ñaña.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByRole('img', { name: /Adjunto 1/ })).toBeVisible();
    await page.getByLabel('Escribe tu consulta').fill('¿Cumple este plano con la A.130?');
    await page.getByRole('button', { name: 'Enviar consulta' }).click();
    await expect(page.getByRole('article', { name: 'Respuesta de Norma IA' })).toContainText('2 salidas');

    const urls = captured.find((c) => c.path === '/messages/attachment-upload-urls')!;
    expect(urls.body).toMatchObject({ company_id: 1, area_id: 7, filenames: ['Plano-Nana-1.png'] });
    const put = captured.find((c) => c.method === 'PUT')!;
    expect(put.headers.authorization).toBeUndefined(); // el JWT nunca viaja a S3
    const vlm = captured.find((c) => c.path === '/rag/vlm-streaming')!;
    expect(vlm.body).toMatchObject({ filenames: ['Plano-Nana-1.png'], created_at: urls.body?.timestamp, vlm_mode: 'vlm_qa_over_text', user_id: 4049 });
    expect(csp).toEqual([]);
  });

  test('rechaza un archivo que no es imagen aunque tenga extensión .png', async ({ page }) => {
    await fakeBackend(page);
    await ingresar(page);
    await page.locator('input[type="file"]').setInputFiles({ name: 'malicioso.png', mimeType: 'image/png', buffer: Buffer.from('<svg onload=alert(1)>') });
    await expect(page.getByRole('alert')).toHaveText('Solo se aceptan imágenes PNG, JPG o WEBP.');
  });

  test('renombrar y eliminar una consulta', async ({ page }) => {
    const captured = await fakeBackend(page);
    await ingresar(page);
    await (await historial(page)).getByRole('button', { name: 'Opciones de “Dotación de agua IS.010”' }).click();
    await page.getByRole('menuitem', { name: 'Renombrar' }).click();
    await page.getByLabel('Nuevo título de la consulta').fill('Agua edificio multifamiliar');
    await page.getByLabel('Nuevo título de la consulta').press('Enter');
    await expect(sidebar(page).getByRole('button', { name: 'Agua edificio multifamiliar', exact: true })).toBeVisible();
    expect(captured.find((c) => c.method === 'PATCH')?.body).toEqual({ titulo: 'Agua edificio multifamiliar' });

    await sidebar(page).getByRole('button', { name: 'Opciones de “Agua edificio multifamiliar”' }).click();
    await page.getByRole('menuitem', { name: 'Eliminar' }).click();
    const dialog = page.getByRole('dialog', { name: '¿Eliminar esta consulta?' });
    await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Eliminar' }).click();
    await expect(sidebar(page).getByText('Agua edificio multifamiliar')).toHaveCount(0);
    expect(captured.some((c) => c.method === 'DELETE' && c.path === '/chats/201')).toBe(true);
  });

  test('error del modelo: mensaje propio, sin filtrar el detalle del servidor', async ({ page }) => {
    await fakeBackend(page, { chatError: true });
    await ingresar(page);
    await page.getByLabel('Escribe tu consulta').fill('Pregunta');
    await page.getByLabel('Escribe tu consulta').press('Enter');
    await expect(page.getByText('No pudimos completar la respuesta. Inténtalo de nuevo.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Bedrock');
    await expect(page.locator('body')).not.toContainText('SP_RAG_LOG');
  });

  test('usuario sin área asignada ve un estado claro', async ({ page }) => {
    await fakeBackend(page, { areas: [] });
    await ingresar(page);
    await expect(page.getByRole('heading', { name: 'Tu cuenta aún no tiene un área de consulta' })).toBeVisible();
  });

  test('cerrar sesión: vuelve al ingreso y "atrás" no reabre el chat', async ({ page }) => {
    const captured = await fakeBackend(page);
    await ingresar(page);
    await page.getByRole('button', { name: /menú de cuenta/ }).click();
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/\/ingresar\?motivo=sesion-cerrada$/);
    await expect(page.getByRole('status')).toHaveText('Cerraste sesión correctamente.');
    expect(captured.find((c) => c.path === '/auth/logout')?.body).toEqual({ user_id: 4049 });
    await page.goBack();
    await expect(page).toHaveURL(/\/ingresar/);
  });

  test('móvil: el historial es un panel deslizable', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'solo móvil');
    await fakeBackend(page);
    await ingresar(page);
    await expect(sidebar(page)).toBeHidden();
    await page.getByRole('button', { name: 'Abrir historial de consultas' }).click();
    await expect(sidebar(page)).toBeVisible();
    await sidebar(page).getByRole('button', { name: 'Dotación de agua IS.010', exact: true }).click();
    await expect(sidebar(page)).toBeHidden();
    await expect(page.getByText('¿Cómo se calcula la dotación de agua?')).toBeVisible();
  });

  test('home: el compositor está sobre las sugerencias y no las tapa; el logo vuelve al home sin cerrar sesión', async ({ page }) => {
    await fakeBackend(page);
    await ingresar(page);
    const composer = await page.locator('.composer').boundingBox();
    const primera = page.getByRole('list', { name: 'O empieza con una consulta frecuente' }).getByRole('button').first();
    const caja = await primera.boundingBox();
    expect(composer && caja && composer.y + composer.height <= caja.y).toBe(true);
    // La última sugerencia es alcanzable y clicable (nada fijo encima)
    const ultima = page.getByRole('list', { name: 'O empieza con una consulta frecuente' }).getByRole('button').last();
    await ultima.scrollIntoViewIfNeeded();
    await ultima.click({ trial: true });

    await (await historial(page)).getByRole('button', { name: 'Dotación de agua IS.010', exact: true }).click();
    await expect(page.getByText('¿Cómo se calcula la dotación de agua?')).toBeVisible();
    await (await historial(page)).getByRole('button', { name: 'Norma IA, inicio de consultas' }).click();
    await expect(page.getByRole('heading', { name: /Hola, Ana/ })).toBeVisible();
    await expect(page).toHaveURL(/\/app$/);

    // La landing con sesión no aparenta "sesión cerrada"
    await page.evaluate(() => history.pushState({}, '', '/'));
    await page.evaluate(() => window.dispatchEvent(new PopStateEvent('popstate')));
    await expect(page.getByRole('link', { name: 'Ir a mis consultas' })).toBeVisible();
    await page.getByRole('link', { name: 'Ir a mis consultas' }).click();
    await expect(page.getByRole('heading', { name: /Hola, Ana/ })).toBeVisible();
  });

  test('accesibilidad WCAG 2.1 AA en el chat', async ({ page }) => {
    await fakeBackend(page);
    await ingresar(page);
    await page.getByLabel('Escribe tu consulta').fill('¿Cuántas salidas?');
    await page.getByLabel('Escribe tu consulta').press('Enter');
    await expect(page.getByRole('article', { name: 'Respuesta de Norma IA' })).toContainText('por nivel');
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => `${n.target.join(' ')} → ${n.failureSummary}`).join(' | ')}`)).toEqual([]);
  });
});
