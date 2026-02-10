// =============================================================================
// DiBeliin Admin - Account Table Column Definitions
// =============================================================================
// TanStack Table columns with Shadcn UI components

import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { format, differenceInDays } from 'date-fns';
import {
    Copy,
    Edit,
    Trash2,
    MoreHorizontal,
    AlertCircle,
    Check,
    X,
} from 'lucide-react';
import { toast } from 'sonner';

import type { Account, AccountStatus, AccountBrand } from '@/types/database';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';


// -----------------------------------------------------------------------------
// Helper Components (inline for now, can be extracted to separate files)
// -----------------------------------------------------------------------------

/**
 * Brand badge with brand-specific colors
 */
function BrandBadge({ brand }: { brand: AccountBrand }) {
    const styles = {
        kopken: 'bg-amber-100 text-amber-800 border-amber-200',
        fore: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    };

    const labels = {
        kopken: 'Kopi Kenangan',
        fore: 'Fore Coffee',
    };

    return (
        <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[brand]}`}
        >
            {labels[brand]}
        </span>
    );
}

/**
 * Status badge with premium colors (Global Health Status)
 * Shows operator name when status is 'in_use' and in_use_by is provided
 */
function StatusBadge({ status, inUseBy }: { status: AccountStatus; inUseBy?: string | null }) {
    const styles: Record<AccountStatus, string> = {
        ready: 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-1 ring-emerald-600/10',
        booked: 'bg-blue-50 text-blue-700 border-blue-200 ring-1 ring-blue-600/10',
        sold: 'bg-slate-100 text-slate-600 border-slate-200 ring-1 ring-slate-600/10',
        expired: 'bg-red-50 text-red-700 border-red-200 ring-1 ring-red-600/10',
        issue: 'bg-orange-50 text-orange-700 border-orange-200 ring-1 ring-orange-600/10',
        in_use: 'bg-violet-50 text-violet-700 border-violet-200 ring-1 ring-violet-600/10',
    };

    const icons: Record<AccountStatus, string> = {
        ready: '●',
        booked: '◐',
        sold: '✓',
        expired: '✕',
        issue: '!',
        in_use: '◉',
    };

    const label = status === 'in_use'
        ? (inUseBy ? `In Use: ${inUseBy}` : 'In Use')
        : status;

    return (
        <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all hover-lift ${styles[status]}`}
        >
            <span className="text-[10px]">{icons[status]}</span>
            <span className="capitalize">{label}</span>
        </span>
    );
}

/**
 * Voucher status badges - shows individual voucher availability
 */
function VoucherStatusBadges({ account }: { account: Account }) {
    const { brand, is_nomin_ready, is_min50k_ready } = account;

    const getBadgeStyle = (isReady: boolean) => {
        if (isReady) {
            return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        }
        return 'bg-slate-100 text-slate-500 border-slate-200';
    };

    return (
        <div className="flex flex-wrap gap-1.5">
            {/* No Min Badge - always shown */}
            <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${getBadgeStyle(is_nomin_ready)}`}
            >
                {is_nomin_ready ? (
                    <Check className="w-3 h-3" />
                ) : (
                    <X className="w-3 h-3" />
                )}
                NoMin
            </span>

            {/* Min 50k Badge - only for KopKen */}
            {brand === 'kopken' && (
                <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${getBadgeStyle(is_min50k_ready)}`}
                >
                    {is_min50k_ready ? (
                        <Check className="w-3 h-3" />
                    ) : (
                        <X className="w-3 h-3" />
                    )}
                    50k
                </span>
            )}
        </div>
    );
}

/**
 * Expiry date cell with color coding
 */
function ExpiryCell({ date }: { date: string }) {
    const expiryDate = new Date(date);
    const today = new Date();
    const daysLeft = differenceInDays(expiryDate, today);

    let colorClass = 'text-gray-900';
    let icon = null;

    if (daysLeft < 0) {
        colorClass = 'text-red-600 font-semibold';
        icon = <AlertCircle className="w-4 h-4 mr-1 text-red-500" />;
    } else if (daysLeft <= 3) {
        colorClass = 'text-red-600 font-semibold';
        icon = <AlertCircle className="w-4 h-4 mr-1 text-red-500" />;
    } else if (daysLeft <= 7) {
        colorClass = 'text-yellow-600 font-medium';
    }

    return (
        <div className={`flex items-center ${colorClass}`}>
            {icon}
            <span>{format(expiryDate, 'dd MMM yyyy')}</span>
            {daysLeft >= 0 && daysLeft <= 7 && (
                <span className="ml-2 text-xs opacity-75">
                    ({daysLeft}d left)
                </span>
            )}
            {daysLeft < 0 && (
                <span className="ml-2 text-xs">
                    (expired)
                </span>
            )}
        </div>
    );
}

/**
 * Phone number cell with copy button
 */
