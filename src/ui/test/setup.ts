import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

vi.stubEnv('VITE_API_BASE_URL', 'https://api.test.local/api/v1');
vi.stubEnv('VITE_PAYLOAD_ENCRYPTION', 'off');

afterEach(() => cleanup());
