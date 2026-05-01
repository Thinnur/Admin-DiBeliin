// =============================================================================
// DiBeliin Admin - Inventory React Query Hooks
// =============================================================================
// TanStack Query v5 hooks with optimistic updates

import {
    useQuery,
    useMutation,
    useQueryClient,
    type UseQueryOptions,
} from '@tanstack/react-query';
import { toast } from 'sonner';

import { queryKeys } from '../lib/queryClient';
import {
    DEVICE_ALL_VALUE,
    DEVICE_UNSET_VALUE,
    type DeviceFilterValue,
} from '../lib/deviceOptions';
import {
    fetchAccounts,
    fetchAccountById,
    fetchAccountStatistics,
    createAccount,
    updateAccount,
    updateAccountStatus,
    deleteAccount,
    fetchReadyAccountsByBrand,
} from '../services/apiAccounts';
import { createTransaction as createExpenseTransaction } from '../services/apiTransactions';
import { autoAssign as autoAssignLogic } from '../lib/logic/autoAssign';
import type {
    Account,
    AccountFilters,
    AccountInsert,
    AccountUpdate,
    AccountStatus,
    AccountStatistics,
    AccountBrand,
    AutoAssignRequest,
    AutoAssignResult,
} from '../types/database';


// -----------------------------------------------------------------------------
// Query Hooks (Read Operations)
// -----------------------------------------------------------------------------

/**
 * Fetch all accounts with optional filtering
 */
export function useAccounts(
    filters?: AccountFilters,
    options?: Omit<UseQueryOptions<Account[], Error>, 'queryKey' | 'queryFn'>
) {
    return useQuery({
        queryKey: queryKeys.accounts.list(filters as Record<string, unknown> | undefined),
        queryFn: () => fetchAccounts(filters),
        ...options,
    });
}


/**
 * Fetch a single account by ID
 */
export function useAccount(
    id: string,
    options?: Omit<UseQueryOptions<Account | null, Error>, 'queryKey' | 'queryFn'>
) {
    return useQuery({
        queryKey: queryKeys.accounts.detail(id),
        queryFn: () => fetchAccountById(id),
        enabled: !!id,
        ...options,
    });
}

/**
 * Fetch account statistics for dashboard
 */
export function useAccountStatistics(
    options?: Omit<UseQueryOptions<AccountStatistics, Error>, 'queryKey' | 'queryFn'>
) {
    return useQuery({
        queryKey: queryKeys.accounts.statistics,
        queryFn: fetchAccountStatistics,
        ...options,
    });
}

/**
 * Fetch ready accounts by brand (for auto-assign preview)
 */
export function useReadyAccounts(
    brand?: AccountBrand,
    options?: Omit<UseQueryOptions<Account[], Error>, 'queryKey' | 'queryFn'>
) {
    return useQuery({
        queryKey: queryKeys.accounts.ready(brand),
        queryFn: () => fetchReadyAccountsByBrand(brand!, undefined),
        enabled: !!brand,
        ...options,
    });
}

/**
 * Fetch akun 'ready' untuk tampilan Staff:
 * - KopKen: 3 akun voucher lengkap (NoMin+50k) + 3 akun hanya Min50k
 * - Fore:   3 akun voucher lengkap (BOGO+35%) + 3 akun hanya 35%
 */
