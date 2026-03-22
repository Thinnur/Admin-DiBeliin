// =============================================================================
// DiBeliin Admin - Admin Layout
// =============================================================================
// Premium admin shell with polished sidebar and header

import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
    Package,
    DollarSign,
    Calculator,
    Sliders,
    MapPin,
    Menu,
    X,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    LogOut,
    User,
    UtensilsCrossed,
    MonitorPlay,
    CalendarClock,
    Layers,
    ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import type { User as SupabaseUser } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// Navigation Items
// -----------------------------------------------------------------------------

const navItems = [
    {
        label: 'Inventory',
        path: '/inventory',
        icon: Package,
        description: 'Manage accounts',
    },
    {
        label: 'Finance',
        path: '/finance',
        icon: DollarSign,
        description: 'Track transactions',
    },
    {
        label: 'Calculator',
        path: '/calculator',
        icon: Calculator,
        description: 'Optimize orders',
    },
    {
        label: 'Operational',
        path: '/operational',
        icon: Sliders,
        description: 'Store & vouchers',
    },
    {
        label: 'Outlets',
        path: '/outlets',
        icon: MapPin,
        description: 'Manage outlets',
    },
    {
        label: 'Daftar Menu',
        path: '/menus',
        icon: UtensilsCrossed,
        description: 'Kelola menu & harga',
    },
    {
        label: 'Katalog Digital',
        path: '/digital-products',
        icon: MonitorPlay,
        description: 'Netflix, Spotify, dll.',
    },
    {
        label: 'Tracking Langganan',
        path: '/digital-tracking',
        icon: CalendarClock,
        description: 'Masa aktif pelanggan',
    },
    {
        label: 'Kelola Provider',
        path: '/digital-providers',
        icon: Layers,
        description: 'Provider & logo',
    },
];

// -----------------------------------------------------------------------------
// Page Titles
// -----------------------------------------------------------------------------

const pageTitles: Record<string, { title: string; description: string }> = {
    '/inventory': {
        title: 'Inventory',
        description: 'Manage your coffee shop accounts',
    },
    '/finance': {
        title: 'Finance',
        description: 'Track income, expenses, and profits',
    },
    '/calculator': {
        title: 'Calculator',
        description: 'Optimize order splitting for maximum savings',
    },
    '/operational': {
        title: 'Operational',
        description: 'Manage store status and vouchers',
    },
    '/outlets': {
        title: 'Outlets',
        description: 'Manage outlet locations',
    },
    '/menus': {
        title: 'Daftar Menu',
        description: 'Kelola harga dan ketersediaan menu',
    },
    '/digital-products': {
        title: 'Katalog Digital',
        description: 'Kelola produk digital (Netflix, Spotify, dll.)',
    },
    '/digital-tracking': {
        title: 'Tracking Langganan',
        description: 'Pantau masa aktif langganan pelanggan',
    },
    '/digital-providers': {
        title: 'Kelola Provider',
        description: 'Tambah dan kelola provider digital beserta logo',
    },
};

// -----------------------------------------------------------------------------
// Sidebar Component
// -----------------------------------------------------------------------------

interface SidebarProps {
    isOpen: boolean;
    collapsed: boolean;
    onClose: () => void;
    onSignOut: () => void;
    onToggleCollapse: () => void;
    user: SupabaseUser | null;
    isStaff: boolean;
}

