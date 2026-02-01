// =============================================================================
// DiBeliin Admin - Admin Layout
// =============================================================================
// Premium admin shell with polished sidebar and header

import { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
    Package,
    DollarSign,
    Menu,
    X,
    Coffee,
    ChevronRight,
    LogOut,
    User,
} from 'lucide-react';
import { toast } from 'sonner';
import type { User as SupabaseUser } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
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
};

// -----------------------------------------------------------------------------
// Sidebar Component
// -----------------------------------------------------------------------------

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    onSignOut: () => void;
    user: SupabaseUser | null;
}

function Sidebar({ isOpen, onClose, onSignOut, user }: SidebarProps) {
    const location = useLocation();

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <aside
                className={cn(
                    'fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-white transform transition-transform duration-300 ease-out lg:translate-x-0 lg:static lg:z-auto',
                    'flex flex-col',
                    isOpen ? 'translate-x-0' : '-translate-x-full'
                )}
            >
                {/* Logo */}
                <div className="flex items-center justify-between h-16 px-5 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl shadow-lg shadow-amber-500/20">
                            <Coffee className="h-5 w-5 text-white" strokeWidth={2} />
                        </div>
                        <div>
                            <h1 className="font-bold text-lg tracking-tight">DiBeliin</h1>
                            <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">
                                Admin Panel
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="lg:hidden text-slate-400 hover:text-white hover:bg-slate-800"
                        onClick={onClose}
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
                    <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider px-3 mb-3">
                        Menu
                    </p>
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        const Icon = item.icon;

                        return (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                onClick={onClose}
                                className={cn(
                                    'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group',
                                    isActive
                                        ? 'bg-amber-500/10 text-amber-400'
                                        : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                                )}
                            >
                                <div
                                    className={cn(
                                        'p-2 rounded-lg transition-colors',
                                        isActive
                                            ? 'bg-amber-500/20'
                                            : 'bg-slate-800 group-hover:bg-slate-700'
                                    )}
                                >
                                    <Icon className="h-4 w-4" />
                                </div>
                                <div className="flex-1">
                                    <span className="font-medium">{item.label}</span>
                                    <p
                                        className={cn(
                                            'text-xs',
                                            isActive ? 'text-amber-400/60' : 'text-slate-500'
                                        )}
                                    >
                                        {item.description}
                                    </p>
                                </div>
                                {isActive && (
                                    <ChevronRight className="h-4 w-4 text-amber-400" />
                                )}
                            </NavLink>
                        );
                    })}
                </nav>

                {/* User Section */}
                <div className="p-4 border-t border-slate-800">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50">
                        <div className="p-2 bg-gradient-to-br from-slate-600 to-slate-700 rounded-lg">
                            <User className="h-4 w-4 text-slate-300" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-200 truncate">
                                {user?.email || 'Admin'}
                            </p>
                            <p className="text-xs text-slate-500">Manager</p>
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

                    {/* Version */}
                    <p className="text-center text-[10px] text-slate-600 mt-4">
                        Jastip Management System • v1.0.0
                    </p>
                </div>
            </aside>
        </>
    );
}

// -----------------------------------------------------------------------------
// Header Component
// -----------------------------------------------------------------------------

interface HeaderProps {
    onMenuClick: () => void;
    pageInfo: { title: string; description: string };
}

function Header({ onMenuClick, pageInfo }: HeaderProps) {
    return (
        <header className="sticky top-0 z-30 h-16 bg-white/80 backdrop-blur-xl border-b border-slate-200/80">
            <div className="flex items-center justify-between h-full px-4 lg:px-6">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="lg:hidden hover:bg-slate-100"
                        onClick={onMenuClick}
                    >
                        <Menu className="h-5 w-5 text-slate-600" />
                    </Button>

                    {/* Page Title */}
                    <div className="animate-fade-in">
                        <h2 className="text-lg font-semibold text-slate-900">
                            {pageInfo.title}
                        </h2>
                        <p className="text-sm text-slate-500 hidden sm:block">
                            {pageInfo.description}
                        </p>
                    </div>
                </div>

                {/* Right Side - can add notifications, profile, etc. */}
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                        <span className="text-white font-bold text-sm">A</span>
                    </div>
                </div>
            </div>
        </header>
    );
}

// -----------------------------------------------------------------------------
// Admin Layout Component
// -----------------------------------------------------------------------------

export default function AdminLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [user, setUser] = useState<SupabaseUser | null>(null);
    const navigate = useNavigate();
    const location = useLocation();

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

    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* Sidebar */}
            <Sidebar
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                onSignOut={handleSignOut}
                user={user}
            />

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <Header
                    onMenuClick={() => setSidebarOpen(true)}
                    pageInfo={pageInfo}
                />

                {/* Page Content */}
                <main className="flex-1 p-4 lg:p-6 overflow-auto">
                    <div className="animate-fade-in">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}
