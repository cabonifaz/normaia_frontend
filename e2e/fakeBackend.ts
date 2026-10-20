import { constants, createDecipheriv, createPrivateKey, privateDecrypt } from 'node:crypto';
import type { Page, Route } from '@playwright/test';
import { E2E_API, E2E_ATTACHMENTS, e2eKeys } from './keys';

/** Descifra un JWE compacto RSA-OAEP-256/A256GCM, como lo haría el backend. */
export function decryptJwe(jwe: string): { header: Record<string, string>; plaintext: string } {
  const [h, ek, iv, ct, tag] = jwe.split('.') as [string, string, string, string, string];
  const key = createPrivateKey(e2eKeys().privatePem);
  const cek = privateDecrypt({ key, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(ek, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', cek, Buffer.from(iv, 'base64url'));
  decipher.setAAD(Buffer.from(h, 'ascii'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ct, 'base64url')), decipher.final()]).toString('utf8');
  return { header: JSON.parse(Buffer.from(h, 'base64url').toString('utf8')) as Record<string, string>, plaintext };
}

export interface Captured {
  path: string;
  method: string;
  headers: Record<string, string>;
  body: Record<string, unknown> | null;
  query: Record<string, string>;
}

interface Options {
  validCode?: string;
  failMaestros?: boolean;
  /** Dominio que el backend rechaza en validar-correo. */
  blockedDomain?: string;
  /** Simula que el RegistroBearer venció (15 min) al crear la cuenta. */
  expiredRegistration?: boolean;
  /** Áreas del usuario (por defecto NORMA/GENERAL). [] = usuario sin área. */
  areas?: { ID_EMPRESA: number; EMPRESA: string; ID_AREA: number; AREA: string }[];
  /** El stream del chat responde con un evento de error. */
  chatError?: boolean;
  /** Las URLs prefirmadas de S3 del historial ya caducaron. */
  expiredAttachments?: boolean;
}

const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

export const E2E_PASSWORD = 'Norma2026';
const fakeJwt = (sub: string) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ sub })).toString('base64url')}.c2ln`;
export const REG_TOKEN = fakeJwt('registro-e2e');
const sessionClaims = { ID_USUARIO: 4049, USUARIO: 'ana@correo.com', NOMBRES: 'Ana', APELLIDOS: 'Quispe', ID_TIPO_ROL: 3, ROL: 'Usuario', company_areas: [] };
export const SESSION_TOKEN = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(sessionClaims)).toString('base64url')}.c2ln`;

export const RESPUESTA_E2E = 'Según la **A.130**, un centro comercial requiere **2 salidas** por nivel.\n\n| Aforo | Salidas |\n| --- | --- |\n| Hasta 500 | 2 |';

/** SSE como el backend real: texto ACUMULADO en cada text_chunk. */
function sse(chatId: number, nuevo: boolean, error = false) {
  const ev = (o: unknown) => `data: ${JSON.stringify(o)}\n\n`;
  let out = ev({ type: 'progress', message: 'Buscando en el reglamento…' }) + ev({ type: 'metadata', chat_id: chatId });
  if (nuevo) out += ev({ type: 'chat_created', chat: { ID_CHAT: chatId, ID_AREA: 7, ID_EMPRESA: 1, TITULO: 'Salidas en centro comercial', ULTIMO_MENSAJE_FECHA: new Date().toISOString(), ID_ESTADO_REGISTRO: 1 } });
  if (error) return out + ev({ type: 'error', message: 'Bedrock throttling (SP_RAG_LOG id 77)' });
  out += ev({ type: 'assistant_metadata', sender: 1, created_at: String(Date.now()) });
  const palabras = RESPUESTA_E2E.split(' ');
  for (let i = 1; i <= palabras.length; i++) out += ev({ type: 'text_chunk', content: palabras.slice(0, i).join(' ') });
  return out + ev({ type: 'audio_chunk', content: 'AAAA' }) + ev({ type: 'complete' });
}

const ok = (data: unknown) => ({ data, result: { idTipoMensaje: 2, mensaje: 'OK' } });
const fail = (status: number, mensaje: string) => ({ error: { result: { idTipoMensaje: 1, mensaje } }, status_code: status });

