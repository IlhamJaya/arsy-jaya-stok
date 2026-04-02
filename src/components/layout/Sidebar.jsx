import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
    Package, Users, Settings, FileText, FileEdit, LogOut,
    ChevronRight, ClipboardList, Sun, Moon, Menu, X, AlertTriangle, Factory, CalendarRange
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import useAppStore from '../../store/useAppStore';

export default function Sidebar({ userRole }) {
    const { appTitle, appSubtitle, theme, toggleTheme } = useAppStore();
    const [profile, setProfile] = React.useState({ name: 'Supervisor', role: 'SPV', initial: 'SP' });
    const [isOpen, setIsOpen] = useState(false);
    const location = useLocation();

    React.useEffect(() => {
        const fetchUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const { data } = await supabase.from('profiles').select('full_name, role').eq('id', session.user.id).single();
                if (data) {
                    setProfile({
                        name: data.full_name || session.user.email?.split('@')[0] || 'User',
                        role: data.role || 'GUEST',
                        initial: (data.full_name || session.user.email || 'U').substring(0, 2).toUpperCase()
                    });
                }
            }
        };
        fetchUser();
    }, []);

    // Close sidebar on route change (mobile)
    React.useEffect(() => {
        setIsOpen(false);
    }, [location.pathname]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/login';
    };

    let menuItems = [
        { icon: ClipboardList, label: 'Log Harian', shortLabel: 'Log', path: '/dashboard' }
    ];

    // Input Laporan bisa dilihat oleh semua role (submit tetap akan dibatasi di halaman ini).
    menuItems.push({ icon: FileEdit, label: 'Input Laporan', shortLabel: 'Input', path: '/input-report' });

    menuItems.push({ icon: Package, label: 'Inventory', shortLabel: 'Inventory', path: '/inventory' });

    if (userRole === 'SPV' || userRole === 'HRD') {
        menuItems.push({ icon: Factory, label: 'Partner & Supplier', shortLabel: 'Mitra', path: '/suppliers' });
        menuItems.push({ icon: FileText, label: 'Reports', shortLabel: 'Laporan', path: '/reports' });
        menuItems.push({ icon: CalendarRange, label: 'Rekap Mingguan', shortLabel: 'Mingguan', path: '/weekly-report' });
    }

    if (userRole !== 'OP_CETAK') {
        menuItems.push({ icon: AlertTriangle, label: 'Lapor Kendala', shortLabel: 'Kendala', path: '/defects' });
    }

    if (userRole === 'SPV') {
        menuItems.push({ icon: Users, label: 'Profiles', shortLabel: 'Profiles', path: '/profiles' });
        menuItems.push({ icon: Settings, label: 'Settings', shortLabel: 'Settings', path: '/settings' });
    }

    return (
        <>


            {/* Mobile Overlay */}
            {isOpen && (
                <div className="lg:hidden fixed inset-0 z-[70] backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.5)' }}
                    onClick={() => setIsOpen(false)} />
            )}

            {/* Sidebar */}
            <aside className={`
                glass-panel w-64 h-screen flex flex-col fixed left-0 top-0 z-[80] transition-transform duration-300
                lg:translate-x-0
                ${isOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                {/* Logo Area */}
                <div className="h-16 lg:h-20 flex items-center justify-between px-5 border-b border-theme shrink-0">
                    <div className="flex items-center">
                        <img src="/Logo.svg" alt="Logo" className="w-[2.2rem] h-[2.2rem] object-contain mr-3 drop-shadow-[0_0_5px_rgba(6,182,212,0.7)]" />
                        <div>
                            <h1 className="font-bold text-lg tracking-tight t-primary uppercase font-app-brand">{appTitle}</h1>
                            <p className="text-[10px] t-muted font-app-brand font-medium tracking-wide uppercase">{appSubtitle}</p>
                        </div>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="lg:hidden p-1.5 rounded-lg t-muted hover:t-primary transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-4 py-5 overflow-y-auto w-full">
                    <ul className="space-y-1">
                        {menuItems.map((item, index) => (
                            <li key={index}>
                                <NavLink to={item.path}
                                    className={({ isActive }) =>
                                        `flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 group
                                        ${isActive
                                            ? 'bg-accent-base/10 text-accent-base shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] border border-accent-base/20'
                                            : 't-muted hover:t-primary hover:bg-accent-base/5 border border-transparent'
                                        }`
                                    }
                                >
                                    {({ isActive }) => (
                                        <>
                                            <div className="flex items-center gap-3">
                                                <item.icon className={`w-5 h-5 ${isActive ? 'text-accent-base' : 't-muted group-hover:t-secondary'}`} />
                                                <span className="font-medium text-sm">{item.label}</span>
                                            </div>
                                            {isActive && <ChevronRight className="w-4 h-4 opacity-50" />}
                                        </>
                                    )}
                                </NavLink>
                            </li>
                        ))}
                    </ul>
                </nav>

                {/* Footer */}
                <div className="p-4 border-t border-theme">
                    <div className="flex items-center gap-3 mb-3 px-2">
                        <div className="w-9 h-9 rounded-full bg-surface border border-theme flex items-center justify-center shrink-0">
                            <span className="text-xs font-medium t-secondary">{profile.initial}</span>
                        </div>
                        <div className="overflow-hidden flex-1">
                            <h3 className="text-sm font-medium t-primary truncate">{profile.name}</h3>
                            <p className="text-xs text-brand-amber font-mono mt-0.5">{profile.role}</p>
                        </div>
                        <button onClick={toggleTheme}
                            className="p-2 rounded-xl border border-theme hover:bg-brand-amber/10 hover:text-brand-amber transition-all duration-200 t-muted"
                            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
                            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        </button>
                    </div>
                    <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-xl t-muted hover:text-brand-red hover:bg-brand-red/10 w-full transition-colors duration-200">
                        <LogOut className="w-5 h-5" />
                        <span className="font-medium text-sm">Logout</span>
                    </button>
                </div>
            </aside>

            {/* Mobile Bottom Navigation — hanya ikon (kotak seragam, tanpa teks dua baris) */}
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-[50] flex items-end pb-[max(env(safe-area-inset-bottom),0.5rem)] drop-shadow-[0_-5px_15px_rgba(0,0,0,0.1)]"
                style={{ borderTop: '1px solid var(--border-glass)', background: 'var(--bg-glass)', backdropFilter: 'blur(16px)' }}
                aria-label="Navigasi utama">
                <div className="flex items-stretch justify-around w-full px-1 min-h-[3.5rem]">
                    {menuItems.slice(0, 4).map((item, index) => (
                        <NavLink
                            key={index}
                            to={item.path}
                            end={item.path === '/dashboard'}
                            title={item.label}
                            aria-label={item.label}
                            className={({ isActive }) =>
                                `flex flex-1 items-center justify-center min-w-0 min-h-[3.25rem] rounded-xl transition-all duration-200
                                ${isActive ? 'text-accent-base bg-accent-base/10' : 't-muted hover:t-primary hover:bg-accent-base/5'}`
                            }
                        >
                            {({ isActive }) => (
                                <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${isActive ? 'ring-1 ring-accent-base/30' : ''}`}>
                                    <item.icon className={`w-5 h-5 shrink-0 ${isActive ? 'drop-shadow-[0_0_8px_rgba(34,197,94,0.45)] text-accent-base' : ''}`} />
                                </div>
                            )}
                        </NavLink>
                    ))}

                    <button
                        type="button"
                        onClick={() => setIsOpen(true)}
                        title="Menu lainnya"
                        aria-label="Buka menu lainnya"
                        className="flex flex-1 items-center justify-center min-w-0 min-h-[3.25rem] rounded-xl t-muted hover:t-primary hover:bg-accent-base/5 transition-colors"
                    >
                        <span className="flex items-center justify-center w-10 h-10 rounded-xl">
                            <Menu className="w-5 h-5" />
                        </span>
                    </button>
                </div>
            </nav>
        </>
    );
}
