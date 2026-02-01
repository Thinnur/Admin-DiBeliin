// =============================================================================
// DiBeliin Admin - TanStack Query Client Configuration
// =============================================================================

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Data is considered fresh for 1 minute
            staleTime: 1000 * 60,
            // Keep unused data in cache for 5 minutes
            gcTime: 1000 * 60 * 5,
            // Retry failed requests up to 3 times
            retry: 3,
            // Refetch on window focus for real-time data
            refetchOnWindowFocus: true,
        },
        mutations: {
            // Retry failed mutations once
            retry: 1,
        },
    },
});

// Query keys factory for type-safe cache management
export const queryKeys = {
    accounts: {
        all: ['accounts'] as const,
        list: (filters?: Record<string, unknown>) => ['accounts', 'list', filters] as const,
        detail: (id: string) => ['accounts', 'detail', id] as const,
        statistics: ['accounts', 'statistics'] as const,
        ready: (brand?: string) => ['accounts', 'ready', brand] as const,
    },
    transactions: {
        all: ['transactions'] as const,
        list: (filters?: Record<string, unknown>) => ['transactions', 'list', filters] as const,
        detail: (id: string) => ['transactions', 'detail', id] as const,
        summary: () => ['transactions', 'summary'] as const,
    },
} as const;
