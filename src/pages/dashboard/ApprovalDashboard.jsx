import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import {
    CheckCircle2, XCircle, Package, Clock, Search, AlertTriangle, Edit3, Truck
} from 'lucide-react';

export default function ApprovalDashboard({ userRole }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedReport, setSelectedReport] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editQty, setEditQty] = useState('');
    const [editNotes, setEditNotes] = useState('');
    const [pendingReports, setPendingReports] = useState([]);
    const [stats, setStats] = useState({ criticalStock: 0, totalSuppliers: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const fetchDashboardStats = useCallback(async () => {
        try {
            const { data: itemsData } = await supabase.from('mst_items').select('stock, min_stock');
            const criticalCount = itemsData ? itemsData.filter(i => i.stock <= i.min_stock).length : 0;
            const { count: suppliersCount } = await supabase.from('mst_suppliers').select('*', { count: 'exact', head: true });
            setStats({ criticalStock: criticalCount, totalSuppliers: suppliersCount || 0 });
        } catch (error) { console.error('Error fetching stats:', error); }
    }, []);

    const fetchPendingReports = useCallback(async () => {
        setIsLoading(true);
        setErrorMsg('');
        try {
            const { data, error } = await supabase
                .from('trx_reports')
                .select(`id, type, quantity, notes, created_at, item:mst_items(name, unit), operator:profiles!trx_reports_operator_id_fkey(full_name, role)`)
                .eq('status', 'Pending')
                .order('created_at', { ascending: true });
            if (error) throw error;

            const transformedData = data.map(r => ({
                id: r.id,
                item: r.item?.name || 'Unknown',
                unit: r.item?.unit || 'qty',
                operator: r.operator ? `${r.operator.full_name} (${r.operator.role.replace('OP_', '')})` : 'Unknown',
                type: r.type,
                qty: r.quantity,
                notes: r.notes || '',
                date: new Date(r.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
            }));
            setPendingReports(transformedData);
        } catch (error) {
            console.error('Error fetching reports:', error);
            setErrorMsg(error.message);
        } finally { setIsLoading(false); }
    }, []);

    useEffect(() => {
        fetchPendingReports();
        fetchDashboardStats();
    }, [fetchPendingReports, fetchDashboardStats]);

    const handleOpenModal = (report) => {
        setSelectedReport(report);
        setEditQty(report.qty.toString());
        setEditNotes(report.notes || '');
        setErrorMsg('');
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedReport(null);
        setErrorMsg('');
    };

    const handleApprove = async () => {
        if (!selectedReport) return;
        setIsSubmitting(true);
        setErrorMsg('');
        try {
            const { data, error } = await supabase.rpc('approve_pending_report', {
                p_report_id: selectedReport.id,
                p_approved_qty: Number(editQty),
                p_notes: editNotes
            });
            if (error) throw error;
            await fetchPendingReports();
            handleCloseModal();
        } catch (error) {
            console.error('RPC Error:', error);
            setErrorMsg(error.message || 'Terjadi kesalahan saat menyetujui laporan.');
        } finally { setIsSubmitting(false); }
    };

    const handleReject = async () => {
        if (!selectedReport) return;
        setIsSubmitting(true);
        setErrorMsg('');
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const { error } = await supabase
                .from('trx_reports')
                .update({ status: 'Rejected', notes: editNotes, reviewed_by: session?.user?.id, reviewed_at: new Date() })
                .eq('id', selectedReport.id);
            if (error) throw error;
            await fetchPendingReports();
            handleCloseModal();
        } catch (error) {
            console.error('Update Error:', error);
            setErrorMsg(error.message);
        } finally { setIsSubmitting(false); }
    };

    const filteredReports = pendingReports.filter(r =>
        r.item.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.operator.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="w-full animate-in fade-in py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">

                {/* 1x1: Pending */}
                <div className="glass-card p-6 flex flex-col justify-between group cursor-default">
                    <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-brand-amber/10 rounded-2xl text-brand-amber border border-brand-amber/20 group-hover:bg-brand-amber/20 transition-colors">
                            <Clock className="w-6 h-6" />
                        </div>
                    </div>
                    <div>
                        <h3 className="t-secondary text-sm font-medium mb-1 uppercase tracking-wider">Pending Approval</h3>
                        <div className="text-4xl font-mono font-bold t-primary group-hover:text-brand-amber transition-colors">
                            {isLoading ? '...' : pendingReports.length}
                        </div>
                    </div>
                </div>

                {/* 1x1: Stok Kritis */}
                <div className="glass-card p-6 flex flex-col justify-between group cursor-default">
                    <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-brand-red/10 rounded-2xl text-brand-red border border-brand-red/20 group-hover:bg-brand-red/20 transition-colors">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                    </div>
                    <div>
                        <h3 className="t-secondary text-sm font-medium mb-1 uppercase tracking-wider">Stok Kritis</h3>
                        <div className="text-4xl font-mono font-bold t-primary group-hover:text-brand-red transition-colors">
                            {isLoading ? '...' : stats.criticalStock}
                        </div>
                    </div>
                </div>

                {/* 1x1: Total Supplier */}
                <div className="glass-card p-6 flex flex-col justify-between group cursor-default xl:col-span-2">
                    <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-400 border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors">
                            <Truck className="w-6 h-6" />
                        </div>
                        <div className="text-xs t-muted font-mono">MITRA TERDAFTAR</div>
                    </div>
                    <div>
                        <h3 className="t-secondary text-sm font-medium mb-1 uppercase tracking-wider">Total Supplier</h3>
                        <div className="text-4xl font-mono font-bold t-primary group-hover:text-blue-400 transition-colors">
                            {isLoading ? '...' : stats.totalSuppliers}
                        </div>
                    </div>
                </div>

                {/* Large Card: Approval List */}
                <div className="glass-card p-6 flex flex-col xl:col-span-4 min-h-[500px]">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight t-primary mb-2 flex items-center gap-3">Antrean Laporan</h2>
                            <p className="t-secondary text-sm">Review dan verifikasi laporan pemakaian stok dari Operator.</p>
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="relative flex-1 md:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 t-muted" />
                                <input type="text" placeholder="Cari item atau operator..."
                                    value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full border rounded-xl py-2 pl-9 pr-4 focus:outline-none focus:ring-2 focus:ring-brand-green/30 text-sm t-primary transition-all"
                                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}
                                />
                            </div>
                            <button onClick={fetchPendingReports}
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
                            <div className="w-16 h-16 rounded-full bg-brand-green/10 flex items-center justify-center mb-4 border border-brand-green/20">
                                <CheckCircle2 className="w-8 h-8 text-brand-green" />
                            </div>
                            <h3 className="text-lg font-medium t-primary mb-1">Semua Laporan Selesai</h3>
                            <p className="t-secondary text-sm max-w-sm">Tidak ada antrean laporan saat ini. {searchTerm && '(Atau filter tidak ditemukan)'}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredReports.map((report) => (
                                <div key={report.id} className="relative rounded-2xl p-5 border flex flex-col group hover:border-brand-green/30 transition-all duration-300 hover:-translate-y-1 overflow-hidden"
                                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}>
                                    <div className={`absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl opacity-20 pointer-events-none transition-opacity group-hover:opacity-40 ${report.type === 'Usage' ? 'bg-brand-green' : 'bg-brand-red'}`}></div>

                                    <div className="flex justify-between items-start mb-4 relative z-10">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform"
                                                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-glass)' }}>
                                                <Package className="w-5 h-5 t-muted group-hover:t-primary transition-colors" />
                                            </div>
                                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase tracking-widest border ${report.type === 'Usage' ? 'text-brand-green bg-brand-green/10 border-brand-green/20' : 'text-brand-red bg-brand-red/10 border-brand-red/20'}`}>
                                                {report.type === 'Usage' ? 'Pemakaian' : 'Kerusakan'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mb-4 flex-1 relative z-10">
                                        <h4 className="text-lg font-bold t-primary leading-tight mb-1 truncate" title={report.item}>{report.item}</h4>
                                        <p className="text-sm t-secondary truncate">{report.operator}</p>
                                        <div className="flex items-end gap-2 mt-4">
                                            <span className="text-xs t-muted uppercase tracking-widest select-none">Qty:</span>
                                            <span className="text-3xl font-mono font-bold t-primary group-hover:text-brand-green transition-colors">{report.qty}</span>
                                            <span className="text-sm t-muted font-normal mb-1">{report.unit}</span>
                                        </div>
                                        <div className="mt-3">
                                            <span className="text-[10px] t-muted font-mono tracking-wider">{report.date}</span>
                                        </div>
                                        {report.notes && (
                                            <div className="inline-flex items-start gap-1.5 bg-brand-red/5 border border-brand-red/10 rounded-lg p-2.5 mt-3 w-full">
                                                <AlertTriangle className="w-3.5 h-3.5 text-brand-red shrink-0 mt-0.5" />
                                                <p className="text-[11px] text-brand-red/90 leading-relaxed italic line-clamp-2" title={report.notes}>{report.notes}</p>
                                            </div>
                                        )}
                                    </div>

                                    {userRole === 'SPV' && (
                                        <div className="mt-auto relative z-10">
                                            <button onClick={() => handleOpenModal(report)}
                                                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 border font-semibold text-sm rounded-xl hover:bg-brand-green hover:text-slate-900 hover:border-brand-green active:scale-95 transition-all focus:ring-2 focus:ring-brand-green/50 t-primary"
                                                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-glass)' }}>
                                                <CheckCircle2 className="w-4 h-4" /> Review
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* === MODAL === */}
            {isModalOpen && selectedReport && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 backdrop-blur-md transition-opacity" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={handleCloseModal}></div>

                    <div className="glass-card w-full max-w-md relative z-10 animate-in zoom-in-95 duration-200 shadow-2xl">
                        <div className="p-6 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border-glass)' }}>
                            <div className="p-2 bg-brand-green/10 text-brand-green rounded-xl border border-brand-green/20">
                                <Edit3 className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold t-primary leading-tight">Review Final</h3>
                                <p className="text-xs t-muted font-mono mt-0.5">ID: {selectedReport.id.split('-')[0]}</p>
                            </div>
                        </div>

                        <div className="p-6 space-y-5">
                            {errorMsg && (
                                <div className="bg-brand-red/10 border border-brand-red/30 p-3 rounded-xl flex gap-2 items-start animate-in fade-in slide-in-from-top-2">
                                    <AlertTriangle className="w-4 h-4 text-brand-red shrink-0 mt-0.5" />
                                    <p className="text-sm text-brand-red font-medium">{errorMsg}</p>
                                </div>
                            )}

                            <div className="rounded-2xl p-5 border" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}>
                                <p className="text-sm t-secondary mb-2"><span className="t-muted inline-block w-12">Item:</span> <strong className="t-primary">{selectedReport.item}</strong></p>
                                <p className="text-sm t-secondary mb-2"><span className="t-muted inline-block w-12">Oleh:</span> <strong className="t-primary">{selectedReport.operator}</strong></p>
                                <div className="flex items-center gap-2 mt-4 pt-4" style={{ borderTop: '1px solid var(--border-glass)' }}>
                                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${selectedReport.type === 'Usage' ? 'bg-brand-green shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-brand-red shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`}></span>
                                    <p className="text-xs t-muted font-medium tracking-wide uppercase">{selectedReport.type === 'Usage' ? 'Pengajuan Pemakaian' : 'Pengajuan Kerusakan'}</p>
                                </div>
                            </div>

                            <div className="space-y-5">
                                <div>
                                    <label className="block text-xs font-semibold t-muted uppercase tracking-wider mb-2 flex items-center justify-between">
                                        Konfirmasi Jumlah
                                        <span className="text-[10px] text-brand-amber bg-brand-amber/10 px-1.5 py-0.5 rounded border border-brand-amber/20 lowercase normal-case">Dapat disesuaikan</span>
                                    </label>
                                    <div className="relative">
                                        <input type="number" value={editQty} onChange={(e) => setEditQty(e.target.value)}
                                            className="w-full border rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-brand-green/30 text-2xl font-mono t-primary focus:border-brand-green/50 transition-colors"
                                            style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 t-muted text-sm font-medium">{selectedReport.unit}</div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold t-muted uppercase tracking-wider mb-2">Catatan Final</label>
                                    <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
                                        placeholder="Tambahkan alasan menolak/revisi jumlah..."
                                        className="w-full border rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-brand-green/30 text-sm resize-none t-primary focus:border-brand-green/50 transition-colors"
                                        style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}
                                        rows={3}
                                    ></textarea>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 pt-4 flex gap-3" style={{ borderTop: '1px solid var(--border-glass)' }}>
                            <button onClick={handleReject} disabled={isSubmitting}
                                className="flex-1 py-3 px-4 rounded-xl font-medium text-brand-red hover:bg-brand-red/10 transition-all border border-transparent hover:border-brand-red/20 disabled:opacity-50 flex items-center justify-center gap-2 group"
                                style={{ background: 'var(--bg-input)' }}>
                                <XCircle className="w-4 h-4 group-hover:scale-110 transition-transform" /> Tolak
                            </button>
                            <button onClick={handleApprove} disabled={isSubmitting || !editQty || Number(editQty) < 0}
                                className="flex-[2] py-3 px-4 rounded-xl font-bold text-slate-900 bg-brand-green hover:bg-emerald-400 transition-all shadow-[0_0_20px_rgba(34,197,94,0.2)] hover:shadow-[0_0_25px_rgba(34,197,94,0.4)] disabled:opacity-50 flex items-center justify-center gap-2 group">
                                {isSubmitting ? (
                                    <span className="animate-pulse flex items-center gap-2">
                                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" fill="none" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    </span>
                                ) : (
                                    <><CheckCircle2 className="w-5 h-5 group-hover:scale-110 transition-transform" /> Setujui</>
                                )}
                            </button>
                        </div>

                        <button onClick={handleCloseModal} disabled={isSubmitting}
                            className="absolute top-4 right-4 p-1.5 t-muted hover:t-primary rounded-xl transition-colors border opacity-50 hover:opacity-100 disabled:opacity-30"
                            style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}>
                            <XCircle className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
