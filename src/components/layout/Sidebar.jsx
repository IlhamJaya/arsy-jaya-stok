import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
    Package, Users, Settings, FileText, FileEdit, LogOut,
    ChevronRight, CircleCheck, Sun, Moon, Menu, X, AlertTriangle, Factory
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import useAppStore from '../../store/useAppStore';

export default function Sidebar({ userRole }) {
    const { appTitle, appSubtitle, appLogoSvg, theme, toggleTheme } = useAppStore();
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
        { icon: CircleCheck, label: 'Approval', path: '/dashboard' },
        { icon: Package, label: 'Inventory', path: '/inventory' },
        { icon: Factory, label: 'Partner & Supplier', path: '/suppliers' },
        { icon: FileText, label: 'Reports', path: '/reports' },
        { icon: AlertTriangle, label: 'Lapor Kendala', path: '/defects' }
    ];

    if (userRole !== 'SPV' && userRole !== 'HRD') {
        menuItems.splice(1, 0, { icon: FileEdit, label: 'Input Laporan', path: '/input-report' });
    }

    // SALES also gets access (already covered above since SALES !== SPV && SALES !== HRD)

    if (userRole === 'SPV') {
        menuItems.push({ icon: Users, label: 'Profiles', path: '/profiles' });
        menuItems.push({ icon: Settings, label: 'Settings', path: '/settings' });
    }

    return (
        <>
            {/* Mobile Top Bar */}
            <div className="lg:hidden fixed top-0 left-0 right-0 z-[60] glass-panel flex items-center px-4 h-14 gap-3"
                style={{ borderBottom: '1px solid var(--border-glass)' }}>
                <button onClick={() => setIsOpen(true)} className="p-2 rounded-xl t-primary hover:bg-brand-green/10 transition-colors shrink-0">
                    <Menu className="w-5 h-5" />
                </button>
                <h1 className="font-bold text-base tracking-tight t-primary uppercase">{appTitle}</h1>
            </div>

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
                            <h1 className="font-bold text-lg tracking-tight t-primary uppercase">{appTitle}</h1>
                            <p className="text-[10px] t-muted font-mono tracking-wider uppercase">{appSubtitle}</p>
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
                                            ? 'bg-brand-green/10 text-brand-green shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] border border-brand-green/20'
                                            : 't-muted hover:t-primary hover:bg-brand-green/5 border border-transparent'
                                        }`
                                    }
                                >
                                    {({ isActive }) => (
                                        <>
                                            <div className="flex items-center gap-3">
                                                <item.icon className={`w-5 h-5 ${isActive ? 'text-brand-green' : 't-muted group-hover:t-secondary'}`} />
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
        </>
    );
}
