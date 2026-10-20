import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { securityHeaders } from './deploy/securityHeaders.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const apiOrigin = env.VITE_API_BASE_URL ? new URL(env.VITE_API_BASE_URL).origin : '';

  return {
    plugins: [react()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: { port: 5173, strictPort: true },
    preview: { port: 4173, strictPort: true, headers: securityHeaders(apiOrigin) },
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