function Sidebar({ isOpen, collapsed, onClose, onSignOut, onToggleCollapse, user, isStaff }: SidebarProps) {
    const location = useLocation();

    // Filter navigasi: Staff hanya bisa akses Inventory dan Calculator
    const visibleNavItems = isStaff
        ? navItems.filter((item) => ['/inventory', '/calculator'].includes(item.path))
        : navItems;

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm md:hidden"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <aside
                className={cn(
                    'fixed inset-y-0 left-0 z-50 bg-slate-900 text-white transform transition-all duration-300 ease-out',
                    // Desktop: sticky full-height sidebar (not fixed)
                    'md:translate-x-0 md:sticky md:top-0 md:h-screen md:z-auto',
                    'flex flex-col overflow-hidden',
                    // Desktop: collapsed = icon-only (72px), expanded = full (288px)
                    collapsed ? 'md:w-[72px]' : 'md:w-72',
                    // Mobile: always full width when open
                    'w-72',
                    isOpen ? 'translate-x-0' : '-translate-x-full'
                )}
                style={{
                    paddingTop: 'env(safe-area-inset-top, 0px)',
                }}
            >
                {/* Logo */}
                <div className={cn(
                    'flex items-center h-16 border-b border-slate-800 transition-all duration-300',
                    collapsed ? 'justify-center px-2' : 'justify-between px-5'
                )}>
                    <div className={cn('flex items-center', collapsed ? 'gap-0' : 'gap-3')}>
                        <img
                            src="/Logo DiBeliin Admin.png"
                            alt="DiBeliin Admin"
                            className={cn(
                                'w-auto transition-all duration-300',
                                collapsed ? 'h-8' : 'h-10'
                            )}
                        />
                        {!collapsed && (
                            <div className="animate-fade-in">
                                <h1 className="font-bold text-lg tracking-tight">DiBeliin</h1>
                                <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">
                                    Admin Panel
                                </p>
                            </div>
                        )}
                    </div>
                    {/* Mobile close button */}
                    {!collapsed && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="md:hidden text-slate-400 hover:text-white hover:bg-slate-800"
                            onClick={onClose}
                        >
                            <X className="h-5 w-5" />
                        </Button>
                    )}
                </div>

                {/* Navigation */}
                <nav className={cn(
                    'flex-1 space-y-1.5 overflow-y-auto transition-all duration-300',
                    collapsed ? 'p-2' : 'p-4'
                )}>
                    {!collapsed && (
                        <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider px-3 mb-3">
                            Menu
                        </p>
                    )}
                    {visibleNavItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        const Icon = item.icon;

                        return (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                onClick={onClose}
                                title={collapsed ? item.label : undefined}
                                className={cn(
                                    'flex items-center rounded-xl transition-all duration-200 group relative',
                                    collapsed
                                        ? 'justify-center px-0 py-2.5'
                                        : 'gap-3 px-4 py-3',
                                    isActive
                                        ? 'bg-amber-500/10 text-amber-400'
                                        : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                                )}
                            >
                                <div
                                    className={cn(
                                        'p-2 rounded-lg transition-colors flex-shrink-0',
                                        isActive
                                            ? 'bg-amber-500/20'
                                            : 'bg-slate-800 group-hover:bg-slate-700'
                                    )}
                                >
                                    <Icon className="h-4 w-4" />
                                </div>
                                {!collapsed && (
                                    <>
                                        <div className="flex-1 min-w-0">
                                            <span className="font-medium">{item.label}</span>
                                            <p
                                                className={cn(
                                                    'text-xs truncate',
                                                    isActive ? 'text-amber-400/60' : 'text-slate-500'
                                                )}
                                            >
                                                {item.description}
                                            </p>
                                        </div>
                                        {isActive && (
                                            <ChevronRight className="h-4 w-4 text-amber-400 flex-shrink-0" />
                                        )}
                                    </>
                                )}

                                {/* Tooltip: gunakan title attribute (native) saat collapsed
                                     untuk menghindari custom div yang overflow keluar sidebar */}
                            </NavLink>
                        );
                    })}
                </nav>

                {/* User Section */}
                <div className={cn(
                    'border-t border-slate-800 transition-all duration-300',
                    collapsed ? 'p-2' : 'p-4'
                )}>
                    {collapsed ? (
                        // Collapsed: hanya ikon user + sign out
                        <div className="flex flex-col items-center gap-2">
                            <div className="p-2 bg-gradient-to-br from-slate-600 to-slate-700 rounded-lg" title={user?.email || 'Admin'}>
                                <User className="h-4 w-4 text-slate-300" />
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                                onClick={onSignOut}
                                title="Sign Out"
                            >
                                <LogOut className="h-4 w-4" />
                            </Button>
                        </div>
                    ) : (
                        // Expanded: full user section
                        <>
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50">
                                <div className="p-2 bg-gradient-to-br from-slate-600 to-slate-700 rounded-lg">
                                    <User className="h-4 w-4 text-slate-300" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-200 truncate">
                                        {user?.email || 'Admin'}
                                    </p>
                                    {isStaff ? (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                                            <ShieldAlert className="h-2.5 w-2.5" />
                                            Staff Mode
                                        </span>
                                    ) : (
                                        <p className="text-xs text-slate-500">Super Admin</p>
                                    )}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                                    onClick={onSignOut}
                                    title="Sign Out"
                                >
                                    <LogOut className="h-4 w-4" />
                                </Button>
                            </div>
                            <p className="text-center text-[10px] text-slate-600 mt-4">
                                Jastip Management System • v1.0.0
                            </p>
                        </>
                    )}

                    {/* Collapse / Expand toggle — desktop only */}
                    <button
                        onClick={onToggleCollapse}
                        className={cn(
                            'hidden md:flex items-center justify-center w-full rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors',
                            collapsed ? 'mt-2 py-2' : 'mt-3 py-2 gap-2'
                        )}
                        title={collapsed ? 'Perlebar sidebar' : 'Perkecil sidebar'}
                    >
                        {collapsed ? (
                            <ChevronsRight className="h-4 w-4" />
                        ) : (
                            <>
                                <ChevronsLeft className="h-4 w-4" />
                                <span className="text-xs font-medium">Perkecil</span>
                            </>
                        )}
                    </button>
                </div>
            </aside>
        </>
    );
}

