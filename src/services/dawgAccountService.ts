// =============================================================================
// DiBeliin Admin - Dawg (Kopken Panel) Account Service
// =============================================================================
// Read-only access to `dawg_accounts` — the dawg.colok.me checkout-automation
// account pool (synced by Otomasi_web_panel/dibeliin_auto), shown as the
// "KopKen Panel" tab in Inventory.

import { supabase } from '@/lib/supabase';
import type { DawgAccount } from '@/types/database';

export async function fetchDawgAccounts(): Promise<DawgAccount[]> {
    const { data, error } = await supabase
        .from('dawg_accounts')
        .select('*')
        .order('registered_at', { ascending: false });

    if (error) throw new Error(`Gagal memuat KopKen Panel: ${error.message}`);
    return (data ?? []) as DawgAccount[];
}

// -----------------------------------------------------------------------------
// Scan Akun Manual
// -----------------------------------------------------------------------------
// Tombol "Scan Akun Baru" gak manggil server langsung -- scan-nya jalan di
// server otomasi (pm2 `scan-accounts-worker`) yang gak punya endpoint publik.
// Jadi tombolnya cuma nulis timestamp ke app_settings; worker di sana polling
// key ini tiap 15 detik, jalanin scan-nya, lalu nulis hasilnya ke
// `scan_accounts_status`. Lihat Otomasi_web_panel/dibeliin_auto/scripts/
// scan_accounts_worker.js.

const SCAN_REQUEST_KEY = 'scan_accounts_requested_at';
const SCAN_STATUS_KEY = 'scan_accounts_status';

export type DawgScanState = 'idle' | 'running' | 'done' | 'error';

export interface DawgScanStatus {
    state: DawgScanState;
    at: string | null;
    message: string;
}

/** Minta worker otomasi menjalankan scan akun baru sekarang. */
export async function requestDawgAccountScan(): Promise<void> {
    const { error } = await supabase
        .from('app_settings')
        .upsert(
            {
                key: SCAN_REQUEST_KEY,
                value: new Date().toISOString(),
                description: 'Timestamp permintaan scan akun KopKen dari web admin',
            },
            { onConflict: 'key' }
        );

    if (error) throw new Error(`Gagal minta scan: ${error.message}`);
}

/** Baca status scan terakhir yang ditulis worker. Format: "<state>|<ISO>|<pesan>". */
export async function fetchDawgScanStatus(): Promise<DawgScanStatus> {
    const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', SCAN_STATUS_KEY)
        .maybeSingle();

    if (error) throw new Error(`Gagal memuat status scan: ${error.message}`);

    const [state, at, ...rest] = (data?.value ?? '').split('|');
    if (!state) return { state: 'idle', at: null, message: '' };

    return {
        state: (['running', 'done', 'error'] as const).includes(state as never)
            ? (state as DawgScanState)
            : 'idle',
        at: at || null,
        message: rest.join('|'),
    };
}

// -----------------------------------------------------------------------------
// Log Pemakaian Voucher
// -----------------------------------------------------------------------------
// Sumbernya view `dawg_voucher_usage_daily` di Supabase, yang merangkum tabel
// `dawg_voucher_log`. Log itu ditulis dari DALAM RPC claim_dawg_voucher /
// restore_dawg_voucher, jadi semua jalur pemakaian (checkout admin, API
// reseller, script) ikut tercatat.
//
// terpakai = diklaim - dikembalikan. Voucher yang diklaim lalu di-rollback
// karena checkout gagal tidak dihitung habis.

export type DawgVoucherTier = 'tanpa_minimal' | 'min_50k' | 'min_70k';

export interface DawgVoucherUsageDay {
    tanggal: string;
    tier: DawgVoucherTier;
    diklaim: number;
    dikembalikan: number;
    terpakai: number;
}

/** Rekap harian pemakaian voucher, terbaru dulu. */
export async function fetchDawgVoucherUsage(hari = 14): Promise<DawgVoucherUsageDay[]> {
    const sejak = new Date(Date.now() - hari * 86400_000).toISOString().slice(0, 10);

    const { data, error } = await supabase
        .from('dawg_voucher_usage_daily')
        .select('*')
        .gte('tanggal', sejak)
        .order('tanggal', { ascending: false });

    if (error) throw new Error(`Gagal memuat log voucher: ${error.message}`);
    return (data ?? []) as DawgVoucherUsageDay[];
}