function PhoneCell({ phone }: { phone: string }) {
    const handleCopy = () => {
        navigator.clipboard.writeText(phone);
        toast.success('Phone number copied!');
    };

    return (
        <div className="flex items-center gap-2">
            <span className="font-mono text-sm tabular-nums text-slate-700">{phone}</span>
            <button
                onClick={handleCopy}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors group"
                title="Copy phone number"
            >
                <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
            </button>
        </div>
    );
}

/**
 * PIN cell with copy button (monospace for clarity)
 */
function PINCell({ pin }: { pin: string | null }) {
    const handleCopy = () => {
        if (pin) {
            navigator.clipboard.writeText(pin);
            toast.success('PIN copied!');
        }
    };

    if (!pin) {
        return <span className="text-slate-400 text-sm">-</span>;
    }

    return (
        <div className="flex items-center gap-2">
            <span className="font-mono text-sm tabular-nums text-slate-700 tracking-wider">{pin}</span>
            <button
                onClick={handleCopy}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors group"
                title="Copy PIN"
            >
                <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
            </button>
        </div>
    );
}


/**
 * Actions dropdown with voucher toggle options
 */
function ActionsCell({
    account,
    actions
}: {
    account: Account;
    actions?: AccountColumnActions;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const isReady = account.status === 'ready';
    const isInUse = account.status === 'in_use';

    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <button
                    className="p-2 rounded-md hover:bg-slate-100 text-slate-600 transition-colors"
                    title="Actions"
                >
                    <MoreHorizontal className="w-4 h-4" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Voucher Status</DropdownMenuLabel>
                <DropdownMenuSeparator />

                {/* Toggle No Min */}
                <DropdownMenuItem
                    onClick={() => {
                        actions?.onToggleVoucher?.(account, 'nomin', !account.is_nomin_ready);
                        setIsOpen(false);
                    }}
                    className="cursor-pointer"
                >
                    <span className="flex items-center gap-2">
                        {account.is_nomin_ready ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                            <X className="w-4 h-4 text-slate-400" />
                        )}
                        NoMin: {account.is_nomin_ready ? 'Ready' : 'Used'}
                    </span>
                </DropdownMenuItem>

                {/* Toggle Min 50k - only for KopKen */}
                {account.brand === 'kopken' && (
                    <DropdownMenuItem
                        onClick={() => {
                            actions?.onToggleVoucher?.(account, 'min50k', !account.is_min50k_ready);
                            setIsOpen(false);
                        }}
                        className="cursor-pointer"
                    >
                        <span className="flex items-center gap-2">
                            {account.is_min50k_ready ? (
                                <Check className="w-4 h-4 text-emerald-600" />
                            ) : (
                                <X className="w-4 h-4 text-slate-400" />
                            )}
                            50k: {account.is_min50k_ready ? 'Ready' : 'Used'}
                        </span>
                    </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />
                <DropdownMenuLabel>Account Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />

                {/* Edit */}
                {actions?.onEdit && (
                    <DropdownMenuItem
                        onClick={() => {
                            actions.onEdit?.(account);
                            setIsOpen(false);
                        }}
                        className="cursor-pointer"
                    >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Account
                    </DropdownMenuItem>
                )}

                {/* Mark as In Use - only for ready accounts */}
                {isReady && actions?.onMarkAsInUse && (
                    <DropdownMenuItem
                        onClick={() => {
                            actions.onMarkAsInUse?.(account);
                            setIsOpen(false);
                        }}
                        className="cursor-pointer text-violet-600"
                    >
                        <span className="w-4 h-4 mr-2 text-center text-sm leading-4">◉</span>
                        Tandai Digunakan
                    </DropdownMenuItem>
                )}

                {/* Return to Ready - only for in_use accounts */}
                {isInUse && actions?.onMarkAsReady && (
                    <DropdownMenuItem
                        onClick={() => {
                            actions.onMarkAsReady?.(account);
                            setIsOpen(false);
                        }}
                        className="cursor-pointer text-emerald-600"
                    >
                        <Check className="w-4 h-4 mr-2" />
                        Kembalikan ke Ready
                    </DropdownMenuItem>
                )}

                {/* Mark as Sold - only for ready accounts */}
                {isReady && actions?.onMarkAsSold && (
                    <DropdownMenuItem
                        onClick={() => {
                            actions.onMarkAsSold?.(account);
                            setIsOpen(false);
                        }}
                        className="cursor-pointer text-emerald-600"
                    >
                        <Check className="w-4 h-4 mr-2" />
                        Mark as Sold
                    </DropdownMenuItem>
                )}

                {/* Delete */}
                {actions?.onDelete && (
                    <DropdownMenuItem
                        onClick={() => {
                            actions.onDelete?.(account);
                            setIsOpen(false);
                        }}
                        className="cursor-pointer text-red-600"
                    >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Account
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/**
 * Mobile-only info cell that displays account data in a stacked 3-line layout
 */
function MobileInfoCell({ account }: { account: Account }) {
    const expiryDate = new Date(account.expiry_date);

    const handleCopyPhone = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(account.phone_number);
        toast.success('Nomor HP disalin!');
    };

    return (
        <div className="flex flex-col gap-2 py-1.5">
            {/* Line 1: Brand & Phone (The Header) */}
            <div className="flex items-center gap-2">
                <BrandBadge brand={account.brand} />
                <span className="font-mono font-semibold text-sm tracking-tight text-foreground">
                    {account.phone_number}
                </span>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={handleCopyPhone}
                >
                    <Copy className="h-3 w-3" />
                </Button>
            </div>

            {/* Line 2: PIN & Health (The Status) */}
            <div className="flex items-center gap-2.5">
                {account.password && (
                    <div className="flex items-center gap-1.5 text-xs bg-muted/40 px-1.5 py-0.5 rounded-sm">
                        <span className="text-muted-foreground">PIN:</span>
                        <span className="font-mono font-medium text-foreground select-all">
                            {account.password}
                        </span>
                    </div>
                )}
                <StatusBadge status={account.status} inUseBy={account.in_use_by} />
            </div>

            {/* Line 3: Voucher & Expiry (The Value) */}
            <div className="flex items-center gap-2">
                <VoucherStatusBadges account={account} />
                <span className="text-xs text-muted-foreground">
                    {format(expiryDate, 'dd MMM yyyy')}
                </span>
            </div>
        </div>
    );
}

// -----------------------------------------------------------------------------
// Column Definitions
// -----------------------------------------------------------------------------

/**
 * Props for action callbacks
 */
export interface AccountColumnActions {
    onEdit?: (account: Account) => void;
    onDelete?: (account: Account) => void;
    onMarkAsSold?: (account: Account) => void;
    onMarkAsInUse?: (account: Account) => void;
    onMarkAsReady?: (account: Account) => void;
    onToggleVoucher?: (account: Account, voucher: 'nomin' | 'min50k', newValue: boolean) => void;
}

/**
 * Create column definitions for the accounts table
 */
export function createAccountColumns(
    actions?: AccountColumnActions
): ColumnDef<Account>[] {
    return [
        // Mobile Info Column - visible only on mobile
        {
            id: 'mobile_info',
            header: '',
            cell: ({ row }) => <MobileInfoCell account={row.original} />,
            meta: { className: 'md:hidden' },
        },

        // Brand Column - hidden on mobile
        {
            accessorKey: 'brand',
            header: 'Brand',
            cell: ({ row }) => <BrandBadge brand={row.getValue('brand')} />,
            filterFn: (row, id, value) => {
                return value.includes(row.getValue(id));
            },
            meta: { className: 'hidden md:table-cell' },
        },

        // Phone Number Column - hidden on mobile
        {
            accessorKey: 'phone_number',
            header: 'Phone',
            cell: ({ row }) => <PhoneCell phone={row.getValue('phone_number')} />,
            meta: { className: 'hidden md:table-cell' },
        },

        // PIN Column - hidden on mobile
        {
            accessorKey: 'password',
            header: 'PIN',
            cell: ({ row }) => <PINCell pin={row.original.password} />,
            meta: { className: 'hidden md:table-cell' },
        },

        // Voucher Status Column - hidden on mobile
        {
            id: 'voucher_status',
            header: 'Vouchers',
            cell: ({ row }) => <VoucherStatusBadges account={row.original} />,
            meta: { className: 'hidden md:table-cell' },
        },

        // Expiry Date Column - hidden on mobile
        {
            accessorKey: 'expiry_date',
            header: 'Expiry Date',
            cell: ({ row }) => <ExpiryCell date={row.getValue('expiry_date')} />,
            sortingFn: (rowA, rowB) => {
                const dateA = new Date(rowA.getValue('expiry_date') as string);
                const dateB = new Date(rowB.getValue('expiry_date') as string);
                return dateA.getTime() - dateB.getTime();
            },
            meta: { className: 'hidden md:table-cell' },
        },

        // Status Column (Global Health Status) - hidden on mobile
        {
            accessorKey: 'status',
            header: 'Health',
            cell: ({ row }) => <StatusBadge status={row.getValue('status')} inUseBy={row.original.in_use_by} />,
            filterFn: (row, id, value) => {
                return value.includes(row.getValue(id));
            },
            meta: { className: 'hidden md:table-cell' },
        },

        // Purchase Price Column - hidden on mobile
        {
            accessorKey: 'purchase_price',
            header: 'Price',
            cell: ({ row }) => {
                const price = row.getValue('purchase_price') as number;
                return (
                    <span className="font-medium">
                        Rp {price?.toLocaleString('id-ID') || '0'}
                    </span>
                );
            },
            meta: { className: 'hidden md:table-cell' },
        },

        // Actions Column - always visible
        {
            id: 'actions',
            header: '',
            cell: ({ row }) => <ActionsCell account={row.original} actions={actions} />,
        },
    ];
}

// Export a default column set for quick use
export const defaultAccountColumns = createAccountColumns();