export function useStaffAccounts(
    brand: AccountBrand,
    deviceFilter: DeviceFilterValue = DEVICE_ALL_VALUE,
    options?: Omit<UseQueryOptions<Account[], Error>, 'queryKey' | 'queryFn'>
) {
    return useQuery({
        queryKey: ['accounts', 'staff', brand, deviceFilter],
        queryFn: async () => {
            const { supabase } = await import('../lib/supabase');

            if (brand === 'kopken') {
                // Grup 1: Voucher lengkap (NoMin=true AND Min50k=true)
                let completeQuery = supabase
                    .from('accounts')
                    .select('*')
                    .eq('brand', 'kopken')
                    .eq('status', 'ready')
                    .eq('is_nomin_ready', true)
                    .eq('is_min50k_ready', true);

                if (deviceFilter === DEVICE_UNSET_VALUE) {
                    completeQuery = completeQuery.or('device_name.is.null,device_name.eq.');
                } else if (deviceFilter !== DEVICE_ALL_VALUE) {
                    completeQuery = completeQuery.eq('device_name', deviceFilter);
                }

                const { data: complete } = await completeQuery
                    .order('expiry_date', { ascending: true })
                    .limit(3);

                // Grup 2: Hanya Min50k (NoMin=false AND Min50k=true)
                let min50kOnlyQuery = supabase
                    .from('accounts')
                    .select('*')
                    .eq('brand', 'kopken')
                    .eq('status', 'ready')
                    .eq('is_nomin_ready', false)
                    .eq('is_min50k_ready', true);

                if (deviceFilter === DEVICE_UNSET_VALUE) {
                    min50kOnlyQuery = min50kOnlyQuery.or('device_name.is.null,device_name.eq.');
                } else if (deviceFilter !== DEVICE_ALL_VALUE) {
                    min50kOnlyQuery = min50kOnlyQuery.eq('device_name', deviceFilter);
                }

                const { data: min50kOnly } = await min50kOnlyQuery
                    .order('expiry_date', { ascending: true })
                    .limit(3);

                return [...(complete || []), ...(min50kOnly || [])] as Account[];
            } else {
                // Fore Coffee
                // Grup 1: Voucher lengkap (BOGO=true AND 35%=true)
                let completeQuery = supabase
                    .from('accounts')
                    .select('*')
                    .eq('brand', 'fore')
                    .eq('status', 'ready')
                    .eq('is_bogo_ready', true)
                    .eq('is_discount35_ready', true);

                if (deviceFilter === DEVICE_UNSET_VALUE) {
                    completeQuery = completeQuery.or('device_name.is.null,device_name.eq.');
                } else if (deviceFilter !== DEVICE_ALL_VALUE) {
                    completeQuery = completeQuery.eq('device_name', deviceFilter);
                }

                const { data: complete } = await completeQuery
                    .order('expiry_date', { ascending: true })
                    .limit(3);

                // Grup 2: Hanya 35% (BOGO=false AND 35%=true)
                let disc35OnlyQuery = supabase
                    .from('accounts')
                    .select('*')
                    .eq('brand', 'fore')
                    .eq('status', 'ready')
                    .eq('is_bogo_ready', false)
                    .eq('is_discount35_ready', true);

                if (deviceFilter === DEVICE_UNSET_VALUE) {
                    disc35OnlyQuery = disc35OnlyQuery.or('device_name.is.null,device_name.eq.');
                } else if (deviceFilter !== DEVICE_ALL_VALUE) {
                    disc35OnlyQuery = disc35OnlyQuery.eq('device_name', deviceFilter);
                }

                const { data: disc35Only } = await disc35OnlyQuery
                    .order('expiry_date', { ascending: true })
                    .limit(3);

                return [...(complete || []), ...(disc35Only || [])] as Account[];
            }
        },
        enabled: !!brand,
        ...options,
    });
}

// -----------------------------------------------------------------------------
// Mutation Hooks (Write Operations)
// -----------------------------------------------------------------------------

/**
 * Add a new account
 * Automatically creates an expense transaction if purchase_price > 0
 */
export function useAddAccount() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (account: AccountInsert) => createAccount(account),
        onSuccess: (newAccount, variables) => {
            // Invalidate and refetch accounts list
            queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
            toast.success(`Account ${newAccount.phone_number} added successfully`);

            // Auto-create expense transaction if purchase_price > 0
            if (variables.purchase_price && variables.purchase_price > 0) {
                // Fire-and-forget: Don't block UI if finance recording fails
                createExpenseTransaction({
                    transaction_type: 'expense',
                    amount: variables.purchase_price,
                    category: 'stock',
                    description: `Beli Akun ${variables.brand} - ${variables.phone_number}`,
                    related_account_id: newAccount.id,
                })
                    .then(() => {
                        // Invalidate finance queries to refresh Finance page
                        queryClient.invalidateQueries({ queryKey: ['transactions'] });
                    })
                    .catch((error: Error) => {
                        // Log error but don't crash UI
                        console.error('Failed to record expense transaction:', error);
                        toast.warning('Account added, but failed to record expense. Please add manually in Finance.');
                    });

            }
        },
        onError: (error: Error) => {
            toast.error(`Failed to add account: ${error.message}`);
        },
    });
}


/**
 * Update an existing account
 */
export function useUpdateAccount() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: AccountUpdate }) =>
            updateAccount(id, updates),
        onSuccess: (updatedAccount) => {
            // Update specific account in cache
            queryClient.setQueryData(
                queryKeys.accounts.detail(updatedAccount.id),
                updatedAccount
            );
            // ⚡️ FORCE REFRESH: Mark all 'accounts' data as stale so it refetches immediately
            queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
            toast.success('Account updated successfully');
        },
        onError: (error: Error) => {
            toast.error(`Failed to update account: ${error.message}`);
        },
    });
}

/**
 * Update account status with OPTIMISTIC UPDATE
 * UI updates instantly before server response
 */
