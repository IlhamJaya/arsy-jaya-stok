import React, { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import PWAInstallPrompt from '../PWAInstallPrompt';
import { useLocation } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import useAppStore from '../../store/useAppStore';
import { User } from 'lucide-react';

const getPageTitle = (pathname) => {
    const path = pathname || '';
    if (path === '/dashboard') return 'Log Harian';
    if (path === '/inventory') return 'Inventory & Suplai';
    if (path === '/input-report') return 'Input Laporan';
    if (path === '/defects') return 'Lapor Kendala';
    if (path === '/reports') return 'Reports';
    if (path === '/suppliers') return 'Partner & Supplier';
    if (path === '/profiles') return 'Profiles';
    if (path === '/settings') return 'Settings';
    return 'Dashboard';
};

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

export default function MainLayout({ children, userRole }) {
    const location = useLocation();
    const appTitle = useAppStore((s) => s.appTitle);
    const appSubtitle = useAppStore((s) => s.appSubtitle);

    const [profile, setProfile] = useState({ full_name: '', role: '', email: '' });

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

            <Sidebar userRole={userRole} />

            {/* Main Content — ml-64 only on lg+, pb-20 for bottom nav */}
            <main className="flex-1 lg:ml-64 min-h-screen h-screen overflow-y-auto w-full relative z-10 pb-20 lg:pb-0">
                <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 lg:pt-10">
                    {/* Desktop Topbar: App + Context */}
                    <div
                        className="hidden lg:flex items-center justify-between gap-4 mb-6"
                        style={{
                            background: 'var(--bg-panel)',
                            border: '1px solid var(--border-glass)',
                            borderRadius: '16px',
                            padding: '12px 16px',
                        }}
                    >
                        <div className="min-w-0">
                            <p className="text-[11px] t-muted font-mono uppercase tracking-wider mb-0.5 truncate">
                                {appTitle}
                            </p>
                            <div className="flex items-center gap-3 min-w-0">
                                <h2 className="text-lg font-bold t-primary truncate">{getPageTitle(location.pathname)}</h2>
                                {appSubtitle ? (
                                    <span className="text-[11px] t-muted font-mono truncate">{appSubtitle}</span>
                                ) : null}
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-surface border border-theme flex items-center justify-center shrink-0">
                                <User className="w-4 h-4 t-muted" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold t-primary truncate">{profile.full_name || 'User'}</p>
                                <span
                                    className={`inline-flex items-center gap-2 text-xs font-mono px-2 py-0.5 rounded border ${getRoleBadgeClass(profile.role)}`}
                                >
                                    {profile.role || 'GUEST'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {children}
                </div>
            </main>

            <PWAInstallPrompt />
        </div>

    );
}
