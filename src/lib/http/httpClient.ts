import { z } from 'zod';
import { env } from '@/config/env';
import { CSRF_HEADER, readCsrfToken } from '@/lib/security/csrf';
import { ApiError, kindFromStatus } from './errors';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions<S extends z.ZodTypeAny> {
  method?: Method;
  body?: unknown;
  /** Contrato de la respuesta. Si no cumple, se rechaza (respuesta manipulada o contrato roto). */
  schema: S;
  signal?: AbortSignal;
  timeoutMs?: number;
}

const UNSAFE: ReadonlySet<Method> = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const ERROR_CODE = /^[A-Z][A-Z0-9_]{1,63}$/;
const MAX_BODY_BYTES = 2 * 1024 * 1024;

type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();
export function onUnauthorized(fn: UnauthorizedListener): () => void {
  unauthorizedListeners.add(fn);
  return () => unauthorizedListeners.delete(fn);
}

function buildUrl(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('..')) {
    throw new Error('Ruta de endpoint inválida.');
  }
  return env.apiBaseUrl + path;
}

async function readJson(res: Response): Promise<unknown> {
  if (res.status === 204) return null;
  const type = res.headers.get('content-type') ?? '';
  if (!type.toLowerCase().startsWith('application/json') && !type.toLowerCase().startsWith('application/problem+json')) return undefined;
  const len = Number(res.headers.get('content-length') ?? '0');
  if (len > MAX_BODY_BYTES) return undefined;
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

export async function request<S extends z.ZodTypeAny>(path: string, opts: RequestOptions<S>): Promise<z.output<S>> {
  const method = opts.method ?? 'GET';
  const url = buildUrl(path);
  const requestId = crypto.randomUUID();
  const headers = new Headers({ Accept: 'application/json', 'X-Request-Id': requestId });

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

  const timeout = AbortSignal.timeout(opts.timeoutMs ?? env.httpTimeoutMs);
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;

  let res: Response;
  try {
    res = await fetch(url, {
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
    if (timeout.aborted) throw new ApiError('timeout', 0, requestId);
    if (opts.signal?.aborted) throw new ApiError('aborted', 0, requestId);
    throw new ApiError('network', 0, requestId);
  }

  const payload = await readJson(res);

  if (!res.ok) {
    const kind = kindFromStatus(res.status);
    if (kind === 'unauthorized') unauthorizedListeners.forEach((fn) => fn());
    const retry = Number(res.headers.get('retry-after'));
    throw new ApiError(kind, res.status, requestId, extractErrorCode(payload), Number.isFinite(retry) && retry > 0 ? retry : null);
  }

  const parsed = opts.schema.safeParse(payload);
  if (!parsed.success) throw new ApiError('contract', res.status, requestId);
  return parsed.data;
}
