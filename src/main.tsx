import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createContainer } from '@/di/container';
import { App } from '@/ui/app/App';
import { createQueryClient } from '@/ui/app/queryClient';
import { createAppRouter } from '@/ui/app/router';
import '@/ui/styles/design.css';
import '@/ui/styles/chat.css';

const root = document.getElementById('root');
if (!root) throw new Error('No se encontró #root');

const queryClient = createQueryClient();
// eslint-disable-next-line prefer-const -- se asigna tras crear deps (el hook 401 necesita el router)
let router: ReturnType<typeof createAppRouter>;
const deps = createContainer({
  // Sesión expirada: limpiar caché en memoria y volver al ingreso.
  onUnauthorized: () => {
    queryClient.clear();
    void router.navigate({ to: '/ingresar', search: { motivo: 'sesion-expirada' } });
  },
});
router = createAppRouter(deps);

createRoot(root).render(
  <StrictMode>
    <App deps={deps} queryClient={queryClient} router={router} />
  </StrictMode>,
);
