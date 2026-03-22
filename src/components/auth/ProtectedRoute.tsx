// =============================================================================
// DiBeliin Admin - Protected Route Wrapper
// =============================================================================
// Guards routes requiring authentication.
// Uses delayed loading to prevent flicker when session is cached locally.

import { useEffect, useState, useRef } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2, Coffee } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function ProtectedRoute() {
    const location = useLocation();
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // -------------------------------------------------------------------------
    // Delayed loading — mencegah flicker.
    // Loading screen hanya ditampilkan jika pengecekan sesi membutuhkan
    // waktu > 200ms. Jika sesi sudah ada di local storage, getSession()
    // biasanya selesai dalam < 50ms sehingga spinner tidak pernah muncul.
    // -------------------------------------------------------------------------
    const [showLoading, setShowLoading] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        timerRef.current = setTimeout(() => {
            setShowLoading(true);
        }, 200);

        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setIsLoading(false);
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setSession(session);
                setIsLoading(false);
            }
        );

        return () => {
            subscription.unsubscribe();
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

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

    if (isLoading) return null;

    if (!session) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <Outlet />;
}

