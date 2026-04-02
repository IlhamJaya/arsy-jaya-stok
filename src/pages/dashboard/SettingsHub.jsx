import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Settings } from 'lucide-react';
import SettingsDashboard from './SettingsDashboard';
import ProfilesDashboard from './ProfilesDashboard';

export default function SettingsHub() {
    const [searchParams, setSearchParams] = useSearchParams();
    const tab = searchParams.get('tab') === 'pengguna' ? 'pengguna' : 'sistem';

    return (
        <div className="w-full animate-in fade-in py-2 pb-10">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-base/85 mb-2">Administrasi</p>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight t-primary flex flex-wrap items-center gap-3">
                        <span className="inline-flex p-2 rounded-2xl bg-brand-amber/10 border border-brand-amber/25 shadow-sm" aria-hidden>
                            <Settings className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 text-brand-amber" />
                        </span>
                        <span>Pengaturan</span>
                    </h1>
                    <p className="t-secondary text-sm mt-3 max-w-xl leading-relaxed">
                        Sistem, WhatsApp / Fonnte, dan manajemen pengguna.
                    </p>
                </div>
                <div className="flex p-1 rounded-xl bg-[var(--bg-input)] border border-theme gap-1 shadow-sm self-start">
                    <button
                        type="button"
                        onClick={() => setSearchParams({})}
                        className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'sistem'
                            ? 't-primary shadow-sm'
                            : 't-primary opacity-75 hover:opacity-100'
                            }`}
                        style={tab === 'sistem' ? { background: 'var(--bg-surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.1), inset 0 0 0 1px var(--border-glass)' } : {}}
                    >
                        Sistem &amp; WA
                    </button>
                    <button
                        type="button"
                        onClick={() => setSearchParams({ tab: 'pengguna' })}
                        className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'pengguna'
                            ? 't-primary shadow-sm'
                            : 't-primary opacity-75 hover:opacity-100'
                            }`}
                        style={tab === 'pengguna' ? { background: 'var(--bg-surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.1), inset 0 0 0 1px var(--border-glass)' } : {}}
                    >
                        Pengguna
                    </button>
                </div>
            </div>

            {tab === 'sistem' ? <SettingsDashboard embedded /> : <ProfilesDashboard embedded />}
        </div>
    );
}
