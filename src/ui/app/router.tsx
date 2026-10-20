import { createRootRouteWithContext, createRoute, createRouter, Outlet, redirect, type RouterHistory } from '@tanstack/react-router';
import type { AppDependencies } from '@/application/AppDependencies';
import { parseLoginMotivo, type LoginMotivo } from '@/domain/auth/auth';
import { LoginPage } from '@/ui/auth/LoginPage';
import { RecoverPage } from '@/ui/auth/RecoverPage';
import { LandingPage } from '@/ui/landing/LandingPage';
import { PendingPage } from '@/ui/pages/PendingPage';
import { RegisterPage } from '@/ui/registro/RegisterPage';

interface RouterContext {
  deps: AppDependencies;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
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
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/app',
    // Ruta protegida: sin sesión, al ingreso. La autorización real la hace el backend en cada llamada.
    beforeLoad: ({ context }) => {
      if (!context.deps.auth.haySesion()) throw redirect({ to: '/ingresar', search: { motivo: 'sesion-requerida' }, replace: true });
    },
    component: () => <PendingPage title="Norma IA" description="Consulta RAG pendiente de diseño y contrato del backend." />,
  }),
  pending('/terminos', 'Términos y condiciones', 'Texto legal pendiente.'),
  pending('/privacidad', 'Política de privacidad', 'Texto legal pendiente.'),
]);

export function createAppRouter(deps: AppDependencies, history?: RouterHistory) {
  return createRouter({ routeTree, context: { deps }, ...(history ? { history } : {}), scrollRestoration: true });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
