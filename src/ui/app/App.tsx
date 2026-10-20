import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import type { AppDependencies } from '@/application/AppDependencies';
import { IsotipoSymbol } from '@/ui/components/brand/Isotipo';
import { DependenciesProvider } from './DependenciesContext';
import { RegistroEntryProvider } from './RegistroEntryContext';
import type { createAppRouter } from './router';

interface AppProps {
  deps: AppDependencies;
  queryClient: QueryClient;
  router: ReturnType<typeof createAppRouter>;
}

export function App({ deps, queryClient, router }: AppProps) {
  return (
    <DependenciesProvider value={deps}>
      <QueryClientProvider client={queryClient}>
        <RegistroEntryProvider>
          <IsotipoSymbol />
          <RouterProvider router={router} />
        </RegistroEntryProvider>
      </QueryClientProvider>
    </DependenciesProvider>
  );
}
