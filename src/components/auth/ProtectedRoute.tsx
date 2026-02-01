// =============================================================================
// DiBeliin Admin - Protected Route Wrapper
// =============================================================================
// Guards routes requiring authentication

import { useEffect, useState } from 'react';
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

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setIsLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setSession(session);
                setIsLoading(false);
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    // Loading state
    if (isLoading) {
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

    // Not authenticated - redirect to login
    if (!session) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Authenticated - render protected content
    return <Outlet />;
}