/** Backend simulado con el contrato Qamaq (Swagger) y CORS estricto (origen exacto + credenciales). */
export async function fakeBackend(page: Page, opts: Options = {}) {
  const validCode = opts.validCode ?? '1234';
  const captured: Captured[] = [];
  const cors = {
    'access-control-allow-origin': 'http://localhost:4173',
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': 'content-type, authorization, x-request-id, idempotency-key, x-xsrf-token',
    'access-control-allow-methods': 'GET, POST, PATCH, DELETE',
    // Sin esto el navegador oculta Retry-After al front (requisito para el backend real).
    'access-control-expose-headers': 'retry-after, x-request-id',
    'cross-origin-resource-policy': 'cross-origin',
    vary: 'Origin',
  };
  const json = (route: Route, status: number, body: unknown) =>
    route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });

  // PUT directo a S3 (URL prefirmada)
  await page.route(`${E2E_ATTACHMENTS}/**`, async (route) => {
    const req = route.request();
    captured.push({ path: new URL(req.url()).pathname, method: req.method(), headers: await req.allHeaders(), body: null, query: {} });
    if (req.method() === 'GET') {
      // URL prefirmada caducada → S3 responde 403
      if (opts.expiredAttachments) return route.fulfill({ status: 403, contentType: 'application/xml', body: '<Error><Code>AccessDenied</Code></Error>' });
      return route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from(PNG_1PX, 'base64') });
    }
    return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': 'http://localhost:4173' } });
  });

  let siguienteChat = 300;
  const chats = [
    { ID_CHAT: 201, ID_AREA: 7, ID_EMPRESA: 1, TITULO: 'Dotación de agua IS.010', ULTIMO_MENSAJE_FECHA: '2026-10-19T10:00:00' },
    { ID_CHAT: 202, ID_AREA: 99, ID_EMPRESA: 1, TITULO: 'De otra área (no debe verse)', ULTIMO_MENSAJE_FECHA: '2026-10-20T10:00:00' },
  ];

  await page.route(`${E2E_API}/**`, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const url = new URL(req.url());
    const path = url.pathname.replace('/api/v1', '');
    const body = req.postData() ? (JSON.parse(req.postData()!) as Record<string, unknown>) : null;
    const headers = await req.allHeaders();
    captured.push({ path, method: req.method(), headers, body, query: Object.fromEntries(url.searchParams) });
    const bearer = headers.authorization?.replace(/^Bearer /, '');

    const auth = () => bearer === SESSION_TOKEN;
    const chatPath = /^\/chats\/(\d+)$/.exec(path);
    if (chatPath) {
      if (!auth()) return json(route, 401, fail(401, 'Token inválido'));
      const id = Number(chatPath[1]);
      const c = chats.find((x) => x.ID_CHAT === id);
      if (!c) return json(route, 404, fail(404, 'no existe'));
      if (req.method() === 'PATCH') c.TITULO = String(body?.titulo);
      if (req.method() === 'DELETE') chats.splice(chats.indexOf(c), 1);
      return json(route, 200, { ID_TIPO_MENSAJE: 2, MENSAJE: 'OK' });
    }

    switch (path) {
      case '/auth/company-areas':
        if (!auth()) return json(route, 401, fail(401, 'Token inválido'));
        return json(route, 200, { company_areas: (opts.areas ?? [{ ID_EMPRESA: 1, EMPRESA: 'NORMA', ID_AREA: 7, AREA: 'GENERAL' }]).map((a) => ({ ...a, LOGO: null, SECRET_KEY: 'NO-DEBE-USARSE' })), result: { idTipoMensaje: 2, mensaje: 'ok' } });
      case '/chats/get_chats':
        if (!auth()) return json(route, 401, fail(401, 'Token inválido'));
        return json(route, 200, { chats, result: { idTipoMensaje: 2, mensaje: 'ok' } });
      case '/messages/chat': {
        if (!auth()) return json(route, 401, fail(401, 'Token inválido'));
        if (body?.chat_id !== '201') return json(route, 200, { messages: [], last_evaluated_key: null });
        return json(route, 200, {
          messages: [
            { id: 'm1', chat_id: '201', created_at: '1760868000000', sender: 0, message: '¿Cómo se calcula la dotación de agua?', attachment_keys: null, attachment_urls: [`${E2E_ATTACHMENTS}/1/7/plano.png?X-Amz-Signature=abc`] },
            { id: 'm2', chat_id: '201', created_at: '1760868005000', sender: 1, message: 'Según la **IS.010**, la dotación depende del uso.', attachment_keys: null, attachment_urls: null },
          ],
          last_evaluated_key: null,
        });
      }
      case '/messages/attachment-upload-urls':
        if (!auth()) return json(route, 401, fail(401, 'Token inválido'));
        return json(route, 200, { uploads: (body?.filenames as string[]).map((n) => ({ presigned_url: `${E2E_ATTACHMENTS}/1/7/${body?.timestamp}/${n}?X-Amz-Signature=e2e`, s3_key: `1/7/${n}`, document_name: n })) });
      case '/rag/chat-streaming':
      case '/rag/vlm-streaming': {
        if (!auth()) return json(route, 401, fail(401, 'Token inválido'));
        const nuevo = body?.chat_id === null;
        const id = nuevo ? siguienteChat++ : Number(body?.chat_id);
        if (nuevo) chats.unshift({ ID_CHAT: id, ID_AREA: 7, ID_EMPRESA: 1, TITULO: 'Salidas en centro comercial', ULTIMO_MENSAJE_FECHA: new Date().toISOString() });
        return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'text/event-stream', 'cache-control': 'no-cache' }, body: sse(id, nuevo, opts.chatError) });
      }
      case '/auth/logout':
        return json(route, 200, { result: { idTipoMensaje: 2, mensaje: 'ok' } });
      case '/parametros/get_param_by_id_maestro': {
        const grp = url.searchParams.get('grp_id_maestro');
        if (grp === '23')
          return json(route, 200, ok([
            { ID_PARAMETRO: 901, ID_MAESTRO: 0, ID_SUB_MAESTRO: null, NUM1: 1, NUM2: 0, NUM3: 0, STRING1: 'Ingeniero civil', STRING2: '', STRING3: '' },
            { ID_PARAMETRO: 902, ID_MAESTRO: 0, ID_SUB_MAESTRO: null, NUM1: 2, NUM2: 0, NUM3: 0, STRING1: 'Arquitecto', STRING2: '', STRING3: '' },
            { ID_PARAMETRO: 903, ID_MAESTRO: 0, ID_SUB_MAESTRO: null, NUM1: 3, NUM2: 0, NUM3: 0, STRING1: 'Estudiante', STRING2: '', STRING3: '' },
          ]));
        if (grp === '24')
          return opts.failMaestros
            ? json(route, 503, fail(503, 'SP_PARAMETROS_LST timeout'))
            : json(route, 200, ok([
                { ID_PARAMETRO: 951, ID_MAESTRO: 0, ID_SUB_MAESTRO: null, NUM1: 10, NUM2: 0, NUM3: 0, STRING1: 'Universidad Nacional de Ingeniería', STRING2: '', STRING3: '' },
                { ID_PARAMETRO: 952, ID_MAESTRO: 0, ID_SUB_MAESTRO: null, NUM1: 11, NUM2: 0, NUM3: 0, STRING1: 'Pontificia Universidad Católica del Perú', STRING2: '', STRING3: '' },
                { ID_PARAMETRO: 953, ID_MAESTRO: 0, ID_SUB_MAESTRO: null, NUM1: 12, NUM2: 0, NUM3: 0, STRING1: 'Universidad de Lima', STRING2: '', STRING3: '' },
                { ID_PARAMETRO: 999, ID_MAESTRO: 0, ID_SUB_MAESTRO: null, NUM1: 99, NUM2: 0, NUM3: 0, STRING1: 'Otra institución', STRING2: '', STRING3: '' },
              ]));
        return json(route, 404, fail(404, 'Maestro no encontrado'));
      }
      case '/auth/validar-correo': {
        const dominio = String(body?.correo).split('@')[1] ?? '';
        if (body?.correo === 'existe@correo.com') return json(route, 200, { data: { dominio, esValido: false, resultado: 'CORREO_EXISTENTE' }, result: { idTipoMensaje: 1, mensaje: 'Una cuenta registrada con ese correo ya existe' } });
        const permitido = dominio !== (opts.blockedDomain ?? 'gmail.com');
        return json(route, 200, ok({ dominio, esValido: permitido, resultado: permitido ? 'CORREO_DISPONIBLE' : 'DOMINIO_NO_PERMITIDO' }));
      }
      case '/auth/verificacion-codigo': {
        // Forma real verificada contra el backend: REGISTRAR responde solo { result }
        if (body?.accion === 'REGISTRAR') return json(route, 200, { result: { idTipoMensaje: 2, mensaje: 'Se realizó el registro del código correctamente' } });
        const code = decryptJwe(String(body?.codigo)).plaintext;
        return code === validCode
          ? json(route, 200, ok({ esValido: true, tokenRegistro: REG_TOKEN, expiraEnSegundos: 900 }))
          : json(route, 400, fail(400, 'Código inválido para usuario id 42 (SP_VERIFICACION)'));
      }
      case '/auth/crear-usuario':
        if (bearer !== REG_TOKEN || opts.expiredRegistration) return json(route, 401, fail(401, 'Token de registro inválido'));
        return json(route, 201, ok({ idUsuario: 42 }));
      case '/auth/login': {
        const clave = decryptJwe(String(body?.clave_acceso)).plaintext;
        if (body?.usuario === 'bloqueado@correo.com') return route.fulfill({ status: 429, headers: { ...cors, 'content-type': 'application/json', 'retry-after': '300' }, body: JSON.stringify(fail(429, 'bloqueado')) });
        return clave === E2E_PASSWORD
          ? json(route, 200, { token: SESSION_TOKEN, status: 'success' })
          : json(route, 401, fail(401, 'Credenciales o acceso a empresa inválidos'));
      }
      default:
        return json(route, 404, fail(404, 'Not found'));
    }
  });
  return captured;
}
