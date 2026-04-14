// src/components/shared/Providers.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,           // 30 seconds
            gcTime: 300_000,             // 5 minutes
            refetchOnWindowFocus: false,
            retry: (count, error: unknown) => {
              // Don't retry 4xx errors
              if (
                error instanceof Error &&
                'statusCode' in error &&
                typeof (error as { statusCode: number }).statusCode === 'number' &&
                (error as { statusCode: number }).statusCode < 500
              ) {
                return false;
              }
              return count < 2;
            },
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
