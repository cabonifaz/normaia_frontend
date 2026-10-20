import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { fileURLToPath, URL } from 'node:url';
import { securityHeaders } from './deploy/securityHeaders.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  // Con base relativa (/api/v1) el API es del mismo origen: connect-src 'self' basta.
  const base = env.VITE_API_BASE_URL ?? '';
  const apiOrigin = /^https?:\/\//.test(base) ? new URL(base).origin : '';
  const attachmentsOrigin = env.VITE_ATTACHMENTS_ORIGIN ? new URL(env.VITE_ATTACHMENTS_ORIGIN).origin : '';
  // Solo desarrollo: reverse proxy hacia el backend real (evita CORS sin abrirlo en el servidor).
  const proxyTarget = env.VITE_API_PROXY_TARGET;

  // Modo "lan" (solo desarrollo): HTTPS autofirmado para que WebCrypto/randomUUID funcionen fuera de localhost.
  const lan = mode === 'lan';

  return {
    plugins: [react(), ...(lan ? [basicSsl()] : [])],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: {
      port: 5173,
      strictPort: true,
      host: lan ? '0.0.0.0' : 'localhost',
      watch: { ignored: ['**/playwright-report/**', '**/test-results/**'] },
      ...(proxyTarget ? { proxy: { '/api': { target: proxyTarget, changeOrigin: true, secure: true } } } : {}),
    },
    preview: { port: 4173, strictPort: true, headers: securityHeaders(apiOrigin, attachmentsOrigin) },
    build: {
      target: 'es2022',
      sourcemap: false,
      assetsInlineLimit: 0, // sin data: URIs para scripts/fuentes; todo por 'self'
      cssCodeSplit: true,
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/ui/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      restoreMocks: true,
    },
  };
});
