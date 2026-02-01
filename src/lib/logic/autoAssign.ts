// =============================================================================
// DiBeliin Admin - Auto-Assign Logic
// =============================================================================
// FIFO logic to pick the best available account based on expiry date

import type {
    Account,
    AccountBrand,
    AutoAssignRequest,
    AutoAssignResult,
} from '../../types/database';
import { fetchReadyAccountsByBrand } from '../../services/apiAccounts';

/**
 * Auto-assign the best available account based on criteria.
 * 
 * Algorithm:
 * 1. Filter accounts by brand and status = 'ready'
 * 2. Optionally filter by voucher_type if specified
 * 3. Sort by expiry_date ASC (soonest expiring first - FIFO)
 * 4. Return first matching account
 * 5. Return null if no accounts available
 * 
 * @param request - The auto-assign request with brand and optional voucher type
 * @returns AutoAssignResult with the best account or null
 */
export async function autoAssign(
    request: AutoAssignRequest
): Promise<AutoAssignResult> {
    const { brand, voucher_type } = request;

    try {
        // Fetch ready accounts sorted by expiry date (ascending)
        const accounts = await fetchReadyAccountsByBrand(brand, voucher_type);

        // No accounts available
        if (accounts.length === 0) {
            return {
                account: null,
                message: voucher_type
                    ? `No ready ${brand.toUpperCase()} accounts with ${voucher_type} voucher available`
                    : `No ready ${brand.toUpperCase()} accounts available`,
                available_count: 0,
            };
        }

        // Return the first account (soonest to expire - FIFO)
        const bestAccount = accounts[0];

        return {
            account: bestAccount,
            message: `Found ${accounts.length} ready account(s). Assigned: ${bestAccount.phone_number}`,
            available_count: accounts.length,
        };
    } catch (error) {
        return {
            account: null,
            message: `Error during auto-assign: ${error instanceof Error ? error.message : 'Unknown error'}`,
            available_count: 0,
        };
    }
}

/**
 * Get the best account from an existing list (for offline/cached use)
 * 
 * @param accounts - Pre-fetched list of accounts
 * @param brand - Required brand filter
 * @param voucherType - Optional voucher type filter
 * @returns The best account or null
 */
export function pickBestAccount(
    accounts: Account[],
    brand: AccountBrand,
    voucherType?: string
): Account | null {
    // Filter by brand and ready status
    let candidates = accounts.filter(
        (acc) => acc.brand === brand && acc.status === 'ready'
    );

    // Filter by voucher type if specified
    if (voucherType) {
        candidates = candidates.filter(
            (acc) => acc.voucher_type === voucherType
        );
    }

    // Sort by expiry date (ascending - soonest first)
    candidates.sort((a, b) => {
        const dateA = new Date(a.expiry_date).getTime();
        const dateB = new Date(b.expiry_date).getTime();
        return dateA - dateB;
    });

    // Return first (soonest expiring) or null
    return candidates[0] || null;
}

/**
 * Check if an account is expiring soon (within specified days)
 * 
 * @param account - Account to check
 * @param withinDays - Number of days threshold (default: 3)
 * @returns true if expiring within the threshold
 */
export function isExpiringSoon(account: Account, withinDays = 3): boolean {
    const today = new Date();
    const expiryDate = new Date(account.expiry_date);
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays <= withinDays;
}

/**
 * Get expiry status for visual display
 * 
 * @param account - Account to check
 * @returns 'expired' | 'critical' | 'warning' | 'ok'
 */
export function getExpiryStatus(
    account: Account
): 'expired' | 'critical' | 'warning' | 'ok' {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiryDate = new Date(account.expiry_date);
    expiryDate.setHours(0, 0, 0, 0);

    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'expired';
    if (diffDays <= 3) return 'critical';  // Red
    if (diffDays <= 7) return 'warning';   // Yellow
    return 'ok';                            // Green/Normal
}
