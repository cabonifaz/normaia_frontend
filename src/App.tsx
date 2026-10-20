import { createBrowserRouter, RouterProvider } from 'react-router';
import { IsotipoSymbol } from '@/components/brand/Isotipo';
import { routes } from './routes';

const router = createBrowserRouter(routes);

export function App() {
  return (
    <>
      <IsotipoSymbol />
      <RouterProvider router={router} />
    </>
  );
}
