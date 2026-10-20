import { z } from 'zod';
import { AppError, kindFromStatus } from '@/application/errors';
import { CSRF_HEADER, readCsrfToken } from './csrf';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions<S extends z.ZodTypeAny> {
  method?: Method;
  body?: unknown;
  /** Contrato de la respuesta. Si no cumple, se rechaza (respuesta manipulada o contrato roto). */
  schema: S;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** false en endpoints de credenciales: ahí un 401 es "credenciales inválidas", no "sesión expirada". */
  notifyUnauthorized?: boolean;
  /** Token Bearer para esta petición (lo aporta el repositorio desde el SessionStore). */
  bearer?: string | null;
  query?: Record<string, string>;
}

export interface HttpClientConfig {
  baseUrl: string;
  timeoutMs: number;
}

export type HttpClient = <S extends z.ZodTypeAny>(path: string, opts: RequestOptions<S>) => Promise<z.output<S>>;

const UNSAFE: ReadonlySet<Method> = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const ERROR_CODE = /^[A-Z][A-Z0-9_]{1,63}$/;
const MAX_BODY_BYTES = 2 * 1024 * 1024;

function assertSafePath(path: string): void {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('..')) {
    throw new Error('Ruta de endpoint inválida.');
  }
}

async function readJson(res: Response): Promise<unknown> {
  if (res.status === 204) return null;
  const type = (res.headers.get('content-type') ?? '').toLowerCase();
  if (!type.startsWith('application/json') && !type.startsWith('application/problem+json')) return undefined;
  if (Number(res.headers.get('content-length') ?? '0') > MAX_BODY_BYTES) return undefined;
  const text = await res.text();
  if (text.length > MAX_BODY_BYTES) return undefined;
  try {
    return text ? (JSON.parse(text) as unknown) : null;
  } catch {
    return undefined;
  }
}

function extractErrorCode(body: unknown): string | null {
  if (body && typeof body === 'object' && 'code' in body) {
    const code = (body as { code: unknown }).code;
    if (typeof code === 'string' && ERROR_CODE.test(code)) return code;
  }
  return null;
}

/**
 * Adaptador HTTP compartido por los repositorios REST.
 * `onUnauthorized` permite a la composición reaccionar a un 401 (p. ej. invalidar la sesión).
 */
export function createHttpClient(config: HttpClientConfig, hooks: { onUnauthorized?: () => void } = {}): HttpClient {
  const baseUrl = config.baseUrl.replace(/\/+$/, '');

  return async function request(path, opts) {
    assertSafePath(path);
    const method = opts.method ?? 'GET';
    const requestId = crypto.randomUUID();
    const headers = new Headers({ Accept: 'application/json', 'X-Request-Id': requestId });
    if (opts.bearer) headers.set('Authorization', `Bearer ${opts.bearer}`);

    if (UNSAFE.has(method)) {
      headers.set('Idempotency-Key', crypto.randomUUID());
      const csrf = readCsrfToken();
      if (csrf) headers.set(CSRF_HEADER, csrf);
    }
    let body: string | undefined;
    if (opts.body !== undefined) {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(opts.body);
    }

    const timeout = AbortSignal.timeout(opts.timeoutMs ?? config.timeoutMs);
    const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;

    let res: Response;
    try {
      const qs = opts.query ? `?${new URLSearchParams(opts.query).toString()}` : '';
      res = await fetch(baseUrl + path + qs, {
        method,
        headers,
        ...(body !== undefined ? { body } : {}),
        signal,
        credentials: 'include',
        mode: 'cors',
        cache: 'no-store',
        redirect: 'error',
        referrerPolicy: 'no-referrer',
      });
    } catch {
      if (timeout.aborted) throw new AppError('timeout', 0, requestId);
      if (opts.signal?.aborted) throw new AppError('aborted', 0, requestId);
      throw new AppError('network', 0, requestId);
    }

    const payload = await readJson(res);

    if (!res.ok) {
      const kind = kindFromStatus(res.status);
      if (kind === 'unauthorized' && opts.notifyUnauthorized !== false) hooks.onUnauthorized?.();
      const retry = Number(res.headers.get('retry-after'));
      throw new AppError(kind, res.status, requestId, extractErrorCode(payload), Number.isFinite(retry) && retry > 0 ? retry : null);
    }

    const parsed = opts.schema.safeParse(payload);
    if (!parsed.success) throw new AppError('contract', res.status, requestId);
    return parsed.data;
  };
}
