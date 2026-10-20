import { createRootRouteWithContext, createRoute, createRouter, Outlet, redirect, type RouterHistory } from '@tanstack/react-router';
import type { AppDependencies } from '@/application/AppDependencies';
import { parseLoginMotivo, type LoginMotivo } from '@/domain/auth/auth';
import { LoginPage } from '@/ui/auth/LoginPage';
import { RecoverPage } from '@/ui/auth/RecoverPage';
import { LandingPage } from '@/ui/landing/LandingPage';
import { PendingPage } from '@/ui/pages/PendingPage';
import { RegisterPage } from '@/ui/registro/RegisterPage';
import { ChatPage } from '@/ui/chat/ChatPage';

/**
 * Contexto mínimo para las guardas. NO poner AppDependencies completo: TanStack Router propaga
 * el tipo del contexto a todas las rutas y TypeScript recalcula su varianza en cada <Link>
 * (el typecheck pasaba de ~5 s a ~60 s).
 */
interface RouterContext {
  sesion: { activa: () => boolean };
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
  // Ya con sesión: directo a sus consultas (no mostrar un login que parece "sesión cerrada").
  beforeLoad: ({ context }) => {
    if (context.sesion.activa()) throw redirect({ to: '/app', replace: true });
  },
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
      if (!context.sesion.activa()) throw redirect({ to: '/ingresar', search: { motivo: 'sesion-requerida' }, replace: true });
    },
    component: ChatPage,
  }),
  pending('/terminos', 'Términos y condiciones', 'Texto legal pendiente.'),
  pending('/privacidad', 'Política de privacidad', 'Texto legal pendiente.'),
]);

export function createAppRouter(deps: AppDependencies, history?: RouterHistory) {
  return createRouter({ routeTree, context: { sesion: { activa: () => deps.auth.haySesion() } }, ...(history ? { history } : {}), scrollRestoration: true });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
