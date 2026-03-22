// =============================================================================
// DiBeliin Admin - Protected Route Wrapper
// =============================================================================
// Guards routes requiring authentication.
// Menunggu BAIK ProtectedRoute (session check) MAUPUN AuthContext (user + role)
// selesai sebelum merender halaman anak — mencegah query data jalan tanpa auth.

import { useEffect, useState, useRef } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2, Coffee } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function ProtectedRoute() {
    const location = useLocation();
    const [session, setSession] = useState<Session | null>(null);
    const [isSessionLoading, setIsSessionLoading] = useState(true);

    // Tunggu juga AuthContext selesai memulihkan user + role dari Supabase
    const { isLoading: isAuthLoading } = useAuth();

    // -------------------------------------------------------------------------
    // REFACTORED: Delayed loading — mencegah flicker.
    // Loading screen hanya ditampilkan jika pengecekan sesi membutuhkan
    // waktu > 200ms. Jika sesi sudah ada di local storage, getSession()
    // biasanya selesai dalam < 50ms sehingga spinner tidak pernah muncul.
    // -------------------------------------------------------------------------
    const [showLoading, setShowLoading] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        // Mulai timer 200ms — jika session check belum selesai,
        // baru tampilkan loading screen.
        timerRef.current = setTimeout(() => {
            setShowLoading(true);
        }, 200);

        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setIsSessionLoading(false);

            // Batalkan timer jika session sudah didapat sebelum 200ms
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setSession(session);
                setIsSessionLoading(false);
            }
        );

        return () => {
            subscription.unsubscribe();
            // Cleanup timer untuk mencegah memory leak
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, []);

    // Gabungkan kedua loading state:
    // isSessionLoading = cek session lokal (cepat)
    // isAuthLoading    = validasi user + role di AuthContext (bisa lebih lambat)
    const isLoading = isSessionLoading || isAuthLoading;

    // Loading state — hanya tampil jika sudah melewati delay 200ms
    if (isLoading && showLoading) {
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

    // Masih loading tapi belum 200ms — render nothing (mencegah flicker)
    if (isLoading) {
        return null;
    }

    // Not authenticated - redirect to login
    if (!session) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Authenticated + AuthContext resolved - render protected content
    return <Outlet />;
}

