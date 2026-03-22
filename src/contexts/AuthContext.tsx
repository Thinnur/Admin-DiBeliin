// =============================================================================
// DiBeliin Admin - Auth Context (RBAC)
// =============================================================================
// Menyediakan informasi user & role secara global.
// Role dibaca dari Supabase Auth user_metadata.role.
// Default: 'super_admin' jika metadata tidak ada/tidak diset.

import { createContext, useContext, useEffect, useState } from 'react';
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
    useEffect(() => {
        // onAuthStateChange adalah SATU-SATUNYA sumber kebenaran auth.
        // Saat subscribe, Supabase v2 langsung menembakkan event INITIAL_SESSION
        // dengan session dari localStorage — tidak ada panggilan jaringan terpisah
        // yang berlomba dengan handler ini.
        //
        // Alur yang dijamin berurutan:
        // 1. INITIAL_SESSION tiba  → setUser(session.user), setIsLoading(false)
        // 2. TOKEN_REFRESHED tiba  → setUser(user segar dari server), isLoading tetap false
        // 3. SIGNED_OUT tiba       → setUser(null), isLoading tetap false
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (session) {
                    if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
                        // Untuk login baru & token refresh: ambil metadata segar dari server
                        const { data: { user } } = await supabase.auth.getUser();
                        setUser(user ?? null);
                    } else {
                        // Untuk INITIAL_SESSION: pakai data dari JWT yang sudah ada di localStorage
                        // (cepat, tanpa network round-trip tambahan)
                        setUser(session.user);
                    }
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
