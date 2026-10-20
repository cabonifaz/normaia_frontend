import { createRootRoute, createRoute, createRouter, Outlet, type RouterHistory } from '@tanstack/react-router';
import { parseLoginMotivo, type LoginMotivo } from '@/domain/auth/auth';
import { LoginPage } from '@/ui/auth/LoginPage';
import { RecoverPage } from '@/ui/auth/RecoverPage';
import { LandingPage } from '@/ui/landing/LandingPage';
import { PendingPage } from '@/ui/pages/PendingPage';
import { RegisterPage } from '@/ui/registro/RegisterPage';

const rootRoute = createRootRoute({
  // La raíz descarta cualquier query: cada ruta declara la suya (si no, la query cruda se hereda tal cual).
  validateSearch: (): Record<string, never> => ({}),
  component: Outlet,
  notFoundComponent: () => <PendingPage title="Página no encontrada" description="La dirección que buscas no existe." />,
});

const pending = (path: string, title: string, description: string) =>
  createRoute({ getParentRoute: () => rootRoute, path, component: () => <PendingPage title={title} description={description} /> });

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ingresar',
  // Lista cerrada: cualquier otro valor se descarta (nada de la URL se refleja en pantalla).
  validateSearch: (search: Record<string, unknown>): { motivo?: LoginMotivo | undefined } => ({ motivo: parseLoginMotivo(search.motivo) }),
  component: function LoginRoute() {
    const { motivo } = loginRoute.useSearch();
    return <LoginPage motivo={motivo} />;
  },
});

export const routeTree = rootRoute.addChildren([
  createRoute({ getParentRoute: () => rootRoute, path: '/', component: LandingPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/registro', component: RegisterPage }),
  loginRoute,
  createRoute({ getParentRoute: () => rootRoute, path: '/recuperar', component: RecoverPage }),
  pending('/app', 'Norma IA', 'Consulta RAG pendiente de diseño y contrato del backend.'),
  pending('/terminos', 'Términos y condiciones', 'Texto legal pendiente.'),
  pending('/privacidad', 'Política de privacidad', 'Texto legal pendiente.'),
]);

export function createAppRouter(history?: RouterHistory) {
  return createRouter({ routeTree, ...(history ? { history } : {}), scrollRestoration: true });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
