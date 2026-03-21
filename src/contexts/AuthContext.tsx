// =============================================================================
// DiBeliin Admin - Auth Context (RBAC)
// =============================================================================
// Menyediakan informasi user & role secara global.
// Role dibaca dari Supabase Auth user_metadata.role.
// Default: 'super_admin' jika metadata tidak ada/tidak diset.

import { createContext, useContext, useEffect, useState, useRef } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type UserRole = 'super_admin' | 'staff';

interface AuthContextValue {
    user: User | null;
    role: UserRole;
    isStaff: boolean;
    isSuperAdmin: boolean;
    isLoading: boolean;
}

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue>({
    user: null,
    role: 'super_admin',
    isStaff: false,
    isSuperAdmin: true,
    isLoading: true,
});

// -----------------------------------------------------------------------------
// Provider
// -----------------------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const initialized = useRef(false);

    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;

        // Gunakan getUser() bukan getSession() agar metadata selalu fresh dari server
        // getSession() membaca JWT cache yang mungkin sudah stale
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUser(user ?? null);
            setIsLoading(false);
        });

        // Dengarkan perubahan auth (login/logout)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                if (session) {
                    // Refresh user data agar metadata terbaru ter-load
                    const { data: { user } } = await supabase.auth.getUser();
                    setUser(user ?? null);
                } else {
                    setUser(null);
                }
                setIsLoading(false);
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    // Deteksi role dari user_metadata
    // Jika metadata tidak ada atau bukan 'staff', default = 'super_admin'
    const role: UserRole =
        user?.user_metadata?.role === 'staff' ? 'staff' : 'super_admin';

    const value: AuthContextValue = {
        user,
        role,
        isStaff: role === 'staff',
        isSuperAdmin: role === 'super_admin',
        isLoading,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useAuth(): AuthContextValue {
    return useContext(AuthContext);
}
