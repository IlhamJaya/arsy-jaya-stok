import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import {
    CheckCircle2, Package, Clock, Search, AlertTriangle, FileText
} from 'lucide-react';

export default function ApprovalDashboard({ userRole }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('today'); // 'today' | 'history'
    const [todayReports, setTodayReports] = useState([]);
    const [historyReports, setHistoryReports] = useState([]);
    const [stats, setStats] = useState({ todayCount: 0, criticalStock: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');

    const fetchDashboardStats = useCallback(async () => {
        try {
            const { data: itemsData } = await supabase.from('mst_items').select('stock, min_stock');
            const criticalCount = itemsData ? itemsData.filter(i => i.stock <= i.min_stock).length : 0;
            setStats(prev => ({ ...prev, criticalStock: criticalCount }));
        } catch (error) { console.error('Error fetching stats:', error); }
    }, []);

    const fetchTodayReports = useCallback(async () => {
        setIsLoading(true);
        setErrorMsg('');
        try {
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const { data, error } = await supabase
                .from('trx_reports')
                .select(`id, type, quantity, status, notes, created_at, item:mst_items(name, unit), operator:profiles!trx_reports_operator_id_fkey(full_name, role)`)
                .gte('created_at', today.toISOString())
                .order('created_at', { ascending: false });
            if (error) throw error;

            const transformedData = data.map(r => ({
                id: r.id,
                item: r.item?.name || 'Unknown',
                unit: r.item?.unit || 'qty',
                operator: r.operator ? `${r.operator.full_name} (${r.operator.role.replace('OP_', '')})` : 'Unknown',
                type: r.type,
                status: r.status,
                qty: r.quantity,
                notes: r.notes || '',
                date: new Date(r.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
            }));
            setTodayReports(transformedData);
            setStats(prev => ({ ...prev, todayCount: transformedData.length }));
        } catch (error) {
            console.error('Error fetching reports:', error);
            setErrorMsg(error.message);
        } finally { setIsLoading(false); }
    }, []);

    const fetchHistoryReports = useCallback(async () => {
        setIsLoading(true);
        setErrorMsg('');
        try {
            const { data, error } = await supabase
                .from('trx_reports')
                .select(`id, type, quantity, status, notes, created_at, item:mst_items(name, unit), operator:profiles!trx_reports_operator_id_fkey(full_name, role)`)
                .order('created_at', { ascending: false })
                .limit(100);
            if (error) throw error;

            const transformedData = data.map(r => ({
                id: r.id,
                item: r.item?.name || 'Unknown',
                unit: r.item?.unit || 'qty',
                operator: r.operator ? `${r.operator.full_name} (${r.operator.role.replace('OP_', '')})` : 'Unknown',
                type: r.type,
                status: r.status,
                qty: r.quantity,
                notes: r.notes || '',
                date: new Date(r.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
            }));
            setHistoryReports(transformedData);
        } catch (error) {
            console.error('Error fetching history:', error);
            setErrorMsg(error.message);
        } finally { setIsLoading(false); }
    }, []);

    useEffect(() => {
        if (activeTab === 'today') {
            fetchTodayReports();
        } else {
            fetchHistoryReports();
        }
        fetchDashboardStats();
    }, [activeTab, fetchTodayReports, fetchHistoryReports, fetchDashboardStats]);

    const filteredReports = activeTab === 'today'
        ? todayReports.filter(r =>
            r.item.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.operator.toLowerCase().includes(searchTerm.toLowerCase())
        )
        : historyReports.filter(r =>
            r.item.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.operator.toLowerCase().includes(searchTerm.toLowerCase())
        );

    return (
        <div className="w-full animate-in fade-in py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

                {/* Compact: Laporan Hari Ini */}
                <div className="glass-card p-4 flex items-center gap-4 group cursor-default">
                    <div className="p-3 bg-accent-base/10 rounded-xl text-accent-base border border-accent-base/20 group-hover:bg-accent-base/20 transition-colors shrink-0">
                        <FileText className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="t-secondary text-xs font-semibold mb-0.5 uppercase tracking-wider">Laporan Hari Ini</h3>
                        <div className="text-2xl font-mono font-bold t-primary group-hover:text-accent-base transition-colors leading-none">
                            {isLoading ? '...' : stats.todayCount}
                        </div>
                    </div>
                </div>

                {/* Compact: Stok Kritis */}
                <div className="glass-card p-4 flex items-center gap-4 group cursor-default">
                    <div className="p-3 bg-brand-red/10 rounded-xl text-brand-red border border-brand-red/20 group-hover:bg-brand-red/20 transition-colors shrink-0">
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="t-secondary text-xs font-semibold mb-0.5 uppercase tracking-wider">Stok Kritis</h3>
                        <div className="text-2xl font-mono font-bold t-primary group-hover:text-brand-red transition-colors leading-none">
                            {isLoading ? '...' : stats.criticalStock}
                        </div>
                    </div>
                </div>
            </div>

            {/* Large Card: Report List */}
            <div className="glass-card p-6 flex flex-col xl:col-span-4 min-h-[500px]">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight t-primary mb-2 flex items-center gap-3">Riwayat Laporan</h2>
                        <p className="t-secondary text-sm">Semua laporan pemakaian & kerusakan stok yang sudah tercatat.</p>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="flex items-center p-1 bg-input border border-theme rounded-xl">
                            <button
                                onClick={() => setActiveTab('today')}
                                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'today' ? 't-primary shadow-sm' : 't-secondary hover:t-primary'}`}
                                style={activeTab === 'today' ? { background: 'var(--bg-surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.1), inset 0 0 0 1px var(--border-glass)' } : {}}
                            >
                                Hari Ini ({todayReports.length})
                            </button>
                            <button
                                onClick={() => setActiveTab('history')}
                                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'history' ? 't-primary shadow-sm' : 't-secondary hover:t-primary'}`}
                                style={activeTab === 'history' ? { background: 'var(--bg-surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.1), inset 0 0 0 1px var(--border-glass)' } : {}}
                            >
                                Semua Riwayat
                            </button>
                        </div>
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 t-muted" />
                            <input type="text" placeholder="Cari item atau operator..."
                                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full border rounded-xl py-2 pl-9 pr-4 focus:outline-none focus:ring-2 focus:ring-accent-base/30 text-sm t-primary transition-all"
                                style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}
                            />
                        </div>
                        <button onClick={activeTab === 'today' ? fetchTodayReports : fetchHistoryReports}
                            className="p-2 rounded-xl border t-muted hover:t-primary transition-colors"
                            style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }} title="Refresh">
                            <svg className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[1, 2, 3].map((index) => (
                            <div key={index} className="rounded-2xl p-5 border animate-pulse flex flex-col" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}>
                                <div className="flex gap-4 mb-4">
                                    <div className="w-12 h-12 rounded-xl" style={{ background: 'var(--bg-surface)' }} />
                                    <div className="flex-1 space-y-2 py-1">
                                        <div className="h-4 rounded w-3/4" style={{ background: 'var(--bg-surface)' }} />
                                        <div className="h-3 rounded w-1/2" style={{ background: 'var(--bg-surface)' }} />
                                    </div>
                                </div>
                                <div className="h-10 rounded-xl mt-auto" style={{ background: 'var(--bg-surface)' }} />
                            </div>
                        ))}
                    </div>
                ) : filteredReports.length === 0 ? (
                    <div className="p-12 flex flex-col items-center justify-center text-center h-full flex-1 border-2 border-dashed rounded-2xl mx-2 my-2" style={{ borderColor: 'var(--border-glass)' }}>
                        <div className="w-16 h-16 rounded-full bg-accent-base/10 flex items-center justify-center mb-4 border border-accent-base/20">
                            <CheckCircle2 className="w-8 h-8 text-accent-base" />
                        </div>
                        <h3 className="text-lg font-medium t-primary mb-1">Belum Ada Laporan</h3>
                        <p className="t-secondary text-sm max-w-sm">Belum ada laporan {activeTab === 'today' ? 'hari ini' : 'yang tercatat'}. {searchTerm && '(Atau pencarian tidak ditemukan)'}</p>
                    </div>
                ) : (
                    <div className="flex flex-col space-y-3">
                        {filteredReports.map((report) => (
                            <div key={report.id} className="relative rounded-2xl p-4 border flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:border-accent-base/30 transition-all duration-300"
                                style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}>
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                    <div className="w-12 h-12 rounded-xl border flex items-center justify-center shrink-0"
                                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-glass)' }}>
                                        <Package className="w-6 h-6 t-muted group-hover:t-primary transition-colors" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="text-base font-bold t-primary truncate" title={report.item}>{report.item}</h4>
                                            <span className={`inline-block text-[10px] font-mono px-2 py-0.5 rounded-full uppercase tracking-widest border shrink-0 ${report.type === 'Usage' ? 'text-accent-base bg-accent-base/10 border-accent-base/20' : 'text-brand-amber bg-brand-amber/10 border-brand-amber/20'}`}>
                                                {report.type === 'Usage' ? 'Pemakaian' : 'Kerusakan'}
                                            </span>
                                        </div>
                                        <p className="text-sm t-secondary truncate">{report.operator}</p>
                                        <p className="text-[10px] t-muted font-mono tracking-wider mt-1">{report.date}</p>
                                        {report.notes && (
                                            <div className="inline-flex items-start gap-1.5 bg-surface border border-theme rounded-lg p-2 mt-2 w-full max-w-md">
                                                <AlertTriangle className="w-3 h-3 t-muted shrink-0 mt-0.5" />
                                                <p className="text-[11px] t-secondary leading-relaxed italic line-clamp-2" title={report.notes}>{report.notes}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-6 justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0" style={{ borderColor: 'var(--border-glass)' }}>
                                    <div className="flex flex-col items-start md:items-end">
                                        <span className="text-[10px] t-muted uppercase tracking-widest">Status</span>
                                        <span className={`inline-block text-[11px] font-bold px-2 py-0.5 mt-0.5 rounded-lg uppercase tracking-wide border
                                            ${report.status === 'Approved' ? 'text-accent-base bg-accent-base/10 border-accent-base/20' : report.status === 'Rejected' ? 'text-brand-red bg-brand-red/10 border-brand-red/20' : 'text-brand-amber bg-brand-amber/10 border-brand-amber/20'}`}>
                                            {report.status === 'Approved' ? 'Tercatat' : report.status === 'Rejected' ? 'Ditolak' : 'Pending'}
                                        </span>
                                    </div>
                                    <div className="flex flex-col items-end text-right">
                                        <span className="text-[10px] t-muted uppercase tracking-widest">Qty</span>
                                        <div className="flex items-baseline gap-1 mt-0.5">
                                            <span className={`text-xl font-mono font-bold
                                                ${report.status === 'Approved' ? 'text-accent-base' : report.status === 'Rejected' ? 'text-brand-red line-through opacity-70' : 'text-brand-amber'}
                                            `}>
                                                {report.qty}
                                            </span>
                                            <span className="text-xs t-muted">{report.unit}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
