// =============================================================================
// DiBeliin Admin - Inventory Management Page
// =============================================================================
// Premium inventory page for managing coffee shop accounts

import { useState, useMemo } from 'react';
import { Package, Coffee, Ticket, Plus } from 'lucide-react';

import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
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
    useStaffAccounts,
} from '@/hooks/useInventory';
import { useAuth } from '@/contexts/AuthContext';
import type { Account, AccountBrand, AccountStatus } from '@/types/database';

// -----------------------------------------------------------------------------
// Filter Types
// -----------------------------------------------------------------------------

type StatusFilter = 'all' | AccountStatus;

// -----------------------------------------------------------------------------
// Stats Calculation (for summary cards)
// -----------------------------------------------------------------------------

interface VoucherStats {
    foreBogo: number;
    foreDisc35: number;
    foreTotal: number;
    kopkenNomin: number;
    kopkenMin50k: number;
    kopkenTotal: number;
}

function calculateVoucherStats(accounts: Account[]): VoucherStats {
    const foreAccounts = accounts.filter((a) => a.brand === 'fore');
    const kopkenAccounts = accounts.filter((a) => a.brand === 'kopken');
    return {
        foreBogo: foreAccounts.filter((a) => a.is_bogo_ready === true).length,
        foreDisc35: foreAccounts.filter((a) => a.is_discount35_ready === true).length,
        foreTotal: foreAccounts.length,
        kopkenNomin: kopkenAccounts.filter((a) => a.is_nomin_ready === true).length,
        kopkenMin50k: kopkenAccounts.filter((a) => a.is_min50k_ready === true).length,
        kopkenTotal: kopkenAccounts.length,
    };
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function InventoryPage() {
    // Deteksi role user + status pemulihan sesi auth
    const { isStaff, isLoading: isAuthLoading } = useAuth();

    // Tab state for brand selection
    const [activeTab, setActiveTab] = useState<AccountBrand>('kopken');

    // Status filter
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

    // Search query state (will be managed via DataTable internally, but we track it manually for smart filtering)
    const [searchQuery, setSearchQuery] = useState('');

    // Edit dialog state
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // "In Use By" dialog state
    const [inUseAccount, setInUseAccount] = useState<Account | null>(null);
    const [isInUseDialogOpen, setIsInUseDialogOpen] = useState(false);
    const [inUseByName, setInUseByName] = useState('');

    // Fetch data: Staff pakai hook terbatas (limit 6, status=ready only)
    // Super Admin pakai hook penuh (semua data)
    // Guard: !isAuthLoading memastikan query TIDAK jalan sebelum sesi auth selesai dipulihkan
    const {
        data: allAccountsAdmin,
        isLoading: isLoadingAdmin,
        isError: isErrorAdmin,
    } = useAccounts(undefined, { enabled: !isAuthLoading && !isStaff });

    const {
        data: staffAccountsKopken,
        isLoading: isLoadingStaffKopken,
        isError: isErrorStaffKopken,
    } = useStaffAccounts('kopken', { enabled: !isAuthLoading && isStaff });

    const {
        data: staffAccountsFore,
        isLoading: isLoadingStaffFore,
        isError: isErrorStaffFore,
    } = useStaffAccounts('fore', { enabled: !isAuthLoading && isStaff });

    // Gabungkan berdasarkan role
    const allAccounts = isStaff
        ? [...(staffAccountsKopken || []), ...(staffAccountsFore || [])]
        : (allAccountsAdmin || []);
    // isLoading harus true juga selama sesi auth belum selesai dipulihkan
    const isLoading = isAuthLoading || (isStaff
        ? (isLoadingStaffKopken || isLoadingStaffFore)
        : isLoadingAdmin);
    const isError = isStaff
        ? (isErrorStaffKopken || isErrorStaffFore)
        : isErrorAdmin;

    // Mutations
    const deleteAccount = useDeleteAccount();
    const updateStatus = useUpdateAccountStatus();
    const updateAccount = useUpdateAccount();

    // Calculate voucher stats from all accounts (memoized)
    const voucherStats = useMemo(
        () => calculateVoucherStats(allAccounts || []),
        [allAccounts]
    );

    // -------------------------------------------------------------------------
    // Value Priority Sorting Helper
    // -------------------------------------------------------------------------
    const getVoucherPriority = (account: Account): number => {
        if (account.is_nomin_ready && account.is_min50k_ready) return 0; // Complete
        if (account.is_nomin_ready) return 1;  // NoMin only
        if (account.is_min50k_ready) return 2; // Min50k only
        return 3; // Empty
    };

    // Smart Filtered & Sorted Accounts Logic
    const filteredAccounts = useMemo(() => {
        // Untuk Staff: data sudah di-filter server-side (ready, limit 6), tinggal filter per brand
        if (isStaff) {
            const staffData = activeTab === 'kopken'
                ? (staffAccountsKopken || [])
                : (staffAccountsFore || []);
            return [...staffData].sort((a, b) =>
                new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime()
            );
        }

        // Untuk Super Admin: logika filter & sort penuh
        if (!allAccountsAdmin) return [];

        let result = allAccountsAdmin;

        // Rule 1: Always filter by active Tab (Brand)
        result = result.filter((account) => account.brand === activeTab);

        // Rule 2: Smart Filtering
        const isDefaultState = searchQuery.trim() === '' && statusFilter === 'all';

        if (isDefaultState) {
            result = result.filter(
                (account) => account.status === 'ready' || account.status === 'in_use'
            );
        } else {
            if (statusFilter !== 'all') {
                result = result.filter((account) => account.status === statusFilter);
            }
        }

        // Rule 3: Priority Sort
        result = [...result].sort((a, b) => {
            if (a.status === 'in_use' && b.status !== 'in_use') return -1;
            if (a.status !== 'in_use' && b.status === 'in_use') return 1;

            if (a.status === 'ready' && b.status === 'ready') {
                const priorityDiff = getVoucherPriority(a) - getVoucherPriority(b);
                if (priorityDiff !== 0) return priorityDiff;
            }

            return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime();
        });

        return result;
    }, [allAccounts, allAccountsAdmin, staffAccountsKopken, staffAccountsFore, activeTab, searchQuery, statusFilter, isStaff]);

    // Action handlers
    const handleEdit = (account: Account) => {
        setEditingAccount(account);
        setIsDialogOpen(true);
    };

    const handleAddNew = () => {
        setEditingAccount(null);
        setIsDialogOpen(true);
    };

    const handleDelete = (account: Account) => {
        if (confirm(`Are you sure you want to delete ${account.phone_number}?`)) {
            deleteAccount.mutate(account.id);
        }
    };

    const handleMarkAsSold = (account: Account) => {
        // Clear in_use_by when moving away from in_use
        if (account.status === 'in_use') {
            updateAccount.mutate({
                id: account.id,
                updates: { status: 'sold', in_use_by: null },
            });
        } else {
            updateStatus.mutate({
                id: account.id,
                status: 'sold',
            });
        }
    };

    const handleMarkAsInUse = (account: Account) => {
        // Open dialog to ask who is using this account
        setInUseAccount(account);
        setInUseByName('');
        setIsInUseDialogOpen(true);
    };

    const handleConfirmInUse = () => {
        if (!inUseAccount || !inUseByName.trim()) return;
        updateAccount.mutate({
            id: inUseAccount.id,
            updates: { status: 'in_use', in_use_by: inUseByName.trim() },
        });
        setIsInUseDialogOpen(false);
        setInUseAccount(null);
        setInUseByName('');
    };

    const handleMarkAsReady = (account: Account) => {
        // Clear in_use_by when returning to ready
        updateAccount.mutate({
            id: account.id,
            updates: { status: 'ready', in_use_by: null },
        });
    };

    const handleToggleVoucher = (account: Account, voucher: 'nomin' | 'min50k' | 'bogo' | 'disc35', newValue: boolean) => {
        const updates =
            voucher === 'nomin' ? { is_nomin_ready: newValue }
                : voucher === 'min50k' ? { is_min50k_ready: newValue }
                    : voucher === 'bogo' ? { is_bogo_ready: newValue }
                        : { is_discount35_ready: newValue };

        updateAccount.mutate({
            id: account.id,
            updates,
        });
    };

    const handleDialogOpenChange = (open: boolean) => {
        setIsDialogOpen(open);
        if (!open) {
            setEditingAccount(null); // Reset on close
        }
    };

    // Create columns with actions (memoized)
    const columns = useMemo(() => {
        const columnActions: AccountColumnActions = {
            onEdit: handleEdit,
            onDelete: handleDelete,
            onMarkAsSold: handleMarkAsSold,
            onMarkAsInUse: handleMarkAsInUse,
            onMarkAsReady: handleMarkAsReady,
            onToggleVoucher: handleToggleVoucher,
            isStaff, // Staff tidak bisa Edit/Delete
        };
        return createAccountColumns(columnActions);
    }, [isStaff]);

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
            {/* Edit/Add Account Dialog (controlled externally) */}
            <AddAccountDialog
                open={isDialogOpen}
                onOpenChange={handleDialogOpenChange}
                accountToEdit={editingAccount}
            />

            {/* "In Use By" Confirmation Dialog */}
            <Dialog open={isInUseDialogOpen} onOpenChange={(open) => {
                setIsInUseDialogOpen(open);
                if (!open) {
                    setInUseAccount(null);
                    setInUseByName('');
                }
            }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Tandai Sedang Digunakan</DialogTitle>
                        <DialogDescription>
                            Siapa yang menggunakan akun{' '}
                            <span className="font-semibold text-foreground">
                                {inUseAccount?.phone_number}
                            </span>
                            ?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Input
                            placeholder="Nama pengguna (contoh: Thinnur)"
                            value={inUseByName}
                            onChange={(e) => setInUseByName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && inUseByName.trim()) {
                                    handleConfirmInUse();
                                }
                            }}
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsInUseDialogOpen(false)}
                        >
                            Batal
                        </Button>
                        <Button
                            onClick={handleConfirmInUse}
                            disabled={!inUseByName.trim()}
                            className="bg-violet-600 hover:bg-violet-700"
                        >
                            Konfirmasi
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Summary Stats Cards - disembunyikan untuk Staff */}
            {!isStaff && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
                {/* Fore BOGO */}
                <Card className="shadow-sm bg-gradient-to-br from-amber-50 to-white border-amber-100">
                    <CardHeader className="pb-1 md:pb-2 p-3 md:p-6">
                        <div className="flex items-center gap-2 md:gap-3">
                            <div className="p-1.5 md:p-2.5 bg-amber-100 rounded-lg md:rounded-xl">
                                <Coffee className="h-4 w-4 md:h-5 md:w-5 text-amber-600" />
                            </div>
                            <CardTitle className="text-xs md:text-base font-medium text-slate-700 leading-tight">
                                Fore BOGO
                            </CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
                        <p className="text-2xl md:text-4xl font-bold tabular-nums">
                            <span className="text-amber-600">{voucherStats.foreBogo}</span>
                            <span className="text-sm md:text-xl text-slate-400 font-semibold">/{voucherStats.foreTotal}</span>
                        </p>
                        <p className="text-[10px] md:text-sm text-slate-500 mt-0.5 md:mt-1">Buy 1 Get 1</p>
                    </CardContent>
                </Card>

                {/* Fore 35% */}
                <Card className="shadow-sm bg-gradient-to-br from-orange-50 to-white border-orange-100">
                    <CardHeader className="pb-1 md:pb-2 p-3 md:p-6">
                        <div className="flex items-center gap-2 md:gap-3">
                            <div className="p-1.5 md:p-2.5 bg-orange-100 rounded-lg md:rounded-xl">
                                <Ticket className="h-4 w-4 md:h-5 md:w-5 text-orange-500" />
                            </div>
                            <CardTitle className="text-xs md:text-base font-medium text-slate-700 leading-tight">
                                Fore 35%
                            </CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
                        <p className="text-2xl md:text-4xl font-bold tabular-nums">
                            <span className="text-orange-500">{voucherStats.foreDisc35}</span>
                            <span className="text-sm md:text-xl text-slate-400 font-semibold">/{voucherStats.foreTotal}</span>
                        </p>
                        <p className="text-[10px] md:text-sm text-slate-500 mt-0.5 md:mt-1">Diskon 35%</p>
                    </CardContent>
                </Card>

                {/* Sisa KopKen No Min */}
                <Card className="shadow-sm bg-gradient-to-br from-emerald-50 to-white border-emerald-100">
                    <CardHeader className="pb-1 md:pb-2 p-3 md:p-6">
                        <div className="flex items-center gap-2 md:gap-3">
                            <div className="p-1.5 md:p-2.5 bg-emerald-100 rounded-lg md:rounded-xl">
                                <Package className="h-4 w-4 md:h-5 md:w-5 text-emerald-600" />
                            </div>
                            <CardTitle className="text-xs md:text-base font-medium text-slate-700 leading-tight">
                                KopKen
                                <span className="hidden md:inline"> No Min</span>
                            </CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
                        <p className="text-2xl md:text-4xl font-bold tabular-nums">
                            <span className="text-emerald-600">{voucherStats.kopkenNomin}</span>
                            <span className="text-sm md:text-xl text-slate-400 font-semibold">/{voucherStats.kopkenTotal}</span>
                        </p>
                        <p className="text-[10px] md:text-sm text-slate-500 mt-0.5 md:mt-1">No Minimum</p>
                    </CardContent>
                </Card>

                {/* Sisa KopKen Min 50k */}
                <Card className="shadow-sm bg-gradient-to-br from-blue-50 to-white border-blue-100">
                    <CardHeader className="pb-1 md:pb-2 p-3 md:p-6">
                        <div className="flex items-center gap-2 md:gap-3">
                            <div className="p-1.5 md:p-2.5 bg-blue-100 rounded-lg md:rounded-xl">
                                <Package className="h-4 w-4 md:h-5 md:w-5 text-blue-600" />
                            </div>
                            <CardTitle className="text-xs md:text-base font-medium text-slate-700 leading-tight">
                                KopKen
                                <span className="hidden md:inline"> Min 50k</span>
                            </CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
                        <p className="text-2xl md:text-4xl font-bold tabular-nums">
                            <span className="text-blue-600">{voucherStats.kopkenMin50k}</span>
                            <span className="text-sm md:text-xl text-slate-400 font-semibold">/{voucherStats.kopkenTotal}</span>
                        </p>
                        <p className="text-[10px] md:text-sm text-slate-500 mt-0.5 md:mt-1">Min. 50rb</p>
                    </CardContent>
                </Card>
                </div>
            )}

            {/* Brand Tabs with Table */}
            <Card className="shadow-sm">
                <CardHeader className="border-b border-slate-100 pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <CardTitle className="text-lg">Account Inventory</CardTitle>
                            {!isStaff && (
                                <CardDescription>
                                    Your coffee shop account collection
                                    <span className="ml-2 inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                                        Total: {voucherStats.foreBogo + voucherStats.foreDisc35 + voucherStats.kopkenNomin + voucherStats.kopkenMin50k} akun siap
                                    </span>
                                </CardDescription>
                            )}
                            {isStaff && (
                                <CardDescription>
                                    Menampilkan maks. 6 akun tersedia per brand
                                </CardDescription>
                            )}
                        </div>

                        {/* Kontrol filter — hanya untuk Super Admin */}
                        {!isStaff && (
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
                                    <SelectItem value="in_use">Sedang Digunakan</SelectItem>
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

                            <Button onClick={handleAddNew}>
                                <Plus className="mr-2 h-4 w-4" />
                                Add Account
                            </Button>
                        </div>
                        )}
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
                                    filterColumnName={isStaff ? undefined : 'phone_number'}
                                    filterPlaceholder="Search by phone number..."
                                    onFilterChange={handleSearchChange}
                                    disablePagination={true}
                                    emptyMessage={
                                        isStaff
                                            ? 'Tidak ada akun tersedia untuk Kopi Kenangan saat ini.'
                                            : statusFilter !== 'all' || searchQuery.trim() !== ''
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
                                    filterColumnName={isStaff ? undefined : 'phone_number'}
                                    filterPlaceholder="Search by phone number..."
                                    onFilterChange={handleSearchChange}
                                    disablePagination={true}
                                    emptyMessage={
                                        isStaff
                                            ? 'Tidak ada akun tersedia untuk Fore Coffee saat ini.'
                                            : statusFilter !== 'all' || searchQuery.trim() !== ''
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
