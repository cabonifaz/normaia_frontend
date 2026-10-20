import { defineConfig, devices } from '@playwright/test';
import { E2E_API, E2E_KID, e2eKeys } from './e2e/keys';

const { publicPem } = e2eKeys();

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  // Build de producción real + preview con las cabeceras de seguridad.
  webServer: {
    command: 'npx vite build --mode e2e && npx vite preview --mode e2e',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      VITE_API_BASE_URL: E2E_API,
      VITE_PAYLOAD_ENCRYPTION: 'required',
      VITE_PAYLOAD_PUBLIC_KEY: publicPem.replace(/\n/g, '\n'),
      VITE_PAYLOAD_KEY_ID: E2E_KID,
    },
  },
});
