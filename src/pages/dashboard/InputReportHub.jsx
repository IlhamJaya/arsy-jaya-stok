import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileEdit, AlertTriangle } from 'lucide-react';
import InputReportDashboard from './InputReportDashboard';
import DefectsDashboard from './DefectsDashboard';

export default function InputReportHub({ userRole }) {
    const [searchParams, setSearchParams] = useSearchParams();
    const tab = searchParams.get('tab') === 'kendala' ? 'kendala' : 'input';
    const canKendala = userRole !== 'OP_CETAK';

    useEffect(() => {
        if (tab === 'kendala' && !canKendala) {
            setSearchParams({}, { replace: true });
        }
    }, [tab, canKendala, setSearchParams]);

    return (
        <div className="w-full animate-in fade-in py-2 pb-10">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-base/85 mb-2">Operasional</p>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight t-primary flex flex-wrap items-center gap-3">
                        <span className="inline-flex p-2 rounded-2xl bg-brand-amber/10 border border-brand-amber/25 shadow-sm" aria-hidden>
                            <FileEdit className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 text-brand-amber" />
                        </span>
                        <span>Input &amp; kendala</span>
                    </h1>
                    <p className="t-secondary text-sm mt-3 max-w-xl leading-relaxed">
                        Input pemakaian / cutting di lapangan, atau laporkan kendala QC (tanpa mengubah stok fisik).
                    </p>
                </div>
                {canKendala ? (
                    <div className="flex p-1 rounded-xl bg-[var(--bg-input)] border border-theme gap-1 shadow-sm self-start">
                        <button
                            type="button"
                            onClick={() => setSearchParams({})}
                            className={`inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'input'
                                ? 't-primary shadow-sm'
                                : 't-primary opacity-75 hover:opacity-100'
                                }`}
                            style={tab === 'input' ? { background: 'var(--bg-surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.1), inset 0 0 0 1px var(--border-glass)' } : {}}
                        >
                            <FileEdit className="w-4 h-4 shrink-0" aria-hidden />
                            Input laporan
                        </button>
                        <button
                            type="button"
                            onClick={() => setSearchParams({ tab: 'kendala' })}
                            className={`inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'kendala'
                                ? 't-primary shadow-sm'
                                : 't-primary opacity-75 hover:opacity-100'
                                }`}
                            style={tab === 'kendala' ? { background: 'var(--bg-surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.1), inset 0 0 0 1px var(--border-glass)' } : {}}
                        >
                            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden />
                            Lapor kendala
                        </button>
                    </div>
                ) : null}
            </div>

            {tab === 'input' ? (
                <InputReportDashboard userRole={userRole} embedded />
            ) : (
                <DefectsDashboard embedded />
            )}
        </div>
    );
}
