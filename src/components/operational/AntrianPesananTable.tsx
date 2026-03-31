// =============================================================================
// DiBeliin Admin - Antrian Pesanan Table
// =============================================================================
// Komponen tabel riwayat antrian dengan search, filter admin/status/periode

import { useState, useEffect, useMemo } from 'react';
import { Search, ClipboardList, RefreshCw, ChevronLeft, ChevronRight, Calendar, CalendarDays, CalendarRange } from 'lucide-react';
import {
    format,
    startOfDay,
    endOfDay,
    startOfMonth,
    endOfMonth,
    subDays,
    addDays,
    addMonths,
    subMonths,
    isWithinInterval,
} from 'date-fns';
import { id as localeID } from 'date-fns/locale';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

import { getAntrianPesanan, type AntrianPesanan } from '@/services/operationalService';

// -----------------------------------------------------------------------------
// Period filter type
// -----------------------------------------------------------------------------

type PeriodMode = 'daily' | 'monthly' | 'range' | 'all_time';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function formatDateTime(isoString: string): string {
    try {
        return new Intl.DateTimeFormat('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: 'Asia/Jakarta',
        }).format(new Date(isoString));
    } catch {
        return isoString;
    }
}



function isInRange(isoString: string, start: Date, end: Date): boolean {
    return isWithinInterval(new Date(isoString), {
        start: startOfDay(start),
        end: endOfDay(end),
    });
}

function StatusBadge({ status }: { status: string }) {
    const s = status?.toLowerCase();
    if (s === 'selesai') {
        return (
            <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-medium">
                ✓ Selesai
            </Badge>
        );
    }
    if (s === 'gagal') {
        return (
            <Badge className="bg-red-100 text-red-700 border border-red-200 hover:bg-red-100 font-medium">
                ✕ Gagal
            </Badge>
        );
    }
    if (s === 'menunggu') {
        return (
            <Badge className="bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-100 font-medium">
                ⏳ Menunggu
            </Badge>
        );
    }
    if (s === 'diproses') {
        return (
            <Badge className="bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-100 font-medium">
                ⚙ Diproses
            </Badge>
        );
    }
    return (
        <Badge variant="secondary">{status || '—'}</Badge>
    );
}

// -----------------------------------------------------------------------------
// Loading Skeleton
// -----------------------------------------------------------------------------

function TableSkeleton() {
    return (
        <div className="space-y-2 animate-pulse">
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex gap-4 p-3 rounded-lg bg-slate-100">
                    <div className="h-4 w-28 bg-slate-200 rounded" />
                    <div className="h-4 w-16 bg-slate-200 rounded" />
                    <div className="h-4 w-32 bg-slate-200 rounded" />
                    <div className="h-4 w-28 bg-slate-200 rounded" />
                    <div className="h-4 w-24 bg-slate-200 rounded" />
                    <div className="h-4 w-16 bg-slate-200 rounded" />
                </div>
            ))}
        </div>
    );
}

// -----------------------------------------------------------------------------
// Empty State
// -----------------------------------------------------------------------------

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
    return (
        <div className="text-center py-16 text-slate-500">
            <ClipboardList className="h-14 w-14 mx-auto mb-4 text-slate-200" />
            <p className="font-semibold text-slate-600">
                {hasFilters ? 'Tidak ada hasil' : 'Belum ada riwayat antrian'}
            </p>
            <p className="text-sm mt-1">
                {hasFilters
                    ? 'Coba ubah filter atau kata kunci pencarian'
                    : 'Data riwayat antrian pesanan akan muncul di sini'}
            </p>
        </div>
    );
}

// -----------------------------------------------------------------------------
// Period Selector — sama persis dengan Finance page
// -----------------------------------------------------------------------------

interface PeriodSelectorProps {
    mode: PeriodMode;
    selectedDate: Date;
    rangeStart: Date;
    rangeEnd: Date;
    onModeChange: (mode: PeriodMode) => void;
    onDateChange: (date: Date) => void;
    onRangeStartChange: (date: Date) => void;
    onRangeEndChange: (date: Date) => void;
}