// -----------------------------------------------------------------------------
// Mobile Bottom Navigation
// -----------------------------------------------------------------------------

// Menu default untuk Super Admin
const primaryNavItems = navItems.filter((item) =>
    ['/inventory', '/finance', '/calculator', '/outlets'].includes(item.path)
);
const secondaryNavItems = navItems.filter(
    (item) => !['/inventory', '/finance', '/calculator', '/outlets'].includes(item.path)
);

// Menu untuk Staff (hanya Inventory & Calculator)
const staffNavItems = navItems.filter((item) =>
    ['/inventory', '/calculator'].includes(item.path)
);

interface MobileBottomNavProps {
    isStaff: boolean;
    onSignOut: () => void;
}

function MobileBottomNav({ isStaff, onSignOut }: MobileBottomNavProps) {
    const location = useLocation();
    const navigate = useNavigate();
    const [moreMenuOpen, setMoreMenuOpen] = useState(false);
    const popupRef = useRef<HTMLDivElement>(null);

    // Cek apakah halaman aktif ada di secondary menu
    const isSecondaryActive = !isStaff && secondaryNavItems.some(
        (item) => location.pathname === item.path
    );

    // Tentukan item yang ditampilkan berdasarkan role
    const activePrimaryItems = isStaff ? staffNavItems : primaryNavItems;

    // Tutup popup saat klik di luar
    useEffect(() => {
        if (!moreMenuOpen) return;
        const handler = (e: MouseEvent) => {
            if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
                setMoreMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [moreMenuOpen]);

    return (
        <>
            {/* ----------------------------------------------------------------- */}
            {/* Bottom Navigation Bar — 4 menu utama + tombol "Lainnya"           */}
            {/* ----------------------------------------------------------------- */}
            <nav
                className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/90 backdrop-blur-xl border-t border-slate-200/80"
                style={{
                    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                }}
            >
                <div className="flex h-14 items-center justify-around">
                    {activePrimaryItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        const Icon = item.icon;

                        return (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                onClick={() => setMoreMenuOpen(false)}
                                className={cn(
                                    'relative flex flex-col items-center justify-center gap-0.5 transition-colors px-3 py-1',
                                    'min-w-[60px]',
                                    isActive
                                        ? 'text-amber-600'
                                        : 'text-slate-400 active:text-slate-600'
                                )}
                            >
                                {isActive && (
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-amber-500 rounded-full" />
                                )}
                                <Icon className={cn('h-5 w-5 flex-shrink-0', isActive && 'drop-shadow-sm')} />
                                <span className={cn(
                                    'text-[10px] leading-tight text-center whitespace-nowrap',
                                    isActive ? 'font-semibold' : 'font-medium'
                                )}>
                                    {item.label}
                                </span>
                            </NavLink>
                        );
                    })}

                    {/* Tombol Logout — hanya tampil untuk Staff (langsung di bar) */}
                    {isStaff && (
                        <button
                            onClick={onSignOut}
                            className="relative flex flex-col items-center justify-center gap-0.5 transition-colors px-3 py-1 min-w-[60px] text-slate-400 active:text-red-500"
                        >
                            <LogOut className="h-5 w-5 flex-shrink-0" />
                            <span className="text-[10px] leading-tight font-medium">Keluar</span>
                        </button>
                    )}

                    {/* Tombol "Lainnya" — hanya tampil untuk Super Admin */}
                    {!isStaff && (
                        <div className="relative min-w-[60px] flex justify-center" ref={popupRef}>
                            {/* Popup — muncul ke atas dari tombol */}
                            {moreMenuOpen && (
                                <div className="absolute bottom-full right-0 mb-3 w-64 bg-white rounded-2xl shadow-xl border border-slate-200/80 z-[80] overflow-hidden">
                                    {/* Header */}
                                    <div className="px-4 py-3 border-b border-slate-100">
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                            Menu Lainnya
                                        </p>
                                    </div>

                                    {/* Items */}
                                    <nav className="p-2 space-y-0.5">
                                        {secondaryNavItems.map((item) => {
                                            const isActive = location.pathname === item.path;
                                            const Icon = item.icon;
                                            return (
                                                <button
                                                    key={item.path}
                                                    onClick={() => {
                                                        navigate(item.path);
                                                        setMoreMenuOpen(false);
                                                    }}
                                                    className={cn(
                                                        'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all duration-150 text-left',
                                                        isActive
                                                            ? 'bg-amber-50 text-amber-700'
                                                            : 'text-slate-600 hover:bg-slate-50 active:bg-slate-100'
                                                    )}
                                                >
                                                    <div className={cn(
                                                        'p-1.5 rounded-lg shrink-0',
                                                        isActive ? 'bg-amber-100' : 'bg-slate-100'
                                                    )}>
                                                        <Icon className="h-4 w-4" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <span className="font-medium text-sm">{item.label}</span>
                                                        <p className={cn(
                                                            'text-xs truncate',
                                                            isActive ? 'text-amber-500' : 'text-slate-400'
                                                        )}>
                                                            {item.description}
                                                        </p>
                                                    </div>
                                                    {isActive && (
                                                        <ChevronRight className="h-4 w-4 text-amber-500 shrink-0" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </nav>

                                    {/* Divider + Logout */}
                                    <div className="border-t border-slate-100 p-2">
                                        <button
                                            onClick={() => {
                                                setMoreMenuOpen(false);
                                                onSignOut();
                                            }}
                                            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all duration-150 text-left text-red-500 hover:bg-red-50 active:bg-red-100"
                                        >
                                            <div className="p-1.5 rounded-lg shrink-0 bg-red-50">
                                                <LogOut className="h-4 w-4" />
                                            </div>
                                            <span className="font-medium text-sm">Keluar</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Tombol trigger */}
                            <button
                                onClick={() => setMoreMenuOpen(prev => !prev)}
                                className={cn(
                                    'relative flex flex-col items-center justify-center gap-0.5 transition-colors px-3 py-1 w-full',
                                    moreMenuOpen || isSecondaryActive
                                        ? 'text-amber-600'
                                        : 'text-slate-400 active:text-slate-600'
                                )}
                            >
                                {isSecondaryActive && !moreMenuOpen && (
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-amber-500 rounded-full" />
                                )}
                                <Menu className={cn(
                                    'h-5 w-5 flex-shrink-0 transition-transform duration-200',
                                    moreMenuOpen && 'rotate-90'
                                )} />
                                <span className={cn(
                                    'text-[10px] leading-tight text-center whitespace-nowrap',
                                    (moreMenuOpen || isSecondaryActive) ? 'font-semibold' : 'font-medium'
                                )}>
                                    Lainnya
                                </span>
                            </button>
                        </div>
                    )}
                </div>
            </nav>
        </>
    );
}

// -----------------------------------------------------------------------------
// Header Component
// -----------------------------------------------------------------------------

interface HeaderProps {
    pageInfo: { title: string; description: string };
}

function Header({ pageInfo }: HeaderProps) {
    return (
        <header
            className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200/80"
            style={{
                paddingTop: 'env(safe-area-inset-top, 0px)',
            }}
        >
            <div className="flex items-center justify-between h-14 md:h-16 px-4 md:px-6">
                <div className="flex items-center gap-3 md:gap-4">
                    {/* Mobile: small logo */}
                    <img
                        src="/Logo DiBeliin Admin.png"
                        alt="DiBeliin Admin"
                        className="h-7 w-auto md:hidden"
                    />

                    {/* Page Title */}
                    <div className="animate-fade-in">
                        <h2 className="text-base md:text-lg font-semibold text-slate-900">
                            {pageInfo.title}
                        </h2>
                        <p className="text-sm text-slate-500 hidden sm:block">
                            {pageInfo.description}
                        </p>
                    </div>
                </div>

                {/* Desktop: logo */}
                <div className="hidden md:flex items-center gap-3">
                    <img
                        src="/Logo DiBeliin Admin.png"
                        alt="DiBeliin Admin"
                        className="h-9 w-auto"
                    />
                </div>
            </div>
        </header>
    );
}

// -----------------------------------------------------------------------------
// Admin Layout Component
// -----------------------------------------------------------------------------

// Key untuk localStorage agar sidebar mengingat preferensi user
const SIDEBAR_COLLAPSED_KEY = 'dibeliin_sidebar_collapsed';

export default function AdminLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        // Baca preferensi dari localStorage saat pertama kali render
        try {
            return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
        } catch {
            return false;
        }
    });
    const [user, setUser] = useState<SupabaseUser | null>(null);
    const navigate = useNavigate();
    const location = useLocation();
    const { isStaff } = useAuth();

    const pageInfo = pageTitles[location.pathname] || {
        title: 'Dashboard',
        description: 'Welcome to DiBeliin Admin',
    };

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUser(user);
        });
    }, []);

    const handleSignOut = async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            toast.success('Signed out successfully');
            navigate('/login');
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Sign out failed';
            toast.error(message);
        }
    };

    const handleToggleCollapse = () => {
        setSidebarCollapsed((prev) => {
            const next = !prev;
            try {
                localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
            } catch { /* ignore */ }
            return next;
        });
    };

    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* Sidebar */}
            <Sidebar
                isOpen={sidebarOpen}
                collapsed={sidebarCollapsed}
                onClose={() => setSidebarOpen(false)}
                onToggleCollapse={handleToggleCollapse}
                onSignOut={handleSignOut}
                user={user}
                isStaff={isStaff}
            />

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <Header
                    pageInfo={pageInfo}
                />

                {/* Page Content */}
                <main className="flex-1 p-3 md:p-6 pb-20 md:pb-6 overflow-auto">
                    <div className="animate-fade-in">
                        <Outlet />
                    </div>
                </main>
            </div>

            {/* Mobile Bottom Navigation */}
            <MobileBottomNav isStaff={isStaff} onSignOut={handleSignOut} />
        </div>
    );
}
