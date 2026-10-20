import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AppError, userMessage } from '@/application/errors';
import { createHttpClient } from './httpClient';

const onUnauthorized = vi.fn();
const request = createHttpClient({ baseUrl: 'https://api.test.local/api/v1/', timeoutMs: 5000 }, { onUnauthorized });

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' }, ...init });

function mockFetch(res: Response | Error) {
  const fn = vi.fn<typeof fetch>(() => (res instanceof Error ? Promise.reject(res) : Promise.resolve(res)));
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
});

describe('request', () => {
  it('envía cabeceras de seguridad y opciones de fetch endurecidas', async () => {
    document.cookie = 'XSRF-TOKEN=abcdefghijklmnop1234';
    const fetchMock = mockFetch(json({ ok: true }));
    await request('/x', { method: 'POST', body: { a: 1 }, schema: z.object({ ok: z.boolean() }) });

    const [url, init] = fetchMock.mock.calls[0]!;
    const headers = init!.headers as Headers;
    expect(url).toBe('https://api.test.local/api/v1/x');
    expect(init).toMatchObject({ credentials: 'include', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', mode: 'cors' });
    expect(headers.get('X-XSRF-TOKEN')).toBe('abcdefghijklmnop1234');
    expect(headers.get('X-Request-Id')).toMatch(/^[0-9a-f-]{36}$/);
    expect(headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('no envía CSRF ni Idempotency-Key en GET', async () => {
    document.cookie = 'XSRF-TOKEN=abcdefghijklmnop1234';
    const fetchMock = mockFetch(json({}));
    await request('/x', { schema: z.object({}) });
    const headers = fetchMock.mock.calls[0]![1]!.headers as Headers;
    expect(headers.has('X-XSRF-TOKEN')).toBe(false);
    expect(headers.has('Idempotency-Key')).toBe(false);
  });

  it.each(['//evil.com/x', 'https://evil.com', '/../admin', 'x'])('rechaza rutas peligrosas: %s', async (path) => {
    mockFetch(json({}));
    await expect(request(path, { schema: z.any() })).rejects.toThrow(/inválida/);
  });

  it('rechaza respuestas que no cumplen el contrato', async () => {
    mockFetch(json({ userId: 1, isAdmin: true }));
    await expect(request('/x', { schema: z.object({ userId: z.string() }) })).rejects.toMatchObject({ kind: 'contract' });
  });

  it('nunca expone el mensaje crudo del servidor', async () => {
    mockFetch(json({ message: 'SQLException at users.email', code: 'DB_ERROR' }, { status: 500 }));
    const err = await request('/x', { schema: z.any() }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(userMessage(err)).not.toMatch(/SQL/);
    expect((err as AppError).code).toBe('DB_ERROR');
  });

  it('descarta códigos de error con formato no permitido', async () => {
    mockFetch(json({ code: '<img src=x onerror=alert(1)>' }, { status: 400 }));
    await expect(request('/x', { schema: z.any() })).rejects.toMatchObject({ kind: 'validation', code: null });
  });

  it('mapea 429 con Retry-After', async () => {
    mockFetch(json({}, { status: 429, headers: { 'content-type': 'application/json', 'retry-after': '30' } }));
    await expect(request('/x', { schema: z.any() })).rejects.toMatchObject({ kind: 'rate_limited', retryAfter: 30 });
  });

  it('notifica 401 a la composición', async () => {
    mockFetch(json({}, { status: 401 }));
    await expect(request('/x', { schema: z.any() })).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('ignora cuerpos que no son JSON', async () => {
    mockFetch(new Response('<html>proxy error</html>', { status: 200, headers: { 'content-type': 'text/html' } }));
    await expect(request('/x', { schema: z.object({}) })).rejects.toMatchObject({ kind: 'contract' });
  });

  it('error de red se normaliza', async () => {
    mockFetch(new TypeError('Failed to fetch'));
    await expect(request('/x', { schema: z.any() })).rejects.toMatchObject({ kind: 'network', status: 0 });
  });
});