export function useUpdateAccountStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, status }: { id: string; status: AccountStatus }) =>
            updateAccountStatus(id, status),

        // Optimistic update - update UI immediately
        onMutate: async ({ id, status }) => {
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey: queryKeys.accounts.all });

            // Snapshot the previous value
            const previousAccounts = queryClient.getQueryData<Account[]>(
                queryKeys.accounts.list()
            );

            // Optimistically update the cache
            if (previousAccounts) {
                queryClient.setQueryData<Account[]>(
                    queryKeys.accounts.list(),
                    previousAccounts.map((account) =>
                        account.id === id ? { ...account, status } : account
                    )
                );
            }

            // Return context with the snapshot
            return { previousAccounts };
        },

        // If mutation fails, rollback to snapshot
        onError: (error: Error, _variables, context) => {
            if (context?.previousAccounts) {
                queryClient.setQueryData(
                    queryKeys.accounts.list(),
                    context.previousAccounts
                );
            }
            toast.error(`Failed to update status: ${error.message}`);
        },

        // Always refetch after error or success
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
        },

        onSuccess: () => {
            toast.success('Status updated');
        },
    });
}

/**
 * Delete an account
 */
export function useDeleteAccount() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => deleteAccount(id),

        // Optimistic delete
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.accounts.all });

            const previousAccounts = queryClient.getQueryData<Account[]>(
                queryKeys.accounts.list()
            );

            if (previousAccounts) {
                queryClient.setQueryData<Account[]>(
                    queryKeys.accounts.list(),
                    previousAccounts.filter((account) => account.id !== id)
                );
            }

            return { previousAccounts };
        },

        onError: (error: Error, _id, context) => {
            if (context?.previousAccounts) {
                queryClient.setQueryData(
                    queryKeys.accounts.list(),
                    context.previousAccounts
                );
            }
            toast.error(`Failed to delete account: ${error.message}`);
        },

        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
        },

        onSuccess: () => {
            toast.success('Account deleted');
        },
    });
}

// -----------------------------------------------------------------------------
// Auto-Assign Hook
// -----------------------------------------------------------------------------

/**
 * Hook for auto-assigning the best available account
 */
export function useAutoAssign() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (request: AutoAssignRequest) => autoAssignLogic(request),
        onSuccess: (result: AutoAssignResult) => {
            if (result.account) {
                toast.success(result.message);
                // Invalidate to reflect any changes
                queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
            } else {
                toast.warning(result.message);
            }
        },
        onError: (error: Error) => {
            toast.error(`Auto-assign failed: ${error.message}`);
        },
    });
}

// -----------------------------------------------------------------------------
// Fix Stale Accounts Hook
// -----------------------------------------------------------------------------

/**
 * Auto-mark accounts with no vouchers left as 'sold'.
 * An account is "stale" when:
 * - KopKen: is_nomin_ready=false AND is_min50k_ready=false AND status='ready'
 * - Fore:   is_bogo_ready=false AND is_discount35_ready=false AND status='ready'
 */
export function useFixStaleAccounts() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            const { supabase } = await import('../lib/supabase');

            // Fetch all ready accounts
            const { data: readyAccounts, error } = await supabase
                .from('accounts')
                .select('id, brand, is_nomin_ready, is_min50k_ready, is_bogo_ready, is_discount35_ready')
                .eq('status', 'ready');

            if (error) throw new Error(error.message);
            if (!readyAccounts || readyAccounts.length === 0) return { fixed: 0 };

            // Identify stale accounts
            const staleIds = readyAccounts
                .filter((a) => {
                    if (a.brand === 'kopken') {
                        return !a.is_nomin_ready && !a.is_min50k_ready;
                    }
                    if (a.brand === 'fore') {
                        return !a.is_bogo_ready && !a.is_discount35_ready;
                    }
                    return false;
                })
                .map((a) => a.id);

            if (staleIds.length === 0) return { fixed: 0 };

            // Batch update to 'sold'
            const { error: updateError } = await supabase
                .from('accounts')
                .update({ status: 'sold' })
                .in('id', staleIds);

            if (updateError) throw new Error(updateError.message);

            return { fixed: staleIds.length };
        },
        onSuccess: ({ fixed }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
            if (fixed > 0) {
                toast.success(`${fixed} akun tanpa voucher ditandai sebagai Sold.`);
            } else {
                toast.info('Tidak ada akun stale yang ditemukan.');
            }
        },
        onError: (error: Error) => {
            toast.error(`Fix Stale gagal: ${error.message}`);
        },
    });
}

