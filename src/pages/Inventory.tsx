// =============================================================================
// DiBeliin Admin - Inventory Management Page
// =============================================================================
// Premium inventory page for managing coffee shop accounts

import { useState, useMemo } from 'react';
import { Package, Coffee, Ticket } from 'lucide-react';
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
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs';

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

type StatusFilter = 'all' | AccountStatus;

// -----------------------------------------------------------------------------
// Stats Calculation (for summary cards)
// -----------------------------------------------------------------------------

interface VoucherStats {
    foreNomin: number;
    kopkenNomin: number;
    kopkenMin50k: number;
}

function calculateVoucherStats(accounts: Account[]): VoucherStats {
    return {
        foreNomin: accounts.filter(
            (a) => a.brand === 'fore' && a.is_nomin_ready === true
        ).length,
        kopkenNomin: accounts.filter(
            (a) => a.brand === 'kopken' && a.is_nomin_ready === true
        ).length,
        kopkenMin50k: accounts.filter(
            (a) => a.brand === 'kopken' && a.is_min50k_ready === true
        ).length,
    };
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function InventoryPage() {
    // Tab state for brand selection
    const [activeTab, setActiveTab] = useState<AccountBrand>('kopken');

    // Status filter
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

    // Search query state (will be managed via DataTable internally, but we track it manually for smart filtering)
    const [searchQuery, setSearchQuery] = useState('');

    // Fetch ALL accounts (no server-side filtering, we filter client-side now)
    const {
        data: allAccounts,
        isLoading,
        isError,
    } = useAccounts();

    // Mutations
    const deleteAccount = useDeleteAccount();
    const updateStatus = useUpdateAccountStatus();
    const updateAccount = useUpdateAccount();

    // Calculate voucher stats from all accounts (memoized)
    const voucherStats = useMemo(
        () => calculateVoucherStats(allAccounts || []),
        [allAccounts]
    );

    // Smart Filtered Accounts Logic
    const filteredAccounts = useMemo(() => {
        if (!allAccounts) return [];

        let result = allAccounts;

        // Rule 1: Always filter by active Tab (Brand)
        result = result.filter((account) => account.brand === activeTab);

        // Rule 2 (Visibility / Smart Filtering):
        // IF searchQuery is empty AND filterStatus is 'all' (default):
        //   ONLY show accounts where status === 'ready' (Hide sold/expired/issue)
        // ELSE (If user searches OR explicitly selects a status filter):
        //   Show matching accounts regardless of status
        const isDefaultState = searchQuery.trim() === '' && statusFilter === 'all';

        if (isDefaultState) {
            // Default: Only show ready accounts
            result = result.filter((account) => account.status === 'ready');
        } else {
            // User is searching or filtering explicitly
            if (statusFilter !== 'all') {
                result = result.filter((account) => account.status === statusFilter);
            }
            // Search is handled by DataTable's internal filter
        }

        return result;
    }, [allAccounts, activeTab, searchQuery, statusFilter]);

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

    // Handle search input change (for smart filtering logic)
    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
    };

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
            {/* Summary Stats Cards - Ready Stock */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Sisa Voucher Fore */}
                <Card className="shadow-sm bg-gradient-to-br from-amber-50 to-white border-amber-100">
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-amber-100 rounded-xl">
                                <Coffee className="h-5 w-5 text-amber-600" />
                            </div>
                            <CardTitle className="text-base font-medium text-slate-700">
                                Sisa Voucher Fore
                            </CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-4xl font-bold text-amber-600 tabular-nums">
                            {voucherStats.foreNomin}
                        </p>
                        <p className="text-sm text-slate-500 mt-1">Voucher No Minimum</p>
                    </CardContent>
                </Card>

                {/* Sisa KopKen No Min */}
                <Card className="shadow-sm bg-gradient-to-br from-emerald-50 to-white border-emerald-100">
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-emerald-100 rounded-xl">
                                <Ticket className="h-5 w-5 text-emerald-600" />
                            </div>
                            <CardTitle className="text-base font-medium text-slate-700">
                                Sisa KopKen No Min
                            </CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-4xl font-bold text-emerald-600 tabular-nums">
                            {voucherStats.kopkenNomin}
                        </p>
                        <p className="text-sm text-slate-500 mt-1">Voucher No Minimum</p>
                    </CardContent>
                </Card>

                {/* Sisa KopKen Min 50k */}
                <Card className="shadow-sm bg-gradient-to-br from-blue-50 to-white border-blue-100">
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-blue-100 rounded-xl">
                                <Package className="h-5 w-5 text-blue-600" />
                            </div>
                            <CardTitle className="text-base font-medium text-slate-700">
                                Sisa KopKen Min 50k
                            </CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-4xl font-bold text-blue-600 tabular-nums">
                            {voucherStats.kopkenMin50k}
                        </p>
                        <p className="text-sm text-slate-500 mt-1">Voucher Min. Belanja 50rb</p>
                    </CardContent>
                </Card>
            </div>

            {/* Brand Tabs with Table */}
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
                            {(statusFilter !== 'all' || searchQuery.trim() !== '') && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setStatusFilter('all');
                                        setSearchQuery('');
                                    }}
                                    className="text-slate-500"
                                >
                                    Clear Filters
                                </Button>
                            )}

                            <AddAccountDialog />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-4">
                    <Tabs
                        value={activeTab}
                        onValueChange={(value) => setActiveTab(value as AccountBrand)}
                    >
                        <TabsList className="mb-4">
                            <TabsTrigger value="kopken" className="gap-2">
                                <Coffee className="h-4 w-4" />
                                Kopi Kenangan
                            </TabsTrigger>
                            <TabsTrigger value="fore" className="gap-2">
                                <Coffee className="h-4 w-4" />
                                Fore Coffee
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="kopken">
                            <div className="max-h-[80vh] overflow-y-auto overflow-x-auto">
                                <DataTable
                                    columns={columns}
                                    data={filteredAccounts}
                                    isLoading={isLoading}
                                    filterColumnName="phone_number"
                                    filterPlaceholder="Search by phone number..."
                                    onFilterChange={handleSearchChange}
                                    disablePagination={true}
                                    emptyMessage={
                                        statusFilter !== 'all' || searchQuery.trim() !== ''
                                            ? 'No accounts match your filters.'
                                            : 'No ready accounts found for Kopi Kenangan.'
                                    }
                                />
                            </div>
                        </TabsContent>

                        <TabsContent value="fore">
                            <div className="max-h-[80vh] overflow-y-auto overflow-x-auto">
                                <DataTable
                                    columns={columns}
                                    data={filteredAccounts}
                                    isLoading={isLoading}
                                    filterColumnName="phone_number"
                                    filterPlaceholder="Search by phone number..."
                                    onFilterChange={handleSearchChange}
                                    disablePagination={true}
                                    emptyMessage={
                                        statusFilter !== 'all' || searchQuery.trim() !== ''
                                            ? 'No accounts match your filters.'
                                            : 'No ready accounts found for Fore Coffee.'
                                    }
                                />
                            </div>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}
