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
/* eslint-disable react-refresh/only-export-components */

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
        let mounted = true;

        // Langkah 1: getSession() sebagai resolver UTAMA.
        // Ini menjamin isLoading=false + user ter-set, dengan atau tanpa
        // onAuthStateChange berhasil fire — aman dari React StrictMode double-invoke.
        // Sengaja bukan getUser(): itu request jaringan per tab, dan kalau gagal
        // (sinyal HP jelek) user jadi null padahal sesinya masih ada.
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!mounted) return;
            if (session) setUser(session.user);
            setIsLoading(false);
        });

        // Langkah 2: onAuthStateChange sebagai listener perubahan SELANJUTNYA.
        // Untuk SIGNED_IN baru & TOKEN_REFRESHED: gunakan user dari event
        // (lebih efisien, tidak perlu network call tambahan).
        // INITIAL_SESSION juga ditangani getSession() di atas.
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                if (!mounted) return;
                // Update user state saat login/logout/token refresh terjadi.
                // Sesi null selain SIGNED_OUT = refresh gagal karena jaringan, bukan logout.
                if (session || event === 'SIGNED_OUT') setUser(session?.user ?? null);
                // Pastikan isLoading juga off jika onAuthStateChange datang lebih dulu
                setIsLoading(false);
            }
        );

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);


    // Deteksi role dari user_metadata
    // Jika metadata tidak ada atau bukan 'staff', default = 'super_admin'.
    // Belum ada user (sesi belum terbaca) -> 'staff', hak paling kecil, supaya
    // staf tidak sempat melihat tampilan super_admin.
    const role: UserRole =
        !user || user.user_metadata?.role === 'staff' ? 'staff' : 'super_admin';

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
