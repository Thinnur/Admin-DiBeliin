// =============================================================================
// DiBeliin Admin - Rekap Pemakaian Voucher KopKen Panel
// =============================================================================
// Sumber: view `dawg_voucher_usage_daily` (rangkuman tabel `dawg_voucher_log`).
// Log ditulis dari dalam RPC claim_dawg_voucher / restore_dawg_voucher, jadi
// semua jalur pemakaian ikut tercatat — bukan cuma checkout lewat admin.
//
// terpakai = diklaim - dikembalikan. Voucher yang diklaim lalu di-rollback
// karena checkout gagal TIDAK dihitung habis.

import { useMemo } from 'react';
import { useDawgVoucherUsage } from '@/hooks/useDawgAccounts';
import type { DawgVoucherTier, DawgVoucherUsageDay } from '@/services/dawgAccountService';

const TIER_LABEL: Record<DawgVoucherTier, string> = {
    tanpa_minimal: 'Tanpa Minimal',
    min_50k: 'Minimal 50k',
    min_70k: 'Minimal 70k',
};

const TIER_URUT: DawgVoucherTier[] = ['tanpa_minimal', 'min_50k', 'min_70k'];

interface BarisHarian {
    tanggal: string;
    perTier: Record<DawgVoucherTier, number>;
    total: number;
}

/** Satu baris per tanggal, kolom per tier — lebih enak dibaca daripada 1 baris per tier. */
function kelompokkan(data: DawgVoucherUsageDay[]): BarisHarian[] {
    const peta = new Map<string, BarisHarian>();

    for (const d of data) {
        if (!peta.has(d.tanggal)) {
            peta.set(d.tanggal, {
                tanggal: d.tanggal,
                perTier: { tanpa_minimal: 0, min_50k: 0, min_70k: 0 },
                total: 0,
            });
        }
        const baris = peta.get(d.tanggal)!;
        if (TIER_URUT.includes(d.tier)) {
            baris.perTier[d.tier] += d.terpakai;
            baris.total += d.terpakai;
        }
    }

    return [...peta.values()].sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1));
}

function formatTanggal(iso: string): string {
    return new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

export function DawgVoucherUsage({ enabled }: { enabled: boolean }) {
    const { data, isLoading, isError, error } = useDawgVoucherUsage(enabled, 14);
    const baris = useMemo(() => kelompokkan(data ?? []), [data]);

    if (!enabled) return null;

    if (isLoading) {
        return <p className="text-xs text-slate-400 py-2">Memuat rekap pemakaian voucher...</p>;
    }

    if (isError) {
        return <p className="text-xs text-red-500 py-2">Gagal memuat rekap voucher: {(error as Error)?.message}</p>;
    }

    if (baris.length === 0) {
        return <p className="text-xs text-slate-400 py-2">Belum ada catatan pemakaian voucher.</p>;
    }

    const totalSemua = baris.reduce(
        (acc, b) => {
            for (const t of TIER_URUT) acc[t] += b.perTier[t];
            acc.total += b.total;
            return acc;
        },
        { tanpa_minimal: 0, min_50k: 0, min_70k: 0, total: 0 } as Record<string, number>
    );

    return (
        <div className="pb-4">
            <div className="flex items-baseline justify-between pb-2">
                <h3 className="text-sm font-medium text-slate-700">Pemakaian Voucher (14 hari terakhir)</h3>
                <span className="text-xs text-slate-400">terpakai = diklaim - dikembalikan</span>
            </div>

            <div className="overflow-x-auto rounded-md border border-slate-200">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                        <tr>
                            <th className="text-left font-medium px-3 py-2 whitespace-nowrap">Tanggal</th>
                            {TIER_URUT.map((t) => (
                                <th key={t} className="text-right font-medium px-3 py-2 whitespace-nowrap">
                                    {TIER_LABEL[t]}
                                </th>
                            ))}
                            <th className="text-right font-medium px-3 py-2 whitespace-nowrap">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {baris.map((b) => (
                            <tr key={b.tanggal} className="border-t border-slate-100">
                                <td className="px-3 py-2 whitespace-nowrap text-slate-600">{formatTanggal(b.tanggal)}</td>
                                {TIER_URUT.map((t) => (
                                    <td key={t} className="px-3 py-2 text-right tabular-nums">
                                        {b.perTier[t] || <span className="text-slate-300">0</span>}
                                    </td>
                                ))}
                                <td className="px-3 py-2 text-right tabular-nums font-medium">{b.total}</td>
                            </tr>
                        ))}
                        <tr className="border-t-2 border-slate-200 bg-slate-50 font-medium">
                            <td className="px-3 py-2 whitespace-nowrap text-slate-600">Total</td>
                            {TIER_URUT.map((t) => (
                                <td key={t} className="px-3 py-2 text-right tabular-nums">
                                    {totalSemua[t]}
                                </td>
                            ))}
                            <td className="px-3 py-2 text-right tabular-nums">{totalSemua.total}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}
