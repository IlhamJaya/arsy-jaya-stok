import React, { useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from './Sidebar';
import PWAInstallPrompt from '../PWAInstallPrompt';
import { NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import useAppStore from '../../store/useAppStore';
import { Moon, Sun, Settings, Users } from 'lucide-react';

const getRoleBadgeClass = (role) => {
    const r = (role || '').toString().trim().toUpperCase();
    switch (r) {
        case 'SPV':
            return 'text-brand-amber bg-brand-amber/10 border-brand-amber/20';
        case 'SALES':
            return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
        case 'OP_CUTTING':
            return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
        case 'OP_CETAK':
            return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30';
        default:
            return 't-secondary bg-slate-400/10 border-slate-400/20';
    }
};

const getInitials = (nameOrEmail) => {
    const s = (nameOrEmail || '').toString().trim();
    if (!s) return 'U';
    const parts = s.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
};

const getTopbarMenuItems = (role) => {
    const r = (role || '').toString().trim().toUpperCase();

    const items = [{ label: 'Log Harian', path: '/dashboard', roles: ['*'] }];

    // Input Laporan tidak terlihat untuk role SPV/HRD (mengacu ke logika Sidebar).
    if (r !== 'SPV' && r !== 'HRD') items.push({ label: 'Input Laporan', path: '/input-report', roles: [r] });

    items.push({ label: 'Inventory', path: '/inventory', roles: ['*'] });

    if (r === 'SPV' || r === 'HRD') {
        items.push({ label: 'Supplier', path: '/suppliers', roles: [r] });
        items.push({ label: 'Reports', path: '/reports', roles: [r] });
    }

    if (r !== 'OP_CETAK') items.push({ label: 'Lapor Kendala', path: '/defects', roles: ['*'] });

    return items.filter((it) => it.roles.includes('*') || it.roles.includes(r));
};

const getTopbarAccent = (path) => {
    switch (path) {
        case '/dashboard':
            return {
                active: 'bg-accent-base/10 text-accent-base border-accent-base/20 shadow-sm',
                hover: 'hover:bg-accent-base/5 hover:text-accent-base/90',
            };
        case '/inventory':
            return {
                active: 'bg-brand-amber/10 text-brand-amber border-brand-amber/20 shadow-sm',
                hover: 'hover:bg-brand-amber/5 hover:text-brand-amber/90',
            };
        case '/suppliers':
            return {
                active: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 shadow-sm',
                hover: 'hover:bg-emerald-500/5 hover:text-emerald-500/90',
            };
        case '/reports':
            return {
                active: 'bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-sm',
                hover: 'hover:bg-purple-500/5 hover:text-purple-400/90',
            };
        case '/defects':
            return {
                active: 'bg-brand-red/10 text-brand-red border-brand-red/20 shadow-sm',
                hover: 'hover:bg-brand-red/5 hover:text-brand-red/90',
            };
        default:
            return {
                active: 'bg-accent-base/10 text-accent-base border-accent-base/20 shadow-sm',
                hover: 'hover:bg-accent-base/5 hover:text-accent-base/90',
            };
    }
};

export default function MainLayout({ children, userRole }) {
    const appTitle = useAppStore((s) => s.appTitle);
    const appSubtitle = useAppStore((s) => s.appSubtitle);
    const theme = useAppStore((s) => s.theme);
    const toggleTheme = useAppStore((s) => s.toggleTheme);
    // appSubtitle tidak dipakai di topbar desain baru, tapi tetap bisa dipakai di halaman lain.

    const [profile, setProfile] = useState({ full_name: '', role: '', email: '' });

    const menuItems = useMemo(() => getTopbarMenuItems(userRole), [userRole]);

    const navigate = useNavigate();
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const userMenuRef = useRef(null);

    useEffect(() => {
        if (!isUserMenuOpen) return;

        const onMouseDown = (e) => {
            const el = userMenuRef.current;
            if (el && !el.contains(e.target)) setIsUserMenuOpen(false);
        };

        const onKeyDown = (e) => {
            if (e.key === 'Escape') setIsUserMenuOpen(false);
        };

        document.addEventListener('mousedown', onMouseDown);
        document.addEventListener('keydown', onKeyDown);

        return () => {
            document.removeEventListener('mousedown', onMouseDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [isUserMenuOpen]);

    const handleLogout = async () => {
        setIsUserMenuOpen(false);
        await supabase.auth.signOut();
        window.location.href = '/login';
    };

    useEffect(() => {
        let isMounted = true;
        const run = async () => {
            const { data: sessionData } = await supabase.auth.getSession();
            const session = sessionData?.session;
            const user = session?.user;
            if (!user) return;

            const { data: pData } = await supabase
                .from('profiles')
                .select('full_name, role')
                .eq('id', user.id)
                .single();

            if (!isMounted) return;
            setProfile({
                full_name: pData?.full_name || user.email?.split('@')[0] || 'User',
                role: pData?.role || userRole || 'GUEST',
                email: user.email || '',
            });
        };

        run();
        return () => { isMounted = false; };
    }, [userRole]);

    return (
        <div className="flex min-h-screen overflow-hidden relative" style={{ backgroundColor: 'var(--bg-body)' }}>
            {/* Dynamic Background Gradients */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] blur-[120px] rounded-full pointer-events-none mix-blend-screen" style={{ background: 'var(--gradient-bg-1)' }} />
            <div className="absolute top-[20%] right-[-5%] w-[30%] h-[50%] blur-[100px] rounded-full pointer-events-none mix-blend-screen" style={{ background: 'var(--gradient-bg-2)' }} />
            <div className="absolute bottom-[-10%] left-[20%] w-[35%] h-[35%] blur-[120px] rounded-full pointer-events-none mix-blend-screen" style={{ background: 'var(--gradient-bg-1)', opacity: 0.3 }} />

            {/* Sidebar hanya untuk mobile (<lg). Desktop diganti topbar. */}
            <div className="lg:hidden">
                <Sidebar userRole={userRole} />
            </div>

            {/* Main Content — desktop full width (sidebar dihilangkan) */}
            <main
                className="flex-1 min-h-screen h-screen overflow-y-auto w-full relative z-10 pb-20 lg:pb-0"
                style={{ scrollbarGutter: 'stable' }}
            >
                {/* Desktop Topbar: App + Context + Navigation */}
                <div className="hidden lg:block w-full sticky top-0 z-[60]">
                    <header
                        className="w-full"
                        style={{
                            background: 'var(--bg-panel)',
                            borderBottom: '1px solid var(--border-glass)',
                            backdropFilter: 'blur(16px)',
                            WebkitBackdropFilter: 'blur(16px)',
                        }}
                    >
                        <div className="max-w-7xl mx-auto px-6 h-[64px] flex items-center justify-between gap-4">
                            <div className="min-w-0 flex items-center gap-4">
                                <div className="flex items-center gap-3 min-w-0">
                                    <img
                                        src="/Logo.svg"
                                        alt="Logo"
                                        className="w-9 h-9 object-contain"
                                    />
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold t-primary truncate">{appTitle}</p>
                                        <div className="flex items-center gap-3 min-w-0">
                                            <p className="text-[11px] t-muted font-mono uppercase tracking-wider truncate mb-0.5">
                                                {appSubtitle}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <nav className="flex items-center gap-2 min-w-0">
                                {menuItems.map((it) => (
                                    <NavLink
                                        key={it.path}
                                        to={it.path}
                                        className={({ isActive }) => {
                                            const accent = getTopbarAccent(it.path);
                                            return `px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
                                                isActive
                                                    ? accent.active
                                                    : `t-muted border-transparent ${accent.hover}`
                                            }`;
                                        }}
                                    >
                                        {it.label}
                                    </NavLink>
                                ))}
                            </nav>

                            <div className="flex items-center gap-3 min-w-0">
                                <button
                                    type="button"
                                    onClick={toggleTheme}
                                    className="p-2 rounded-xl bg-blue-600/10 border border-blue-500/30 hover:bg-blue-600/15 transition-colors"
                                    title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                                >
                                    {theme === 'dark' ? (
                                        <Sun className="w-4 h-4 text-blue-400" />
                                    ) : (
                                        <Moon className="w-4 h-4 text-blue-400" />
                                    )}
                                </button>

                                {userRole === 'SPV' && (
                                    <NavLink
                                        to="/profiles"
                                        className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/15 transition-colors"
                                        title="Profiles"
                                    >
                                        <Users className="w-4 h-4 text-emerald-500" />
                                    </NavLink>
                                )}

                                {userRole === 'SPV' && (
                                    <NavLink
                                        to="/settings"
                                        className="p-2 rounded-xl bg-red-500/10 border border-red-500/30 hover:bg-red-500/15 transition-colors"
                                        title="Settings"
                                    >
                                        <Settings className="w-4 h-4 text-red-400" />
                                    </NavLink>
                                )}

                                <div
                                    ref={userMenuRef}
                                    className="relative flex items-center gap-3 pl-2 border-l border-theme ml-1 min-w-0"
                                >
                                    <button
                                        type="button"
                                        onClick={() => setIsUserMenuOpen((v) => !v)}
                                        className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0 hover:bg-emerald-500/15 transition-colors cursor-pointer"
                                        aria-haspopup="menu"
                                        aria-expanded={isUserMenuOpen}
                                        title="Menu Akun"
                                    >
                                        <span className="text-xs font-bold text-emerald-500">
                                            {getInitials(profile.full_name || profile.email)}
                                        </span>
                                    </button>

                                    {isUserMenuOpen && (
                                        <div
                                            role="menu"
                                            className="absolute right-0 top-[48px] w-[290px] border border-theme rounded-xl shadow-2xl p-4 z-[120]"
                                            style={{
                                                backgroundColor: theme === 'light' ? '#ffffff' : '#0f172a',
                                            }}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 rounded-full bg-accent-base/10 border border-accent-base/20 flex items-center justify-center shrink-0">
                                                    <span className="text-sm font-bold text-accent-base">
                                                        {getInitials(profile.full_name || profile.email)}
                                                    </span>
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-semibold t-primary truncate">{profile.full_name || 'User'}</p>
                                                    <p className="text-xs t-muted font-mono truncate mt-0.5">
                                                        {profile.email || '-'}
                                                    </p>
                                                    <div className="mt-2">
                                                        <span
                                                            className={`inline-flex items-center gap-2 text-xs font-mono px-2 py-0.5 rounded border ${getRoleBadgeClass(profile.role)}`}
                                                        >
                                                            {profile.role || 'GUEST'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-4 space-y-2">
                                                <button
                                                    type="button"
                                                    onClick={handleLogout}
                                                    className="w-full flex items-center justify-center px-3 py-2.5 rounded-lg border border-brand-red/20 bg-brand-red/10 hover:bg-brand-red/20 transition-colors text-brand-red font-bold text-sm"
                                                >
                                                    Logout
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="min-w-0 hidden md:block">
                                        <p className="text-sm font-semibold t-primary truncate">{profile.full_name || 'User'}</p>
                                        <span
                                            className={`inline-flex items-center gap-2 text-xs font-mono px-2 py-0.5 rounded border ${getRoleBadgeClass(profile.role)}`}
                                        >
                                            {profile.role || 'GUEST'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </header>
                </div>

                {/* Main body */}
                <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 lg:pt-10">
                    {children}
                </div>
            </main>

            <PWAInstallPrompt />
        </div>

    );
}
