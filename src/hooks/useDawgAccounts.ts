// =============================================================================
// DiBeliin Admin - Dawg (Kopken Panel) Account Hook
// =============================================================================

import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    fetchDawgAccounts,
    fetchDawgScanStatus,
    requestDawgAccountScan,
} from '@/services/dawgAccountService';
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

/**
 * Status scan akun terakhir (ditulis worker otomasi ke app_settings).
 * Di-refetch tiap 5 detik selagi scan jalan, 30 detik kalau idle -- cukup
 * buat nampilin progres tombol tanpa nge-poll Supabase berlebihan.
 */
export function useDawgScanStatus(enabled: boolean) {
    return useQuery({
        queryKey: ['dawg-scan-status'],
        queryFn: fetchDawgScanStatus,
        enabled,
        refetchInterval: (query) => (query.state.data?.state === 'running' ? 5_000 : 30_000),
    });
}

/** Tombol "Scan Akun Baru": titip permintaan scan ke worker otomasi. */
export function useRequestDawgScan() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: requestDawgAccountScan,
        onSuccess: () => {
            toast.info('Permintaan scan dikirim. Hasilnya muncul dalam ~1 menit.');
            queryClient.invalidateQueries({ queryKey: ['dawg-scan-status'] });
        },
        onError: (error: Error) => {
            toast.error(error.message);
        },
    });
}
