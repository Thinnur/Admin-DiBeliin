// =============================================================================
// DiBeliin Admin - Filter Hari
// =============================================================================
// Filter hari ala halaman Finance: "Harian" (tanggalnya bisa digeser maju/mundur)
// atau "Semua Hari". Dipakai di Pesanan Baru & Riwayat Checkout.
/* eslint-disable react-refresh/only-export-components */

import { addDays, format } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

export const DAY_FORMAT = 'yyyy-MM-dd';

export function todayKey(): string {
    return format(new Date(), DAY_FORMAT);
}

interface DayFilterProps {
    /** Tanggal aktif (yyyy-MM-dd), atau null untuk "Semua Hari". */
    value: string | null;
    onChange: (day: string | null) => void;
}

export default function DayFilter({ value, onChange }: DayFilterProps) {
    const selected = value ? new Date(`${value}T00:00:00`) : new Date();

    const shift = (days: number) => {
        const next = format(addDays(selected, days), DAY_FORMAT);
        // ponytail: hari depan gak pernah punya data, jadi tombol next mentok di hari ini
        if (next > todayKey()) return;
        onChange(next);
    };

    const btn = (active: boolean) =>
        `flex items-center gap-1 px-2 py-1 md:px-3 md:py-1.5 rounded-md text-xs md:text-sm font-medium transition-all ${active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
        }`;

    return (
        <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
                <button type="button" onClick={() => onChange(todayKey())} className={btn(value !== null)}>
                    <Calendar className="h-3 w-3 md:h-3.5 md:w-3.5" />
                    Harian
                </button>
                <button type="button" onClick={() => onChange(null)} className={btn(value === null)}>
                    Semua Hari
                </button>
            </div>

            {value !== null && (
                <div className="inline-flex items-center gap-0.5 bg-white border border-slate-200 rounded-lg px-0.5 py-0.5">
                    <button
                        type="button"
                        onClick={() => shift(-1)}
                        className="p-1 md:p-1.5 rounded-md hover:bg-slate-100 transition-colors"
                        title="Sebelumnya"
                    >
                        <ChevronLeft className="h-3.5 w-3.5 md:h-4 md:w-4 text-slate-500" />
                    </button>
                    <span className="text-xs md:text-sm font-medium text-slate-700 min-w-[110px] md:min-w-[140px] text-center tabular-nums">
                        {format(selected, 'dd MMMM yyyy', { locale: localeID })}
                    </span>
                    <button
                        type="button"
                        onClick={() => shift(1)}
                        className="p-1 md:p-1.5 rounded-md hover:bg-slate-100 transition-colors"
                        title="Berikutnya"
                    >
                        <ChevronRight className="h-3.5 w-3.5 md:h-4 md:w-4 text-slate-500" />
                    </button>
                </div>
            )}
        </div>
    );
}
