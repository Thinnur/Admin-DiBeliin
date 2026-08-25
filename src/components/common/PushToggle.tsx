// =============================================================================
// DiBeliin Admin - Tombol Notifikasi
// =============================================================================
// Lonceng di header: nyalakan/matikan Web Push untuk device yang lagi dipakai.
// Izin notifikasi wajib diminta dari klik user — makanya tombol, bukan auto.

import { useEffect, useState } from 'react';
import { Bell, BellOff, BellRing, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
    disablePush,
    enablePush,
    getPushState,
    needsIosInstall,
    resyncPush,
    type PushState,
} from '@/lib/push';

export default function PushToggle() {
    const [state, setState] = useState<PushState>('off');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        void (async () => {
            const current = await getPushState();
            setState(current);
            // Sembuhkan baris DB yang kepangkas / endpoint yang dirotasi browser.
            if (current === 'on') void resyncPush();
        })();
    }, []);

    const handleClick = async () => {
        if (state === 'unsupported') {
            toast.info(
                needsIosInstall()
                    ? 'Di iPhone: buka menu Bagikan → "Add to Home Screen", lalu nyalakan notifikasi dari app-nya.'
                    : 'Browser ini tidak mendukung notifikasi web.'
            );
            return;
        }
        if (state === 'denied') {
            toast.error('Notifikasi diblokir di setelan browser. Izinkan dulu buat situs ini.');
            return;
        }

        setBusy(true);
        try {
            if (state === 'on') {
                setState(await disablePush());
                toast.success('Notifikasi dimatikan di device ini.');
            } else {
                const next = await enablePush();
                setState(next);
                if (next === 'on') toast.success('Notifikasi aktif — cek notif percobaannya.');
                else if (next === 'denied') toast.error('Izin notifikasi ditolak.');
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal mengatur notifikasi');
        } finally {
            setBusy(false);
        }
    };

    const label = state === 'on' ? 'Notifikasi aktif — klik buat matikan' : 'Nyalakan notifikasi';

    return (
        <button
            type="button"
            onClick={() => void handleClick()}
            disabled={busy}
            title={label}
            aria-label={label}
            className={`p-2 rounded-lg transition-colors disabled:opacity-60 ${state === 'on'
                ? 'text-emerald-600 hover:bg-emerald-50'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                }`}
        >
            {busy
                ? <Loader2 className="h-5 w-5 animate-spin" />
                : state === 'on'
                    ? <BellRing className="h-5 w-5" />
                    : state === 'denied' || state === 'unsupported'
                        ? <BellOff className="h-5 w-5" />
                        : <Bell className="h-5 w-5" />}
        </button>
    );
}
