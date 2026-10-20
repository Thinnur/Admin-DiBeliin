// =============================================================================
// DiBeliin Admin - Dawg (Kopken Panel) Account Hook
// =============================================================================

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    fetchDawgAccountsPage,
    fetchDawgScanStatus,
    fetchDawgVoucherUsage,
    requestDawgAccountScan,
} from '@/services/dawgAccountService';

export function useDawgAccountsPage(
    search: string,
    page: number,
    pageSize: number,
    options?: { enabled?: boolean; refetchInterval?: number | false }
) {
    return useQuery({
        queryKey: ['dawg-accounts', search, page, pageSize],
        queryFn: () => fetchDawgAccountsPage(search, page, pageSize),
        placeholderData: keepPreviousData,
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

/** Rekap harian pemakaian voucher (default 14 hari terakhir). */
export function useDawgVoucherUsage(enabled: boolean, hari = 14) {
    return useQuery({
        queryKey: ['dawg-voucher-usage', hari],
        queryFn: () => fetchDawgVoucherUsage(hari),
        enabled,
        staleTime: 60_000,
    });
}