function PeriodSelector({
    mode,
    selectedDate,
    rangeStart,
    rangeEnd,
    onModeChange,
    onDateChange,
    onRangeStartChange,
    onRangeEndChange,
}: PeriodSelectorProps) {
    const handlePrev = () => {
        onDateChange(mode === 'daily' ? subDays(selectedDate, 1) : subMonths(selectedDate, 1));
    };
    const handleNext = () => {
        const next = mode === 'daily' ? addDays(selectedDate, 1) : addMonths(selectedDate, 1);
        if (next <= new Date()) onDateChange(next);
    };

    const dateLabel =
        mode === 'daily'
            ? format(selectedDate, 'dd MMMM yyyy', { locale: localeID })
            : format(selectedDate, 'MMMM yyyy', { locale: localeID });

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
                {/* Mode toggle */}
                <div className="inline-flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
                    <button
                        onClick={() => onModeChange('daily')}
                        className={`flex items-center gap-1 px-2 py-1 md:px-3 md:py-1.5 rounded-md text-xs md:text-sm font-medium transition-all ${
                            mode === 'daily'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <Calendar className="h-3 w-3 md:h-3.5 md:w-3.5" />
                        Harian
                    </button>
                    <button
                        onClick={() => onModeChange('monthly')}
                        className={`flex items-center gap-1 px-2 py-1 md:px-3 md:py-1.5 rounded-md text-xs md:text-sm font-medium transition-all ${
                            mode === 'monthly'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <CalendarDays className="h-3 w-3 md:h-3.5 md:w-3.5" />
                        Bulanan
                    </button>
                    <button
                        onClick={() => onModeChange('range')}
                        className={`flex items-center gap-1 px-2 py-1 md:px-3 md:py-1.5 rounded-md text-xs md:text-sm font-medium transition-all ${
                            mode === 'range'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <CalendarRange className="h-3 w-3 md:h-3.5 md:w-3.5" />
                        Rentang
                    </button>
                    <button
                        onClick={() => onModeChange('all_time')}
                        className={`flex items-center gap-1 px-2 py-1 md:px-3 md:py-1.5 rounded-md text-xs md:text-sm font-medium transition-all ${
                            mode === 'all_time'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Semua Waktu
                    </button>
                </div>

                {/* Date navigator (daily/monthly) */}
                {mode !== 'range' && mode !== 'all_time' && (
                    <div className="inline-flex items-center gap-0.5 bg-white border border-slate-200 rounded-lg px-0.5 py-0.5">
                        <button
                            onClick={handlePrev}
                            className="p-1 md:p-1.5 rounded-md hover:bg-slate-100 transition-colors"
                            title="Sebelumnya"
                        >
                            <ChevronLeft className="h-3.5 w-3.5 md:h-4 md:w-4 text-slate-500" />
                        </button>
                        <span className="text-xs md:text-sm font-medium text-slate-700 min-w-[110px] md:min-w-[140px] text-center tabular-nums">
                            {dateLabel}
                        </span>
                        <button
                            onClick={handleNext}
                            className="p-1 md:p-1.5 rounded-md hover:bg-slate-100 transition-colors"
                            title="Berikutnya"
                        >
                            <ChevronRight className="h-3.5 w-3.5 md:h-4 md:w-4 text-slate-500" />
                        </button>
                    </div>
                )}
            </div>

            {/* Date range pickers (range mode only) */}
            {mode === 'range' && (
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-500 font-medium">Dari</span>
                        <input
                            type="date"
                            value={format(rangeStart, 'yyyy-MM-dd')}
                            onChange={(e) => {
                                const d = new Date(e.target.value + 'T00:00:00');
                                if (!isNaN(d.getTime())) onRangeStartChange(d);
                            }}
                            className="px-2 py-1 border border-slate-200 rounded-lg text-xs md:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-500 font-medium">Sampai</span>
                        <input
                            type="date"
                            value={format(rangeEnd, 'yyyy-MM-dd')}
                            onChange={(e) => {
                                const d = new Date(e.target.value + 'T00:00:00');
                                if (!isNaN(d.getTime())) onRangeEndChange(d);
                            }}
                            className="px-2 py-1 border border-slate-200 rounded-lg text-xs md:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export default function AntrianPesananTable() {
    const [data, setData] = useState<AntrianPesanan[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Filter state
    const [searchNomerAntrian, setSearchNomerAntrian] = useState('');
    const [filterAdmin, setFilterAdmin] = useState('semua');
    const [filterStatus, setFilterStatus] = useState<'semua' | 'selesai' | 'gagal' | 'menunggu' | 'diproses'>('semua');

    // Period state (sama seperti Finance)
    const [periodMode, setPeriodMode] = useState<PeriodMode>('daily');
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [rangeStart, setRangeStart] = useState<Date>(subDays(new Date(), 6));
    const [rangeEnd, setRangeEnd] = useState<Date>(new Date());

    // Fetch data
    const fetchData = async (isRefresh = false) => {
        if (isRefresh) setIsRefreshing(true);
        else setIsLoading(true);

        try {
            const result = await getAntrianPesanan();
            setData(result);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Extract unique admin list for dropdown
    const adminList = useMemo(() => {
        const unique = Array.from(
            new Set(
                data
                    .map((d) => d.admin_in_charge)
                    .filter((a): a is string => a != null && a.trim() !== '')
            )
        ).sort();
        return unique;
    }, [data]);

    // Client-side filtering
    const filtered = useMemo(() => {
        return data.filter((row) => {
            // Period filter
            if (periodMode === 'daily' && !isInRange(row.created_at, selectedDate, selectedDate)) return false;
            if (periodMode === 'monthly') {
                const s = startOfMonth(selectedDate);
                const e = endOfMonth(selectedDate);
                if (!isInRange(row.created_at, s, e)) return false;
            }
            if (periodMode === 'range' && !isInRange(row.created_at, rangeStart, rangeEnd)) return false;

            // Search nomor antrian
            const nomerStr = row.nomor_antrian != null ? String(row.nomor_antrian) : '';
            const matchSearch =
                searchNomerAntrian.trim() === '' ||
                nomerStr.includes(searchNomerAntrian.trim());

            // Admin filter
            const matchAdmin = filterAdmin === 'semua' || row.admin_in_charge === filterAdmin;

            // Status filter (case-insensitive)
            const matchStatus = filterStatus === 'semua' || row.status?.toLowerCase() === filterStatus;

            return matchSearch && matchAdmin && matchStatus;
        });
    }, [data, searchNomerAntrian, filterAdmin, filterStatus, periodMode, selectedDate, rangeStart, rangeEnd]);

    const hasFilters =
        searchNomerAntrian.trim() !== '' || filterAdmin !== 'semua' || filterStatus !== 'semua';

    // Stats from period-filtered data
    const periodData = useMemo(() => {
        return data.filter((row) => {
            if (periodMode === 'daily') return isInRange(row.created_at, selectedDate, selectedDate);
            if (periodMode === 'monthly') {
                return isInRange(row.created_at, startOfMonth(selectedDate), endOfMonth(selectedDate));
            }
            if (periodMode === 'range') return isInRange(row.created_at, rangeStart, rangeEnd);
            return true; // all_time
        });
    }, [data, periodMode, selectedDate, rangeStart, rangeEnd]);

    const totalSelesai = periodData.filter((d) => d.status?.toLowerCase() === 'selesai').length;
    const totalGagal = periodData.filter((d) => d.status?.toLowerCase() === 'gagal').length;
    const totalMenunggu = periodData.filter((d) => d.status?.toLowerCase() === 'menunggu').length;
    const totalDiproses = periodData.filter((d) => d.status?.toLowerCase() === 'diproses').length;

    return (
        <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50">
            <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl shadow-lg shadow-indigo-500/20">
                            <ClipboardList className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">Riwayat Antrian Pesanan</CardTitle>
                            <CardDescription>
                                Log seluruh pesanan yang masuk ke sistem antrian
                            </CardDescription>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 shrink-0"
                        onClick={() => fetchData(true)}
                        disabled={isRefreshing}
                        title="Refresh data"
                    >
                        <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </Button>
                </div>

                {/* Period Selector */}
                <div className="mt-4">
                    <PeriodSelector
                        mode={periodMode}
                        selectedDate={selectedDate}
                        rangeStart={rangeStart}
                        rangeEnd={rangeEnd}
                        onModeChange={setPeriodMode}
                        onDateChange={setSelectedDate}
                        onRangeStartChange={setRangeStart}
                        onRangeEndChange={setRangeEnd}
                    />
                </div>

                {/* Stats Pills */}
                {!isLoading && (
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                        <span className="text-xs text-slate-500">
                            Total: <strong className="text-slate-700">{periodData.length}</strong>
                        </span>
                        <span className="w-px h-3 bg-slate-300" />
                        <span className="inline-flex items-center gap-1 text-xs">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                            <span className="text-slate-600">
                                Selesai: <strong className="text-emerald-700">{totalSelesai}</strong>
                            </span>
                        </span>
                        {totalMenunggu > 0 && (
                            <>
                                <span className="w-px h-3 bg-slate-300" />
                                <span className="inline-flex items-center gap-1 text-xs">
                                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                                    <span className="text-slate-600">
                                        Menunggu: <strong className="text-amber-700">{totalMenunggu}</strong>
                                    </span>
                                </span>
                            </>
                        )}
                        {totalDiproses > 0 && (
                            <>
                                <span className="w-px h-3 bg-slate-300" />
                                <span className="inline-flex items-center gap-1 text-xs">
                                    <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                                    <span className="text-slate-600">
                                        Diproses: <strong className="text-blue-700">{totalDiproses}</strong>
                                    </span>
                                </span>
                            </>
                        )}
                        <span className="w-px h-3 bg-slate-300" />
                        <span className="inline-flex items-center gap-1 text-xs">
                            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                            <span className="text-slate-600">
                                Gagal: <strong className="text-red-700">{totalGagal}</strong>
                            </span>
                        </span>
                    </div>
                )}
            </CardHeader>

            <CardContent className="space-y-4">
                {/* ── Search & Filter Bar ─────────────────────────────────── */}
                <div className="flex flex-col sm:flex-row gap-3">
                    {/* Search by Nomer Antrian */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        <Input
                            placeholder="Cari Nomer Antrian..."
                            value={searchNomerAntrian}
                            onChange={(e) => setSearchNomerAntrian(e.target.value)}
                            className="pl-9 bg-white"
                        />
                    </div>

                    {/* Filter Admin */}
                    <Select value={filterAdmin} onValueChange={setFilterAdmin}>
                        <SelectTrigger className="w-full sm:w-[180px] bg-white">
                            <SelectValue placeholder="Filter Admin" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="semua">Semua Admin</SelectItem>
                            {adminList.map((admin) => (
                                <SelectItem key={admin} value={admin}>
                                    {admin}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Filter Status */}
                    <Select
                        value={filterStatus}
                        onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}
                    >
                        <SelectTrigger className="w-full sm:w-[160px] bg-white">
                            <SelectValue placeholder="Filter Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="semua">Semua Status</SelectItem>
                            <SelectItem value="menunggu">Menunggu</SelectItem>
                            <SelectItem value="diproses">Diproses</SelectItem>
                            <SelectItem value="selesai">Selesai</SelectItem>
                            <SelectItem value="gagal">Gagal</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Result count when filtering */}
                {hasFilters && !isLoading && (
                    <p className="text-xs text-slate-500">
                        Menampilkan <strong className="text-slate-700">{filtered.length}</strong> dari{' '}
                        {periodData.length} data
                    </p>
                )}

                {/* ── Content ──────────────────────────────────────────────── */}
                {isLoading ? (
                    <TableSkeleton />
                ) : filtered.length === 0 ? (
                    <EmptyState hasFilters={hasFilters || periodMode !== 'all_time'} />
                ) : (
                    <>
                        {/* Desktop Table */}
                        <div className="hidden md:block rounded-xl border border-slate-200 overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                                        <TableHead className="font-semibold text-slate-600 w-[160px]">
                                            Waktu
                                        </TableHead>
                                        <TableHead className="font-semibold text-slate-600 w-[140px]">
                                            Nomer Antrian
                                        </TableHead>
                                        <TableHead className="font-semibold text-slate-600">
                                            Toko
                                        </TableHead>
                                        <TableHead className="font-semibold text-slate-600 w-[140px]">
                                            Nomer WA
                                        </TableHead>
                                        <TableHead className="font-semibold text-slate-600 w-[150px]">
                                            Admin Bertugas
                                        </TableHead>
                                        <TableHead className="font-semibold text-slate-600 w-[110px]">
                                            Status
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.map((row, idx) => (
                                        <TableRow
                                            key={row.id}
                                            className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}
                                        >
                                            <TableCell className="text-sm text-slate-500 whitespace-nowrap">
                                                {formatDateTime(row.created_at)}
                                            </TableCell>
                                            <TableCell className="font-mono font-semibold text-slate-800 text-sm">
                                                {row.nomor_antrian != null ? row.nomor_antrian : '—'}
                                            </TableCell>
                                            <TableCell className="text-sm text-slate-700">
                                                {row.toko || '—'}
                                            </TableCell>
                                            <TableCell className="font-mono text-sm text-slate-600">
                                                {row.nomor_wa != null ? row.nomor_wa : '—'}
                                            </TableCell>
                                            <TableCell className="text-sm text-slate-700">
                                                {row.admin_in_charge != null ? row.admin_in_charge : '—'}
                                            </TableCell>
                                            <TableCell>
                                                <StatusBadge status={row.status} />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Mobile Card List */}
                        <div className="md:hidden space-y-2">
                            {filtered.map((row) => (
                                <div
                                    key={row.id}
                                    className="p-3 rounded-xl border border-slate-100 bg-white shadow-sm"
                                >
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div>
                                            <span className="font-mono font-bold text-sm text-slate-900">
                                                {row.nomor_antrian != null ? row.nomor_antrian : '—'}
                                            </span>
                                            <p className="text-xs text-slate-500 mt-0.5">{row.toko || '—'}</p>
                                        </div>
                                        <StatusBadge status={row.status} />
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="text-xs text-slate-500 space-y-0.5">
                                            <p>👤 {row.admin_in_charge != null ? row.admin_in_charge : '—'}</p>
                                            <p>📱 {row.nomor_wa != null ? row.nomor_wa : '—'}</p>
                                        </div>
                                        <span className="text-xs text-slate-400 text-right">
                                            {formatDateTime(row.created_at)}
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
