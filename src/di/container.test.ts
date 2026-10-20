import { afterEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from './container';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2ln';

afterEach(() => vi.unstubAllGlobals());

describe('composición: manejo de 401', () => {
  it('un 401 sin sesión (registro) NO expulsa al usuario', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json(401, { error: { result: { idTipoMensaje: 1, mensaje: 'Token requerido' } } }))));
    const onUnauthorized = vi.fn();
    const deps = createContainer({ onUnauthorized });
    await expect(deps.maestros.obtener('INSTITUCION')).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('un 401 con sesión activa sí la cierra y avisa', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(200, { token: JWT, status: 'success' }))
      .mockResolvedValueOnce(json(401, {}));
    vi.stubGlobal('fetch', fetchMock);
    const onUnauthorized = vi.fn();
    const deps = createContainer({ onUnauthorized });
    await deps.auth.iniciarSesion({ email: 'ana@correo.com', password: 'Segura123' });
    await expect(deps.maestros.obtener('FORMACION')).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(onUnauthorized).toHaveBeenCalledOnce();
    // El maestro se pidió con el JWT de sesión
    const headers = fetchMock.mock.calls[1]![1]!.headers as Headers;
    expect(headers.get('Authorization')).toBe(`Bearer ${JWT}`);
  });

  it('el login fallido (401) no dispara "sesión expirada"', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json(401, {}))));
    const onUnauthorized = vi.fn();
    const deps = createContainer({ onUnauthorized });
    await expect(deps.auth.iniciarSesion({ email: 'ana@correo.com', password: 'Mala1234' })).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
