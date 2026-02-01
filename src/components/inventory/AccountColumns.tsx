// =============================================================================
// DiBeliin Admin - Account Table Column Definitions
// =============================================================================
// TanStack Table columns with Shadcn UI components

import type { ColumnDef } from '@tanstack/react-table';
import { format, differenceInDays } from 'date-fns';
import {
    Copy,
    Edit,
    Trash2,
    ShoppingCart,
    AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import type { Account, AccountStatus, AccountBrand } from '@/types/database';


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
 * Status badge with premium colors
 */
function StatusBadge({ status }: { status: AccountStatus }) {
    const styles: Record<AccountStatus, string> = {
        ready: 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-1 ring-emerald-600/10',
        booked: 'bg-blue-50 text-blue-700 border-blue-200 ring-1 ring-blue-600/10',
        sold: 'bg-slate-100 text-slate-600 border-slate-200 ring-1 ring-slate-600/10',
        expired: 'bg-red-50 text-red-700 border-red-200 ring-1 ring-red-600/10',
        issue: 'bg-orange-50 text-orange-700 border-orange-200 ring-1 ring-orange-600/10',
    };

    const icons: Record<AccountStatus, string> = {
        ready: '●',
        booked: '◐',
        sold: '✓',
        expired: '✕',
        issue: '!',
    };

    return (
        <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all hover-lift ${styles[status]}`}
        >
            <span className="text-[10px]">{icons[status]}</span>
            <span className="capitalize">{status}</span>
        </span>
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
}

/**
 * Create column definitions for the accounts table
 */
export function createAccountColumns(
    actions?: AccountColumnActions
): ColumnDef<Account>[] {
    return [
        // Brand Column
        {
            accessorKey: 'brand',
            header: 'Brand',
            cell: ({ row }) => <BrandBadge brand={row.getValue('brand')} />,
            filterFn: (row, id, value) => {
                return value.includes(row.getValue(id));
            },
        },

        // Phone Number Column
        {
            accessorKey: 'phone_number',
            header: 'Phone',
            cell: ({ row }) => <PhoneCell phone={row.getValue('phone_number')} />,
        },

        // Voucher Type Column
        {
            accessorKey: 'voucher_type',
            header: 'Voucher',
            cell: ({ row }) => (
                <span className="text-sm">{row.getValue('voucher_type') || '-'}</span>
            ),
        },

        // Expiry Date Column
        {
            accessorKey: 'expiry_date',
            header: 'Expiry Date',
            cell: ({ row }) => <ExpiryCell date={row.getValue('expiry_date')} />,
            sortingFn: (rowA, rowB) => {
                const dateA = new Date(rowA.getValue('expiry_date') as string);
                const dateB = new Date(rowB.getValue('expiry_date') as string);
                return dateA.getTime() - dateB.getTime();
            },
        },

        // Status Column
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => <StatusBadge status={row.getValue('status')} />,
            filterFn: (row, id, value) => {
                return value.includes(row.getValue(id));
            },
        },

        // Purchase Price Column
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
        },

        // Actions Column
        {
            id: 'actions',
            header: '',
            cell: ({ row }) => {
                const account = row.original;
                const isReady = account.status === 'ready';

                return (
                    <div className="flex items-center justify-end gap-1">
                        {/* Mark as Sold (only for ready accounts) */}
                        {isReady && actions?.onMarkAsSold && (
                            <button
                                onClick={() => actions.onMarkAsSold?.(account)}
                                className="p-2 rounded-md hover:bg-green-50 text-green-600 transition-colors"
                                title="Mark as Sold"
                            >
                                <ShoppingCart className="w-4 h-4" />
                            </button>
                        )}

                        {/* Edit */}
                        {actions?.onEdit && (
                            <button
                                onClick={() => actions.onEdit?.(account)}
                                className="p-2 rounded-md hover:bg-gray-100 text-gray-600 transition-colors"
                                title="Edit"
                            >
                                <Edit className="w-4 h-4" />
                            </button>
                        )}

                        {/* Delete */}
                        {actions?.onDelete && (
                            <button
                                onClick={() => actions.onDelete?.(account)}
                                className="p-2 rounded-md hover:bg-red-50 text-red-600 transition-colors"
                                title="Delete"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                );
            },
        },
    ];
}

// Export a default column set for quick use
export const defaultAccountColumns = createAccountColumns();
