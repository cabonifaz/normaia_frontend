import { createRootRoute, createRoute, createRouter, Outlet, type RouterHistory } from '@tanstack/react-router';
import { LandingPage } from '@/ui/landing/LandingPage';
import { PendingPage } from '@/ui/pages/PendingPage';
import { RegisterPage } from '@/ui/registro/RegisterPage';

const rootRoute = createRootRoute({
  component: Outlet,
  notFoundComponent: () => <PendingPage title="Página no encontrada" description="La dirección que buscas no existe." />,
});

const pending = (path: string, title: string, description: string) =>
  createRoute({ getParentRoute: () => rootRoute, path, component: () => <PendingPage title={title} description={description} /> });

export const routeTree = rootRoute.addChildren([
  createRoute({ getParentRoute: () => rootRoute, path: '/', component: LandingPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/registro', component: RegisterPage }),
  pending('/ingresar', 'Ingresar', 'Pantalla de inicio de sesión pendiente de diseño y contrato del backend.'),
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
