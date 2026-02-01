// =============================================================================
// DiBeliin Admin - Accounts API Service
// =============================================================================
// Supabase API wrapper functions for account operations

import { supabase } from '../lib/supabase';
import type {
    Account,
    AccountInsert,
    AccountUpdate,
    AccountFilters,
    AccountStatus,
    AccountBrand,
    AccountStatistics,
} from '../types/database';

// -----------------------------------------------------------------------------
// Read Operations
// -----------------------------------------------------------------------------

/**
 * Fetch all accounts with optional filtering
 */
export async function fetchAccounts(filters?: AccountFilters): Promise<Account[]> {
    let query = supabase
        .from('accounts')
        .select('*')
        .order('created_at', { ascending: false });

    // Apply filters if provided
    if (filters?.brand) {
        query = query.eq('brand', filters.brand);
    }
    if (filters?.status) {
        query = query.eq('status', filters.status);
    }
    if (filters?.expiry_before) {
        query = query.lte('expiry_date', filters.expiry_before);
    }
    if (filters?.expiry_after) {
        query = query.gte('expiry_date', filters.expiry_after);
    }

    const { data, error } = await query;

    if (error) {
        throw new Error(`Failed to fetch accounts: ${error.message}`);
    }

    return data as Account[];
}

/**
 * Fetch a single account by ID
 */
export async function fetchAccountById(id: string): Promise<Account | null> {
    const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            return null; // Not found
        }
        throw new Error(`Failed to fetch account: ${error.message}`);
    }

    return data as Account;
}

/**
 * Fetch ready accounts by brand, sorted by expiry date (FIFO for auto-assign)
 */
export async function fetchReadyAccountsByBrand(
    brand: AccountBrand,
    voucherType?: string
): Promise<Account[]> {
    let query = supabase
        .from('accounts')
        .select('*')
        .eq('brand', brand)
        .eq('status', 'ready')
        .order('expiry_date', { ascending: true }); // Soonest expiry first

    if (voucherType) {
        query = query.eq('voucher_type', voucherType);
    }

    const { data, error } = await query;

    if (error) {
        throw new Error(`Failed to fetch ready accounts: ${error.message}`);
    }

    return data as Account[];
}

/**
 * Get account statistics for dashboard
 */
export async function fetchAccountStatistics(): Promise<AccountStatistics> {
    const { data: accounts, error } = await supabase
        .from('accounts')
        .select('status, brand, purchase_price, expiry_date');

    if (error) {
        throw new Error(`Failed to fetch account statistics: ${error.message}`);
    }

    const today = new Date();
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(today.getDate() + 3);
    const threeDaysStr = threeDaysFromNow.toISOString().split('T')[0];

    // Initialize counters
    const stats: AccountStatistics = {
        total: accounts?.length || 0,
        by_status: {
            ready: 0,
            booked: 0,
            sold: 0,
            expired: 0,
            issue: 0,
        },
        by_brand: {
            kopken: 0,
            fore: 0,
        },
        expiring_soon: 0,
        total_value: 0,
    };

    // Calculate statistics
    accounts?.forEach((account) => {
        // Count by status
        stats.by_status[account.status as AccountStatus]++;

        // Count by brand
        stats.by_brand[account.brand as AccountBrand]++;

        // Count expiring soon (within 3 days)
        if (account.status === 'ready' && account.expiry_date <= threeDaysStr) {
            stats.expiring_soon++;
        }

        // Sum purchase price for ready accounts
        if (account.status === 'ready') {
            stats.total_value += account.purchase_price || 0;
        }
    });

    return stats;
}

// -----------------------------------------------------------------------------
// Write Operations (Mutations)
// -----------------------------------------------------------------------------

/**
 * Create a new account
 */
export async function createAccount(account: AccountInsert): Promise<Account> {
    const { data, error } = await supabase
        .from('accounts')
        .insert(account)
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to create account: ${error.message}`);
    }

    return data as Account;
}

/**
 * Update an existing account
 */
export async function updateAccount(
    id: string,
    updates: AccountUpdate
): Promise<Account> {
    const { data, error } = await supabase
        .from('accounts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to update account: ${error.message}`);
    }

    return data as Account;
}

/**
 * Update account status (optimized for quick status changes)
 */
export async function updateAccountStatus(
    id: string,
    status: AccountStatus
): Promise<Account> {
    return updateAccount(id, { status });
}

/**
 * Delete an account
 */
export async function deleteAccount(id: string): Promise<void> {
    const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', id);

    if (error) {
        throw new Error(`Failed to delete account: ${error.message}`);
    }
}

/**
 * Mark account as sold and create income transaction
 */
export async function markAccountAsSold(
    id: string,
    salePrice: number
): Promise<Account> {
    // Update account status
    const account = await updateAccountStatus(id, 'sold');

    // Create income transaction
    const { error: txError } = await supabase
        .from('transactions')
        .insert({
            transaction_type: 'income',
            amount: salePrice,
            category: 'Account Sale',
            description: `Sold ${account.brand} account: ${account.phone_number}`,
            related_account_id: id,
        });

    if (txError) {
        console.error('Failed to create transaction:', txError);
        // Don't throw - account is already sold, transaction is secondary
    }

    return account;
}
