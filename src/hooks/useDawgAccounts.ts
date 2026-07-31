// =============================================================================
// DiBeliin Admin - Dawg (Kopken Panel) Account Hook
// =============================================================================

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { fetchDawgAccounts } from '@/services/dawgAccountService';
import type { DawgAccount } from '@/types/database';

export function useDawgAccounts(
    options?: Omit<UseQueryOptions<DawgAccount[], Error>, 'queryKey' | 'queryFn'>
) {
    return useQuery({
        queryKey: ['dawg-accounts'],
        queryFn: fetchDawgAccounts,
        ...options,
    });
}
