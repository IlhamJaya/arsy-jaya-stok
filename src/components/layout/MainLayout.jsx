import React, { useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from './Sidebar';
import PWAInstallPrompt from '../PWAInstallPrompt';
import { NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import useAppStore from '../../store/useAppStore';
import {
    Moon, Sun, Settings, Users,
    ClipboardList, FileEdit, Package, Factory, FileText, CalendarRange, AlertTriangle,
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

    const items = [{ label: 'Log Harian', path: '/dashboard', roles: ['*'], icon: ClipboardList }];

    items.push({ label: 'Input Laporan', path: '/input-report', roles: [r], icon: FileEdit });

    items.push({ label: 'Inventory', path: '/inventory', roles: ['*'], icon: Package });

    if (r === 'SPV' || r === 'HRD') {
        items.push({ label: 'Supplier', path: '/suppliers', roles: [r], icon: Factory });
        items.push({ label: 'Reports', path: '/reports', roles: [r], icon: FileText });
        items.push({ label: 'Rekap Mingguan', path: '/weekly-report', roles: [r], icon: CalendarRange });
    }

    if (r !== 'OP_CETAK') items.push({ label: 'Lapor Kendala', path: '/defects', roles: ['*'], icon: AlertTriangle });

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
        case '/suppliers':
            return {
                active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/35 shadow-sm',
                idle: 'bg-emerald-500/10 border-emerald-500/30 t-muted',
                hover: 'hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-400/45',
            };
        case '/reports':
            return {
                active: 'bg-purple-500/15 text-purple-400 border-purple-500/35 shadow-sm',
                idle: 'bg-purple-500/10 border-purple-500/25 t-muted',
                hover: 'hover:bg-purple-500/20 hover:text-purple-300 hover:border-purple-400/45',
            };
        case '/weekly-report':
            return {
                active: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/35 shadow-sm',
                idle: 'bg-indigo-500/10 border-indigo-500/25 t-muted',
                hover: 'hover:bg-indigo-500/20 hover:text-indigo-300 hover:border-indigo-400/45',
            };
        case '/defects':
            return {
                active: 'bg-brand-red/15 text-brand-red border-brand-red/30 shadow-sm',
                idle: 'bg-brand-red/10 border-brand-red/25 t-muted',
                hover: 'hover:bg-brand-red/20 hover:text-brand-red hover:border-brand-red/40',
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
                        <div className="max-w-7xl mx-auto px-3 sm:px-4 min-h-[52px] flex items-center gap-2 sm:gap-2.5 min-w-0">
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

                            {/* Nav utama — scroll horizontal jika tidak muat, tidak menimpa tombol kanan */}
                            <nav
                                className="flex flex-1 min-w-0 items-center justify-center gap-0.5 overflow-x-auto overflow-y-hidden py-1 px-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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

                            {/* Aksi kanan — selalu utuh, tidak tertindih nav */}
                            <div className="flex shrink-0 items-center gap-1 pl-1.5 sm:pl-2 border-l border-theme/60">
                                <button
                                    type="button"
                                    onClick={toggleTheme}
                                    className="p-1.5 rounded-lg bg-blue-600/10 border border-blue-500/30 hover:bg-blue-600/15 transition-colors"
                                    title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                                >
                                    {theme === 'dark' ? (
                                        <Sun className="w-3.5 h-3.5 text-blue-400" />
                                    ) : (
                                        <Moon className="w-3.5 h-3.5 text-blue-400" />
                                    )}
                                </button>

                                {userRole === 'SPV' && (
                                    <NavLink
                                        to="/profiles"
                                        className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/15 transition-colors"
                                        title="Profiles"
                                    >
                                        <Users className="w-3.5 h-3.5 text-emerald-500" />
                                    </NavLink>
                                )}

                                {userRole === 'SPV' && (
                                    <NavLink
                                        to="/settings"
                                        className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/30 hover:bg-red-500/15 transition-colors"
                                        title="Settings"
                                    >
                                        <Settings className="w-3.5 h-3.5 text-red-400" />
                                    </NavLink>
                                )}

                                <div
                                    ref={userMenuRef}
                                    className="relative flex items-center gap-1.5 sm:gap-2 pl-1 min-w-0"
                                >
                                    <button
                                        type="button"
                                        onClick={() => setIsUserMenuOpen((v) => !v)}
                                        className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0 hover:bg-emerald-500/15 transition-colors cursor-pointer"
                                        aria-haspopup="menu"
                                        aria-expanded={isUserMenuOpen}
                                        title="Menu Akun"
                                    >
                                        <span className="text-[10px] font-bold text-emerald-500 leading-none">
                                            {getInitials(profile.full_name || profile.email)}
                                        </span>
                                    </button>

                                    {isUserMenuOpen && (
                                        <div
                                            role="menu"
                                            className="absolute right-0 top-[40px] w-[260px] border border-theme rounded-xl shadow-2xl p-3 z-[120]"
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

                                    <div className="min-w-0 hidden md:block max-w-[7rem] lg:max-w-[9rem]">
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
