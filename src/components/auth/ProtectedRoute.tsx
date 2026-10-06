// =============================================================================
// DiBeliin Admin - Protected Route Wrapper
// =============================================================================
// Guards routes requiring authentication.
// Uses delayed loading to prevent flicker when session is cached locally.

import { useEffect, useState } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2, Coffee, WifiOff } from 'lucide-react';
import { isAuthRetryableFetchError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

// 'offline' = sesi tersimpan tapi token kedaluwarsa dan perpanjangannya gagal
// karena jaringan. Itu BUKAN logout: auth-js sengaja tidak menghapus sesinya,
// jadi jangan lempar ke /login, cukup minta coba lagi. Dulu kasus ini (dan
// getSession yang lewat 8 detik) dibaca sebagai "belum login" -- staf di HP
// dengan kuota seret terus-terusan terlempar ke halaman login.
type Status = 'loading' | 'in' | 'out' | 'offline';

export default function ProtectedRoute() {
    const location = useLocation();
    const [status, setStatus] = useState<Status>('loading');
    const [attempt, setAttempt] = useState(0);

    // Loading screen hanya ditampilkan jika pengecekan sesi membutuhkan
    // waktu > 200ms. Jika sesi sudah ada di local storage, getSession()
    // biasanya selesai dalam < 50ms sehingga spinner tidak pernah muncul.
    const [showLoading, setShowLoading] = useState(false);
    // getSession() bisa menggantung lama (perpanjangan token di jaringan
    // penuh) atau selamanya (token basi yang tak pernah dibalas). Lewat 8 detik
    // -> tawarkan coba lagi / login ulang, tapi pengecekannya tetap ditunggu.
    const [slow, setSlow] = useState(false);

    useEffect(() => {
        let aktif = true;
        const loadingTimer = setTimeout(() => setShowLoading(true), 200);
        const slowTimer = setTimeout(() => setSlow(true), 8000);

        supabase.auth.getSession().then(({ data, error }) => {
            if (!aktif) return;
            clearTimeout(loadingTimer);
            clearTimeout(slowTimer);
            if (error && isAuthRetryableFetchError(error)) setStatus('offline');
            else setStatus(data.session ? 'in' : 'out');
        });

        return () => {
            aktif = false;
            clearTimeout(loadingTimer);
            clearTimeout(slowTimer);
        };
    }, [attempt]);

    useEffect(() => {
        // Sesi null dari event selain SIGNED_OUT (mis. INITIAL_SESSION waktu
        // refresh gagal karena jaringan) diabaikan -- itu bukan logout.
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                if (session) setStatus('in');
                else if (event === 'SIGNED_OUT') setStatus('out');
            }
        );
        return () => subscription.unsubscribe();
    }, []);

    const retry = () => {
        setStatus('loading');
        setSlow(false);
        setAttempt((n) => n + 1);
    };

    if (status === 'offline' || (status === 'loading' && slow)) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 p-6 text-center">
                <div className="p-4 bg-amber-500 rounded-2xl shadow-lg">
                    <WifiOff className="h-8 w-8 text-white" />
                </div>
                <div className="space-y-1">
                    <p className="font-semibold text-slate-800">Koneksi ke server lambat</p>
                    <p className="text-sm text-slate-500">
                        Kamu masih login. Cek sinyal/kuota, lalu coba lagi.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={retry} disabled={status === 'loading'}>
                        {status === 'loading' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Coba lagi
                    </Button>
                    <Button variant="outline" asChild>
                        <Link to="/login" state={{ from: location }}>Login ulang</Link>
                    </Button>
                </div>
            </div>
        );
    }

    if (status === 'loading' && showLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
                <div className="p-4 bg-amber-500 rounded-2xl shadow-lg animate-pulse">
                    <Coffee className="h-8 w-8 text-white" />
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Loading...</span>
                </div>
            </div>
        );
    }

    if (status === 'loading') return null;

    if (status === 'out') {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <Outlet />;
}
