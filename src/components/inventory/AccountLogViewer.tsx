import { useState } from 'react';
import { ClipboardList, RefreshCw, Inbox } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccountLogs } from '@/hooks/useAccountLogs';
import type { AccountLog, AccountLogAction } from '@/services/accountLogService';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function formatRelative(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);

    if (diffSec < 60) return 'Baru saja';
    if (diffMin < 60) return `${diffMin} menit lalu`;
    if (diffHour < 24) return `${diffHour} jam lalu`;
    return format(date, 'dd MMM yyyy HH:mm', { locale: localeId });
}

function truncateEmail(email: string): string {
    return email.length > 20 ? email.slice(0, 20) + '...' : email;
}

const ACTION_LABELS: Record<AccountLogAction | 'all', string> = {
    all: 'Semua Aksi',
    created: 'Ditambahkan',
    deleted: 'Dihapus',
    updated: 'Diperbarui',
    voucher_changed: 'Voucher',
    status_changed: 'Status',
    marked_in_use: 'In Use',
    returned_to_ready: 'Ready',
};

const BADGE_CLASSES: Record<AccountLogAction, string> = {
    created: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    deleted: 'bg-red-100 text-red-700 border-red-200',
    voucher_changed: 'bg-amber-100 text-amber-700 border-amber-200',
    marked_in_use: 'bg-violet-100 text-violet-700 border-violet-200',
    status_changed: 'bg-blue-100 text-blue-700 border-blue-200',
    returned_to_ready: 'bg-blue-100 text-blue-700 border-blue-200',
    updated: 'bg-slate-100 text-slate-700 border-slate-200',
};

function ActionBadge({ action }: { action: AccountLogAction }) {
    return (
        <Badge
            variant="secondary"
            className={`text-xs font-medium ${BADGE_CLASSES[action]}`}
        >
            {ACTION_LABELS[action]}
        </Badge>
    );
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function AccountLogViewer() {
    const [actionFilter, setActionFilter] = useState<AccountLogAction | 'all'>('all');
    const [brandFilter, setBrandFilter] = useState<'all' | 'kopken' | 'fore'>('all');

    const { data: logs = [], isLoading, refetch } = useAccountLogs({ limit: 100 });

    const filteredLogs = logs.filter((log) => {
        if (actionFilter !== 'all' && log.action !== actionFilter) return false;
        if (brandFilter !== 'all' && log.account_brand !== brandFilter) return false;
        return true;
    });

    return (
        <Card className="shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <ClipboardList className="h-5 w-5 text-slate-500" />
                            <CardTitle className="text-lg">Riwayat Perubahan Akun</CardTitle>
                        </div>
                        <CardDescription className="mt-1">
                            {isLoading ? 'Memuat...' : `${filteredLogs.length} entri`}
                        </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Action filter */}
                        <Select
                            value={actionFilter}
                            onValueChange={(v) => setActionFilter(v as AccountLogAction | 'all')}
                        >
                            <SelectTrigger className="w-[150px] bg-white">
                                <SelectValue placeholder="Aksi" />
                            </SelectTrigger>
                            <SelectContent>
                                {(Object.keys(ACTION_LABELS) as (AccountLogAction | 'all')[]).map((key) => (
                                    <SelectItem key={key} value={key}>
                                        {ACTION_LABELS[key]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* Brand filter */}
                        <Select
                            value={brandFilter}
                            onValueChange={(v) => setBrandFilter(v as 'all' | 'kopken' | 'fore')}
                        >
                            <SelectTrigger className="w-[150px] bg-white">
                                <SelectValue placeholder="Brand" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Brand</SelectItem>
                                <SelectItem value="kopken">Kopi Kenangan</SelectItem>
                                <SelectItem value="fore">Fore Coffee</SelectItem>
                            </SelectContent>
                        </Select>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => refetch()}
                            className="text-slate-600"
                        >
                            <RefreshCw className="h-4 w-4 mr-1.5" />
                            Refresh
                        </Button>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="pt-4">
                {isLoading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-14 w-full rounded-lg" />
                        ))}
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                        <Inbox className="h-10 w-10" />
                        <p className="text-sm">Belum ada riwayat perubahan</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wide">
                                        <th className="text-left pb-2 pr-4 font-medium">Waktu</th>
                                        <th className="text-left pb-2 pr-4 font-medium">Aksi</th>
                                        <th className="text-left pb-2 pr-4 font-medium">Deskripsi</th>
                                        <th className="text-left pb-2 pr-4 font-medium">Akun</th>
                                        <th className="text-left pb-2 font-medium">Oleh</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredLogs.map((log: AccountLog) => (
                                        <tr key={log.id} className="hover:bg-slate-50/50">
                                            <td className="py-3 pr-4 text-slate-400 whitespace-nowrap text-xs">
                                                {formatRelative(log.created_at)}
                                            </td>
                                            <td className="py-3 pr-4">
                                                <ActionBadge action={log.action} />
                                            </td>
                                            <td className="py-3 pr-4 text-slate-700 max-w-xs">
                                                {log.description}
                                            </td>
                                            <td className="py-3 pr-4 font-mono text-xs text-slate-500">
                                                {log.account_phone || '—'}
                                            </td>
                                            <td className="py-3 text-xs text-slate-500">
                                                {truncateEmail(log.user_email)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile card list */}
                        <div className="md:hidden space-y-2">
                            {filteredLogs.map((log: AccountLog) => (
                                <div
                                    key={log.id}
                                    className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 space-y-1.5"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <ActionBadge action={log.action} />
                                        <span className="text-xs text-slate-400">
                                            {formatRelative(log.created_at)}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-700">{log.description}</p>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-mono text-xs text-slate-500">
                                            {log.account_phone || '—'}
                                        </span>
                                        <span className="text-xs text-slate-400">
                                            {truncateEmail(log.user_email)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
