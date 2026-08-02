// =============================================================================
// DiBeliin Admin - Operational Service
// =============================================================================
// Handles store status and voucher management operations

import { supabase } from '@/lib/supabase';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface Voucher {
    id: number;
    code: string;
    min_purchase: number;
    max_purchase: number | null;
    discount_amount: number;
    valid_for: 'all' | 'fore' | 'kenangan' | 'tomoro' | 'janjijiwa';
    quota: number;
    is_active: boolean;
}

export type VoucherInsert = Omit<Voucher, 'id'>;

// -----------------------------------------------------------------------------
// Antrian Pesanan Types
// -----------------------------------------------------------------------------

export type AntrianStatus = 'selesai' | 'gagal' | 'menunggu' | 'diproses';

export interface AntrianPesanan {
    id: string;
    created_at: string;        // ISO timestamp
    nomor_antrian: number | null; // int4 di DB
    toko: string;              // Nama toko
    nomor_wa: string | null;   // Nomor WhatsApp (text)
    admin_in_charge: string | null; // Nama admin yang bertugas
    status: string;            // Status raw dari DB (uppercase: SELESAI, GAGAL, dll)
}

// -----------------------------------------------------------------------------
// Store Status Operations
// -----------------------------------------------------------------------------

/**
 * Get the current store open/closed status
 * @returns boolean - true if store is open, false if closed
 */
export async function getStoreStatus(): Promise<boolean> {
    try {
        const { data, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'is_store_open')
            .single();

        if (error) {
            console.error('Error fetching store status:', error);
            return true; // Default to open on error
        }

        return data?.value === 'true' || data?.value === true;
    } catch (error) {
        console.error('Error fetching store status:', error);
        return true; // Default to open on error
    }
}

/**
 * Update the store open/closed status
 * @param isOpen - true to open store, false to close
 */
export async function updateStoreStatus(isOpen: boolean): Promise<void> {
    const { error } = await supabase
        .from('app_settings')
        .upsert(
            {
                key: 'is_store_open',
                value: isOpen.toString(),
            },
            { onConflict: 'key' }
        );

    if (error) {
        console.error('Error updating store status:', error);
        throw new Error(`Failed to update store status: ${error.message}`);
    }
}

// -----------------------------------------------------------------------------
// Voucher Operations
// -----------------------------------------------------------------------------

/**
 * Fetch all vouchers, ordered by ID descending (newest first)
 */
export async function getVouchers(): Promise<Voucher[]> {
    const { data, error } = await supabase
        .from('vouchers')
        .select('*')
        .order('id', { ascending: false });

    if (error) {
        console.error('Error fetching vouchers:', error);
        throw new Error(`Failed to fetch vouchers: ${error.message}`);
    }

    return data || [];
}

/**
 * Create a new voucher
 * @param voucher - Voucher data (without ID)
 */
