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
    valid_for: 'all' | 'fore' | 'kenangan';
    quota: number;
    is_active: boolean;
}

export type VoucherInsert = Omit<Voucher, 'id'>;

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
 * @param brand - 'fore' or 'kenangan'
 * @returns boolean - true if service is open, false if closed
 */
export async function getServiceStatus(brand: 'fore' | 'kenangan'): Promise<boolean> {
    const key = brand === 'fore' ? 'is_fore_open' : 'is_kenangan_open';

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
 * @param brand - 'fore' or 'kenangan'
 * @param isOpen - true to open service, false to close
 */
export async function updateServiceStatus(brand: 'fore' | 'kenangan', isOpen: boolean): Promise<void> {
    const key = brand === 'fore' ? 'is_fore_open' : 'is_kenangan_open';

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
