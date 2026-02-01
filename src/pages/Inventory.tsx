// =============================================================================
// DiBeliin Admin - Inventory Management Page
// =============================================================================
// Premium inventory page for managing coffee shop accounts

import { useState } from 'react';
import { Package, Coffee } from 'lucide-react';
import { toast } from 'sonner';

import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

import { AddAccountDialog } from '@/components/inventory/AddAccountDialog';
import {
    createAccountColumns,
    type AccountColumnActions,
} from '@/components/inventory/AccountColumns';
import {
    useAccounts,
    useDeleteAccount,
    useUpdateAccountStatus,
    useUpdateAccount,
} from '@/hooks/useInventory';
import type { Account, AccountBrand, AccountStatus } from '@/types/database';

// -----------------------------------------------------------------------------
// Filter Types
// -----------------------------------------------------------------------------

type BrandFilter = 'all' | AccountBrand;
type StatusFilter = 'all' | AccountStatus;

// -----------------------------------------------------------------------------
// Stats Cards
// -----------------------------------------------------------------------------

interface StatsData {
    total: number;
    ready: number;
    booked: number;
    expiringSoon: number;
}

function calculateStats(accounts: Account[]): StatsData {
    const today = new Date();
    const threeDaysFromNow = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);

    return {
        total: accounts.length,
        ready: accounts.filter((a) => a.status === 'ready').length,
        booked: accounts.filter((a) => a.status === 'booked').length,
        expiringSoon: accounts.filter((a) => {
            const expiry = new Date(a.expiry_date);
            return expiry <= threeDaysFromNow && expiry >= today && a.status === 'ready';
        }).length,
    };
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function InventoryPage() {
    // Filter state
    const [brandFilter, setBrandFilter] = useState<BrandFilter>('all');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

    // Build filter object for query
    const queryFilters = {
        ...(brandFilter !== 'all' && { brand: brandFilter }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
    };

    // Fetch accounts with filters
    const {
        data: accounts,
        isLoading,
        isError,
    } = useAccounts(
        Object.keys(queryFilters).length > 0 ? queryFilters : undefined
    );

    // Mutations
    const deleteAccount = useDeleteAccount();
    const updateStatus = useUpdateAccountStatus();
    const updateAccount = useUpdateAccount();

    // Calculate stats
    const stats = calculateStats(accounts || []);

    // Action handlers
    const handleEdit = (account: Account) => {
        toast.info(`Edit ${account.phone_number} - Coming soon!`);
    };

    const handleDelete = (account: Account) => {
        if (confirm(`Are you sure you want to delete ${account.phone_number}?`)) {
            deleteAccount.mutate(account.id);
        }
    };

    const handleMarkAsSold = (account: Account) => {
        updateStatus.mutate({
            id: account.id,
            status: 'sold',
        });
    };

    const handleToggleVoucher = (account: Account, voucher: 'nomin' | 'min50k', newValue: boolean) => {
        const updates = voucher === 'nomin'
            ? { is_nomin_ready: newValue }
            : { is_min50k_ready: newValue };

        updateAccount.mutate({
            id: account.id,
            updates,
        });
    };

    // Create columns with actions
    const columnActions: AccountColumnActions = {
        onEdit: handleEdit,
        onDelete: handleDelete,
        onMarkAsSold: handleMarkAsSold,
        onToggleVoucher: handleToggleVoucher,
    };
    const columns = createAccountColumns(columnActions);

    // Error state
    if (isError) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <p className="text-red-500">Failed to load accounts. Please try again.</p>
                <Button onClick={() => window.location.reload()}>Retry</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 rounded-lg">
                            <Package className="h-5 w-5 text-slate-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900 tabular-nums">
                                {stats.total}
                            </p>
                            <p className="text-sm text-slate-500">Total Accounts</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 rounded-lg">
                            <Coffee className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-emerald-600 tabular-nums">
                                {stats.ready}
                            </p>
                            <p className="text-sm text-slate-500">Ready to Sell</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-lg">
                            <Coffee className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-blue-600 tabular-nums">
                                {stats.booked}
                            </p>
                            <p className="text-sm text-slate-500">Booked</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-50 rounded-lg">
                            <Coffee className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-amber-600 tabular-nums">
                                {stats.expiringSoon}
                            </p>
                            <p className="text-sm text-slate-500">Expiring Soon</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Account Table Card */}
            <Card className="shadow-sm">
                <CardHeader className="border-b border-slate-100 pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <CardTitle className="text-lg">Account Inventory</CardTitle>
                            <CardDescription>
                                Your coffee shop account collection
                            </CardDescription>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            {/* Brand Filter */}
                            <Select
                                value={brandFilter}
                                onValueChange={(value) => setBrandFilter(value as BrandFilter)}
                            >
                                <SelectTrigger className="w-[140px] bg-white">
                                    <SelectValue placeholder="Brand" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Brands</SelectItem>
                                    <SelectItem value="kopken">Kopi Kenangan</SelectItem>
                                    <SelectItem value="fore">Fore Coffee</SelectItem>
                                </SelectContent>
                            </Select>

                            {/* Status Filter */}
                            <Select
                                value={statusFilter}
                                onValueChange={(value) =>
                                    setStatusFilter(value as StatusFilter)
                                }
                            >
                                <SelectTrigger className="w-[130px] bg-white">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="ready">Ready</SelectItem>
                                    <SelectItem value="booked">Booked</SelectItem>
                                    <SelectItem value="sold">Sold</SelectItem>
                                    <SelectItem value="expired">Expired</SelectItem>
                                    <SelectItem value="issue">Issue</SelectItem>
                                </SelectContent>
                            </Select>

                            {/* Clear Filters */}
                            {(brandFilter !== 'all' || statusFilter !== 'all') && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setBrandFilter('all');
                                        setStatusFilter('all');
                                    }}
                                    className="text-slate-500"
                                >
                                    Clear
                                </Button>
                            )}

                            <AddAccountDialog />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-4">
                    <DataTable
                        columns={columns}
                        data={accounts || []}
                        isLoading={isLoading}
                        filterColumnName="phone_number"
                        filterPlaceholder="Search by phone number..."
                        emptyMessage={
                            brandFilter !== 'all' || statusFilter !== 'all'
                                ? 'No accounts match your filters.'
                                : 'No accounts found. Add your first account!'
                        }
                    />
                </CardContent>
            </Card>
        </div>
    );
}
