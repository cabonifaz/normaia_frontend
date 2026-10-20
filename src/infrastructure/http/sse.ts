import { AppError } from '@/application/errors';

const MAX_BUFFER = 1024 * 1024; // 1 MB sin separador de evento = respuesta anómala

/**
 * Lee un cuerpo text/event-stream y emite el JSON de cada evento `data:`.
 * - Tolera \r\n, varias líneas `data:` por evento y comentarios (`:`).
 * - Tope de memoria y timeout por inactividad (el stream puede durar, pero no quedarse mudo).
 * - JSON inválido se descarta (no rompe el stream).
 */
export async function* leerSse(body: ReadableStream<Uint8Array>, opts: { signal: AbortSignal; idleMs: number; requestId: string }): AsyncGenerator<unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let idle: ReturnType<typeof setTimeout> | undefined;
  let idleFired = false;

  const armIdle = () => {
    clearTimeout(idle);
    idle = setTimeout(() => {
      idleFired = true;
      void reader.cancel();
    }, opts.idleMs);
  };
  const onAbort = () => void reader.cancel();
  opts.signal.addEventListener('abort', onAbort, { once: true });

  try {
    armIdle();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      armIdle();
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n?/g, '\n');
      if (buffer.length > MAX_BUFFER) throw new AppError('contract', 200, opts.requestId);

      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const bloque = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const data = bloque
          .split('\n')
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).replace(/^ /, ''))
          .join('\n');
        if (!data) continue;
        try {
          yield JSON.parse(data) as unknown;
        } catch {
          // evento corrupto: se ignora
        }
      }
    }
    if (idleFired) throw new AppError('timeout', 0, opts.requestId);
    if (opts.signal.aborted) throw new AppError('aborted', 0, opts.requestId);
  } finally {
    clearTimeout(idle);
    opts.signal.removeEventListener('abort', onAbort);
    reader.releaseLock();
  }
}
