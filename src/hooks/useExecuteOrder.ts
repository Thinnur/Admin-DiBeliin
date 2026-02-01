// =============================================================================
// DiBeliin Admin - Execute Order Hook
// =============================================================================
// Hook for executing optimized order strategy by assigning real accounts

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
    fetchReadyAccountsForVoucher,
    batchUpdateVouchers,
    updateAccountStatus,
    shouldMarkAsSold,
    type VoucherUpdate,
} from '@/services/apiAccounts';
import type { Account, AccountBrand } from '@/types/database';
import type { OptimizedGroup } from '@/lib/logic/optimizer';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface AssignedAccount {
    groupId: number;
    account: Account;
    voucherType: 'nomin' | 'min50k';
    groupTotal: number;
    estimatedDiscount: number;
}

export interface ExecutionResult {
    success: boolean;
    assignedAccounts: AssignedAccount[];
    errors: { groupId: number; message: string }[];
    summary: {
        totalGroups: number;
        successfulGroups: number;
        failedGroups: number;
    };
}

export interface ExecuteOrderInput {
    groups: OptimizedGroup[];
    brand: AccountBrand;
}

// -----------------------------------------------------------------------------
// Account Assignment Logic
// -----------------------------------------------------------------------------

/**
 * Find the best available account for a specific voucher type
 * Uses FIFO logic (soonest expiry first)
 * Also tracks which accounts we've already assigned in this batch
 */
async function findBestAccountForVoucher(
    brand: AccountBrand,
    voucherType: 'nomin' | 'min50k',
    excludeIds: Set<string>
): Promise<Account | null> {
    const accounts = await fetchReadyAccountsForVoucher(brand, voucherType);

    // Find first account not already assigned in this batch
    const available = accounts.find((acc) => !excludeIds.has(acc.id));

    return available || null;
}

/**
 * Execute the optimized order strategy
 * Assigns real accounts to each group and updates the database
 */
async function executeOrderStrategy(
    input: ExecuteOrderInput
): Promise<ExecutionResult> {
    const { groups, brand } = input;

    const assignedAccounts: AssignedAccount[] = [];
    const errors: { groupId: number; message: string }[] = [];
    const usedAccountIds = new Set<string>();
    const voucherUpdates: VoucherUpdate[] = [];
    const accountsToCheckForSold: Account[] = [];

    // Phase 1: Find accounts for each group
    for (const group of groups) {
        const voucherType = group.recommendedVoucher;

        try {
            const account = await findBestAccountForVoucher(
                brand,
                voucherType,
                usedAccountIds
            );

            if (!account) {
                errors.push({
                    groupId: group.id,
                    message: `No available ${voucherType === 'nomin' ? 'No Min' : 'Min 50k'} accounts in stock`,
                });
                continue;
            }

            // Mark this account and voucher as used
            usedAccountIds.add(account.id);

            assignedAccounts.push({
                groupId: group.id,
                account,
                voucherType,
                groupTotal: group.totalPrice,
                estimatedDiscount: group.estimatedDiscount,
            });

            // Prepare voucher update
            voucherUpdates.push({
                accountId: account.id,
                voucherType,
                isReady: false, // Mark voucher as used
            });

            // Track for sold check later
            accountsToCheckForSold.push(account);
        } catch (error) {
            errors.push({
                groupId: group.id,
                message: error instanceof Error ? error.message : 'Failed to find account',
            });
        }
    }

    // Phase 2: Apply all voucher updates
    if (voucherUpdates.length > 0) {
        const { failed } = await batchUpdateVouchers(voucherUpdates);

        // Add any batch update failures to errors
        failed.forEach(({ update, error }) => {
            const assignment = assignedAccounts.find(
                (a) => a.account.id === update.accountId
            );
            if (assignment) {
                errors.push({
                    groupId: assignment.groupId,
                    message: `Failed to update voucher: ${error}`,
                });
            }
        });
    }

    // Phase 3: Check if any accounts should be marked as sold
    // (after voucher update, both vouchers might be exhausted)
    for (const assignment of assignedAccounts) {
        // Simulate the voucher being used
        const updatedAccount = {
            ...assignment.account,
            [assignment.voucherType === 'nomin' ? 'is_nomin_ready' : 'is_min50k_ready']: false,
        };

        if (shouldMarkAsSold(updatedAccount)) {
            try {
                await updateAccountStatus(assignment.account.id, 'sold');
            } catch (error) {
                // Non-critical error, log but don't fail
                console.error(`Failed to mark account ${assignment.account.id} as sold:`, error);
            }
        }
    }

    return {
        success: errors.length === 0,
        assignedAccounts,
        errors,
        summary: {
            totalGroups: groups.length,
            successfulGroups: assignedAccounts.length,
            failedGroups: errors.length,
        },
    };
}

// -----------------------------------------------------------------------------
// React Query Hook
// -----------------------------------------------------------------------------

export function useExecuteOrder() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: executeOrderStrategy,
        onSuccess: (result) => {
            // Invalidate accounts query to refresh inventory
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            queryClient.invalidateQueries({ queryKey: ['account-statistics'] });

            if (result.success) {
                toast.success(
                    `Order executed! ${result.assignedAccounts.length} account(s) assigned.`
                );
            } else if (result.assignedAccounts.length > 0) {
                toast.warning(
                    `Partial success: ${result.assignedAccounts.length}/${result.summary.totalGroups} groups assigned.`
                );
            } else {
                toast.error('Failed to execute order. No accounts could be assigned.');
            }
        },
        onError: (error: Error) => {
            toast.error(`Execution failed: ${error.message}`);
        },
    });
}

// -----------------------------------------------------------------------------
// Utility: Generate Report Text
// -----------------------------------------------------------------------------

export function generateExecutionReport(result: ExecutionResult): string {
    const lines: string[] = [];

    lines.push('📋 ORDER EXECUTION REPORT');
    lines.push('═'.repeat(40));
    lines.push('');

    // Assigned accounts
    if (result.assignedAccounts.length > 0) {
        lines.push('✅ ASSIGNED ACCOUNTS:');
        result.assignedAccounts.forEach((assignment, index) => {
            const voucherLabel = assignment.voucherType === 'nomin' ? 'No Min' : 'Min 50k';
            lines.push(`${index + 1}. Group ${assignment.groupId}:`);
            lines.push(`   📱 Phone: ${assignment.account.phone_number}`);
            lines.push(`   🔑 Password: ${assignment.account.password}`);
            lines.push(`   🎟️ Voucher: ${voucherLabel}`);
            lines.push(`   💰 Total: Rp ${assignment.groupTotal.toLocaleString('id-ID')}`);
            lines.push(`   ✨ Discount: Rp ${assignment.estimatedDiscount.toLocaleString('id-ID')}`);
            lines.push('');
        });
    }

    // Errors
    if (result.errors.length > 0) {
        lines.push('❌ ERRORS:');
        result.errors.forEach((err) => {
            lines.push(`   Group ${err.groupId}: ${err.message}`);
        });
        lines.push('');
    }

    // Summary
    lines.push('─'.repeat(40));
    lines.push(`Total: ${result.summary.successfulGroups}/${result.summary.totalGroups} groups assigned`);

    return lines.join('\n');
}

/**
 * Generate a compact report for quick copying
 */
export function generateCompactReport(result: ExecutionResult): string {
    return result.assignedAccounts
        .map((a, i) => {
            const voucherLabel = a.voucherType === 'nomin' ? 'NoMin' : '50k';
            return `${i + 1}. ${a.account.phone_number} (Pass: ${a.account.password}) - ${voucherLabel}`;
        })
        .join('\n');
}