export async function createVoucher(voucher: Partial<VoucherInsert>): Promise<Voucher> {
    const { data, error } = await supabase
        .from('vouchers')
        .insert({
            code: voucher.code,
            min_purchase: voucher.min_purchase ?? 0,
            max_purchase: voucher.max_purchase ?? null,
            discount_amount: voucher.discount_amount ?? 0,
            valid_for: voucher.valid_for ?? 'all',
            quota: voucher.quota ?? 1,
            is_active: voucher.is_active ?? true,
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating voucher:', error);
        throw new Error(`Failed to create voucher: ${error.message}`);
    }

    return data;
}

/**
 * Delete a voucher by ID
 * @param id - Voucher ID to delete
 */
export async function deleteVoucher(id: number): Promise<void> {
    const { error } = await supabase.from('vouchers').delete().eq('id', id);

    if (error) {
        console.error('Error deleting voucher:', error);
        throw new Error(`Failed to delete voucher: ${error.message}`);
    }
}

// -----------------------------------------------------------------------------
// Service Status Operations (Brand-specific)
// -----------------------------------------------------------------------------

/**
 * Get the status of a specific brand service
 * @param brand - 'fore', 'kenangan', 'tomoro', 'janjijiwa', or 'cinema'
 * @returns boolean - true if service is open, false if closed
 */
export async function getServiceStatus(brand: 'fore' | 'kenangan' | 'tomoro' | 'janjijiwa' | 'cinema' | 'cgv' | 'cinepolis' | 'xxi'): Promise<boolean> {
    const keyMap = {
        fore: 'is_fore_open',
        kenangan: 'is_kenangan_open',
        tomoro: 'is_tomoro_open',
        janjijiwa: 'is_janjijiwa_open',
        cinema: 'is_cinema_open',
        cgv: 'is_cgv_open',
        cinepolis: 'is_cinepolis_open',
        xxi: 'is_xxi_open',
    };
    const key = keyMap[brand];

    try {
        const { data, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', key)
            .single();

        if (error) {
            console.error(`Error fetching ${brand} service status:`, error);
            return true; // Default to open on error
        }

        return data?.value === 'true' || data?.value === true;
    } catch (error) {
        console.error(`Error fetching ${brand} service status:`, error);
        return true; // Default to open on error
    }
}

/**
 * Update the status of a specific brand service
 * @param brand - 'fore', 'kenangan', 'tomoro', 'janjijiwa', or 'cinema'
 * @param isOpen - true to open service, false to close
 */
export async function updateServiceStatus(brand: 'fore' | 'kenangan' | 'tomoro' | 'janjijiwa' | 'cinema' | 'cgv' | 'cinepolis' | 'xxi', isOpen: boolean): Promise<void> {
    const keyMap = {
        fore: 'is_fore_open',
        kenangan: 'is_kenangan_open',
        tomoro: 'is_tomoro_open',
        janjijiwa: 'is_janjijiwa_open',
        cinema: 'is_cinema_open',
        cgv: 'is_cgv_open',
        cinepolis: 'is_cinepolis_open',
        xxi: 'is_xxi_open',
    };
    const key = keyMap[brand];

    const { error } = await supabase
        .from('app_settings')
        .upsert(
            {
                key,
                value: isOpen.toString(),
            },
            { onConflict: 'key' }
        );

    if (error) {
        console.error(`Error updating ${brand} service status:`, error);
        throw new Error(`Failed to update ${brand} service status: ${error.message}`);
    }
}

// -----------------------------------------------------------------------------
// Cinema Order Window (per-chain bookable date range override)
// -----------------------------------------------------------------------------

export type CinemaChain = 'cgv' | 'cinepolis' | 'xxi';

export interface CinemaOrderWindow {
    start: string | null; // ISO date (YYYY-MM-DD), null = no lower bound
    end: string | null;   // ISO date (YYYY-MM-DD), null = no upper bound
}

const CINEMA_ORDER_WINDOW_KEYS: Record<CinemaChain, { start: string; end: string }> = {
    cgv: { start: 'cgv_order_start_date', end: 'cgv_order_end_date' },
    cinepolis: { start: 'cinepolis_order_start_date', end: 'cinepolis_order_end_date' },
    xxi: { start: 'xxi_order_start_date', end: 'xxi_order_end_date' },
};

/**
 * Fetch the configured order-date window for each cinema chain. Empty bounds mean
 * unrestricted (frontend allows any date TIX ID itself reports as bookable).
 */
export async function getCinemaOrderWindows(): Promise<Record<CinemaChain, CinemaOrderWindow>> {
    const keys = Object.values(CINEMA_ORDER_WINDOW_KEYS).flatMap((k) => [k.start, k.end]);
    const fallback: Record<CinemaChain, CinemaOrderWindow> = {
        cgv: { start: null, end: null },
        cinepolis: { start: null, end: null },
        xxi: { start: null, end: null },
    };

    try {
        const { data, error } = await supabase.from('app_settings').select('key, value').in('key', keys);
        if (error) {
            console.error('Error fetching cinema order windows:', error);
            return fallback;
        }

        const raw = data?.reduce((acc, item) => {
            acc[item.key] = item.value;
            return acc;
        }, {} as Record<string, unknown>) ?? {};
        const parseDate = (val: unknown): string | null => (typeof val === 'string' && val.length > 0 ? val : null);

        return {
            cgv: { start: parseDate(raw['cgv_order_start_date']), end: parseDate(raw['cgv_order_end_date']) },
            cinepolis: { start: parseDate(raw['cinepolis_order_start_date']), end: parseDate(raw['cinepolis_order_end_date']) },
            xxi: { start: parseDate(raw['xxi_order_start_date']), end: parseDate(raw['xxi_order_end_date']) },
        };
    } catch (error) {
        console.error('Error fetching cinema order windows:', error);
        return fallback;
    }
}

/**
 * Update one bound (start or end) of a chain's order-date window.
 * @param value - ISO date string (YYYY-MM-DD), or null to clear the bound (unrestricted)
 */
export async function updateCinemaOrderWindow(chain: CinemaChain, bound: 'start' | 'end', value: string | null): Promise<void> {
    const key = CINEMA_ORDER_WINDOW_KEYS[chain][bound];

    const { error } = await supabase
        .from('app_settings')
        .upsert({ key, value: value ?? '' }, { onConflict: 'key' });

    if (error) {
        console.error(`Error updating ${chain} order window (${bound}):`, error);
        throw new Error(`Failed to update ${chain} order window: ${error.message}`);
    }
}

// -----------------------------------------------------------------------------
// Antrian Pesanan Operations
// -----------------------------------------------------------------------------

/**
 * Fetch all antrian pesanan records, ordered by created_at descending (newest first).
 * Returns empty array if table doesn't exist yet.
 */
export async function getAntrianPesanan(): Promise<AntrianPesanan[]> {
    try {
        const { data, error } = await supabase
            .from('antrian_pesanan')
            .select('id, created_at, nomor_antrian, nomor_wa, toko, status, admin_in_charge')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching antrian pesanan:', error);
            return [];
        }

        return (data as AntrianPesanan[]) || [];
    } catch (error) {
        console.error('Error fetching antrian pesanan:', error);
        return [];
    }
}

// -----------------------------------------------------------------------------
// Admin Fees Operations (Dynamic Jasdor Fees)
// -----------------------------------------------------------------------------

export interface AdminFees {
    fee_jasdor_fore: number;
    fee_jasdor_kopken: number;
    fee_jasdor_tomoro: number;
    fee_jasdor_janjijiwa: number;
    fee_special_item: number;
    fee_cinema: number;
}

const ADMIN_FEE_DEFAULTS: AdminFees = { fee_jasdor_fore: 5000, fee_jasdor_kopken: 5000, fee_jasdor_tomoro: 2000, fee_jasdor_janjijiwa: 2000, fee_special_item: 5000, fee_cinema: 5000 };

/**
 * Fetch dynamic admin fees from app_settings
 */
export async function getAdminFees(): Promise<AdminFees> {
    try {
        const { data, error } = await supabase
            .from('app_settings')
            .select('key, value')
            .in('key', ['fee_jasdor_fore', 'fee_jasdor_kopken', 'fee_jasdor_tomoro', 'fee_jasdor_janjijiwa', 'fee_special_item', 'fee_cinema']);

        if (error) {
            console.error('Error fetching admin fees:', error);
            return { ...ADMIN_FEE_DEFAULTS };
        }

        const fees: AdminFees = { ...ADMIN_FEE_DEFAULTS };
        data?.forEach((row) => {
            if (row.key === 'fee_jasdor_fore') {
                fees.fee_jasdor_fore = Number(row.value) || 5000;
            } else if (row.key === 'fee_jasdor_kopken') {
                fees.fee_jasdor_kopken = Number(row.value) || 5000;
            } else if (row.key === 'fee_jasdor_tomoro') {
                fees.fee_jasdor_tomoro = Number(row.value) || 2000;
            } else if (row.key === 'fee_jasdor_janjijiwa') {
                fees.fee_jasdor_janjijiwa = Number(row.value) || 2000;
            } else if (row.key === 'fee_special_item') {
                fees.fee_special_item = Number(row.value) || 5000;
            } else if (row.key === 'fee_cinema') {
                fees.fee_cinema = Number(row.value) || 5000;
            }
        });
        return fees;
    } catch (error) {
        console.error('Error fetching admin fees:', error);
        return { ...ADMIN_FEE_DEFAULTS };
    }
}

/**
 * Update a specific admin fee in app_settings
 */
export async function updateAdminFee(
    key: 'fee_jasdor_fore' | 'fee_jasdor_kopken' | 'fee_jasdor_tomoro' | 'fee_jasdor_janjijiwa' | 'fee_special_item' | 'fee_cinema',
    value: string
): Promise<void> {
    const { error } = await supabase
        .from('app_settings')
        .upsert(
            {
                key,
                value,
            },
            { onConflict: 'key' }
        );

    if (error) {
        console.error(`Error updating admin fee (${key}):`, error);
        throw new Error(`Failed to update admin fee: ${error.message}`);
    }
}
