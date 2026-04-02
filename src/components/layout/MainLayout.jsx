import React, { useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from './Sidebar';
import PWAInstallPrompt from '../PWAInstallPrompt';
import { NavLink } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import useAppStore from '../../store/useAppStore';
import {
    Moon, Sun, Settings,
    ClipboardList, FileEdit, Package, FileText,
} from 'lucide-react';

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

    const items = [{ label: 'Dashboard', path: '/dashboard', roles: ['*'], icon: ClipboardList }];

    items.push({ label: 'Input & kendala', path: '/input-report', roles: [r], icon: FileEdit });

    items.push({ label: 'Stok & mitra', path: '/inventory', roles: ['*'], icon: Package });

    if (r === 'SPV' || r === 'HRD') {
        items.push({ label: 'Laporan', path: '/reports', roles: [r], icon: FileText });
    }

    return items.filter((it) => it.roles.includes('*') || it.roles.includes(r));
};

const getTopbarAccent = (path) => {
    switch (path) {
        case '/dashboard':
            return {
                active: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/35 shadow-sm',
                idle: 'bg-cyan-500/10 border-cyan-500/25 t-muted',
                hover: 'hover:bg-cyan-500/20 hover:text-cyan-300 hover:border-cyan-400/45',
            };
        case '/input-report':
            return {
                active: 'bg-sky-500/15 text-sky-400 border-sky-500/35 shadow-sm',
                idle: 'bg-sky-500/10 border-sky-500/25 t-muted',
                hover: 'hover:bg-sky-500/20 hover:text-sky-300 hover:border-sky-400/45',
            };
        case '/inventory':
            return {
                active: 'bg-brand-amber/15 text-brand-amber border-brand-amber/30 shadow-sm',
                idle: 'bg-brand-amber/10 border-brand-amber/25 t-muted',
                hover: 'hover:bg-brand-amber/20 hover:text-brand-amber hover:border-brand-amber/40',
            };
        case '/reports':
            return {
                active: 'bg-purple-500/15 text-purple-400 border-purple-500/35 shadow-sm',
                idle: 'bg-purple-500/10 border-purple-500/25 t-muted',
                hover: 'hover:bg-purple-500/20 hover:text-purple-300 hover:border-purple-400/45',
            };
        default:
            return {
                active: 'bg-accent-base/15 text-accent-base border-accent-base/30 shadow-sm',
                idle: 'bg-accent-base/10 border-accent-base/25 t-muted',
                hover: 'hover:bg-accent-base/20 hover:text-accent-base hover:border-accent-base/40',
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
                        <div className="max-w-7xl mx-auto px-3 sm:px-4 min-h-[52px] flex items-center gap-3 sm:gap-4 min-w-0">
                            {/* Brand — tidak mengecil melebihi wajar */}
                            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 min-w-0 max-w-[10rem] md:max-w-[13rem] xl:max-w-none">
                                <img
                                    src="/Logo.svg"
                                    alt="Logo"
                                    className="w-7 h-7 sm:w-8 sm:h-8 object-contain shrink-0"
                                />
                                <div className="min-w-0 hidden md:block leading-tight">
                                    <p className="text-xs font-bold t-primary truncate font-app-brand tracking-tight">{appTitle}</p>
                                    <p className="text-[10px] t-muted font-app-brand font-medium uppercase tracking-wide truncate">
                                        {appSubtitle}
                                    </p>
                                </div>
                            </div>

                            {/* Satu kelompok rata kanan: menu + utilitas (tanpa nav di tengah layar) */}
                            <div className="flex flex-1 min-w-0 justify-end items-center gap-2 sm:gap-2.5 py-1 min-h-[52px]">
                                <nav
                                    className="flex min-w-0 shrink items-center gap-1.5 sm:gap-2 overflow-x-auto overflow-y-visible py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                                    aria-label="Navigasi utama"
                                >
                                    {menuItems.map((it) => {
                                        const Icon = it.icon;
                                        return (
                                            <NavLink
                                                key={it.path}
                                                to={it.path}
                                                end={it.path === '/dashboard'}
                                                title={it.label}
                                                aria-label={it.label}
                                                className={({ isActive }) => {
                                                    const accent = getTopbarAccent(it.path);
                                                    return `inline-flex items-center justify-center gap-1.5 shrink-0 min-h-8 min-w-8 xl:min-w-0 xl:px-2.5 xl:py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                                                        isActive
                                                            ? accent.active
                                                            : `${accent.idle} ${accent.hover}`
                                                    }`;
                                                }}
                                            >
                                                {({ isActive }) => (
                                                    <>
                                                        <Icon
                                                            className={`w-3.5 h-3.5 shrink-0 xl:hidden ${isActive ? '' : 'opacity-90'}`}
                                                            aria-hidden
                                                        />
                                                        <span className="hidden xl:inline whitespace-nowrap max-w-[9rem] truncate" title={it.label}>{it.label}</span>
                                                    </>
                                                )}
                                            </NavLink>
                                        );
                                    })}
                                </nav>

                                <div
                                    className="flex shrink-0 items-center gap-2 border-l border-theme/50 pl-2 sm:pl-2.5 overflow-visible"
                                    aria-label="Pengaturan tampilan dan akun"
                                >
                                    <button
                                        type="button"
                                        onClick={toggleTheme}
                                        className={
                                            `h-8 w-8 rounded-lg flex items-center justify-center transition-colors ` +
                                            (theme === 'dark'
                                                ? 'bg-white border border-slate-200/95 hover:bg-slate-50 shadow-sm'
                                                : 'bg-black/95 border border-neutral-600/45 hover:bg-black/90 shadow-sm')
                                        }
                                        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                                    >
                                        {theme === 'dark' ? (
                                            <Sun className="w-4 h-4 shrink-0 text-blue-600" />
                                        ) : (
                                            <Moon className="w-4 h-4 shrink-0 text-sky-400" />
                                        )}
                                    </button>

                                    {userRole === 'SPV' && (
                                        <NavLink
                                            to="/settings"
                                            className={
                                                `h-8 w-8 rounded-lg flex items-center justify-center transition-colors ` +
                                                (theme === 'dark'
                                                    ? 'bg-white border border-slate-200/95 hover:bg-slate-50 shadow-sm'
                                                    : 'bg-black/95 border border-neutral-600/45 hover:bg-black/90 shadow-sm')
                                            }
                                            title="Pengaturan"
                                        >
                                            <Settings className={`w-4 h-4 shrink-0 ${theme === 'dark' ? 'text-red-600' : 'text-red-400'}`} />
                                        </NavLink>
                                    )}

                                    <div
                                        ref={userMenuRef}
                                        className="relative z-[130] flex items-center gap-2 lg:gap-0 min-w-0 overflow-visible"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => setIsUserMenuOpen((v) => !v)}
                                            className={
                                                `h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors cursor-pointer ` +
                                                (theme === 'dark'
                                                    ? 'bg-white border border-slate-200/95 hover:bg-slate-50 shadow-sm'
                                                    : 'bg-black/95 border border-neutral-600/45 hover:bg-black/90 shadow-sm')
                                            }
                                            aria-haspopup="menu"
                                            aria-expanded={isUserMenuOpen}
                                            title="Menu Akun"
                                        >
                                            <span
                                                className={
                                                    `text-[10px] font-bold leading-none select-none ` +
                                                    (theme === 'dark' ? 'text-emerald-600' : 'text-emerald-400')
                                                }
                                            >
                                                {getInitials(profile.full_name || profile.email)}
                                            </span>
                                        </button>

                                        {isUserMenuOpen && (
                                            <div
                                                role="menu"
                                                aria-label="Menu akun"
                                                className="absolute right-0 top-[calc(100%+8px)] w-[min(260px,calc(100vw-2rem))] border border-theme rounded-xl shadow-2xl p-3 z-[200]"
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

                                        {/* Nama + role: tablet saja; desktop (lg+) hanya ikon agar sebaris rapi */}
                                        <div className="min-w-0 hidden md:block lg:hidden max-w-[7rem]">
                                            <p className="text-xs font-semibold t-primary truncate leading-tight">{profile.full_name || 'User'}</p>
                                            <span
                                                className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0 rounded border mt-0.5 ${getRoleBadgeClass(profile.role)}`}
                                            >
                                                {profile.role || 'GUEST'}
                                            </span>
                                        </div>
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

                {/* Global Footer */}
                <footer className="mt-4 pb-8 pt-6 border-t border-theme mx-4 sm:mx-8 text-center flex flex-col items-center justify-center">
                    <p className="text-[11px] t-muted font-medium tracking-wide">
                        <span className="font-bold t-primary">1lhmjya.</span> Dibuat dengan logika, dedikasi, & secangkir kopi. &copy;2026
                    </p>
                </footer>
            </main>

            <PWAInstallPrompt />
        </div>

    );
}
