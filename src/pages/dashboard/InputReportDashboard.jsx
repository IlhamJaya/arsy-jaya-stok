import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { FileEdit, Search, AlertCircle, Save, CheckCircle2, History, Scissors, Trash2 } from 'lucide-react';

export default function InputReportDashboard({ userRole }) {
    // == Shared State ==
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toastMessage, setToastMessage] = useState(null);

    // Tab: 'laporan' or 'cutting' (cutting only for OP_CUTTING)
    const [activeTab, setActiveTab] = useState('laporan');

    // == Laporan Stok State ==
    const [items, setItems] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);
    const [recentReports, setRecentReports] = useState([]);
    const [formData, setFormData] = useState({ qty_used: '', used_note: '', qty_damage: '', damage_note: '' });

    // == Cutting Tracker State ==
    const [cuttingForm, setCuttingForm] = useState({ order_name: '', qty_cut: '', notes: '' });
    const [cuttingLogs, setCuttingLogs] = useState([]);
    const [cuttingStats, setCuttingStats] = useState({ totalOrders: 0, totalCut: 0 });

    // Validations for Laporan
    const qtyUsed = parseInt(formData.qty_used) || 0;
    const qtyDamage = parseInt(formData.qty_damage) || 0;
    const totalQty = qtyUsed + qtyDamage;
    const isOverStock = selectedItem && (totalQty > selectedItem.stock);
    const isNoteRequired = qtyDamage > 0 && formData.damage_note.trim() === '';
    const isValid = selectedItem && !isOverStock && !isNoteRequired && totalQty > 0;

    // Cutting form validation
    const isCuttingValid = cuttingForm.order_name.trim() !== '' && parseInt(cuttingForm.qty_cut) > 0;

    const showToast = (message, isError = false) => {
        setToastMessage({ text: message, isError });
        setTimeout(() => setToastMessage(null), 3000);
    };

    // == Data Fetching ==
    const fetchItems = async () => {
        try {
            const { data, error } = await supabase.from('mst_items').select('*').order('name');
            if (error) throw error;
            setItems(data);
        } catch (error) { console.error("Error fetching items:", error); }
    };

    const fetchRecentReports = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const { data, error } = await supabase.from('trx_reports')
                .select('id, type, quantity, status, created_at, item:mst_items(name, unit)')
                .eq('operator_id', session.user.id)
                .gte('created_at', today.toISOString())
                .order('created_at', { ascending: false }).limit(10);
            if (error) throw error;
            setRecentReports(data);
        } catch (error) { console.error("Error fetching recent reports:", error); }
    };

    const fetchCuttingLogs = useCallback(async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const { data, error } = await supabase.from('trx_cutting_log')
                .select('*')
                .eq('operator_id', session.user.id)
                .gte('created_at', today.toISOString())
                .order('created_at', { ascending: false });
            if (error) throw error;
            setCuttingLogs(data || []);
            const totalOrders = (data || []).length;
            const totalCut = (data || []).reduce((sum, l) => sum + l.qty_cut, 0);
            setCuttingStats({ totalOrders, totalCut });
        } catch (error) { console.error("Error fetching cutting logs:", error); }
    }, []);

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            await Promise.all([fetchItems(), fetchRecentReports()]);
            if (userRole === 'OP_CUTTING') await fetchCuttingLogs();
            setIsLoading(false);
        };
        load();
    }, [userRole, fetchCuttingLogs]);

    // == Handlers ==
    const handleSubmitReport = async (e) => {
        e.preventDefault();
        if (!isValid) return;
        setIsSubmitting(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (qtyUsed > 0) {
                const { error } = await supabase.from('trx_reports').insert([{
                    item_id: selectedItem.id, operator_id: session.user.id,
                    type: 'Usage', quantity: qtyUsed, notes: formData.used_note.trim() || 'Pemakaian normal produksi', status: 'Pending'
                }]);
                if (error) throw error;
            }
            if (qtyDamage > 0) {
                const { error } = await supabase.from('trx_reports').insert([{
                    item_id: selectedItem.id, operator_id: session.user.id,
                    type: 'Damage', quantity: qtyDamage, notes: formData.damage_note, status: 'Pending'
                }]);
                if (error) throw error;
            }
            showToast("Laporan Berhasil Disimpan!");
            setFormData({ qty_used: '', used_note: '', qty_damage: '', damage_note: '' });
            setSelectedItem(null); setSearchTerm('');
            fetchRecentReports();
        } catch (error) {
            showToast("Gagal menyimpan laporan: " + error.message, true);
        } finally { setIsSubmitting(false); }
    };

    const handleSubmitCutting = async (e) => {
        e.preventDefault();
        if (!isCuttingValid) return;
        setIsSubmitting(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const { error } = await supabase.from('trx_cutting_log').insert([{
                operator_id: session.user.id,
                order_name: cuttingForm.order_name.trim(),
                qty_cut: parseInt(cuttingForm.qty_cut),
                notes: cuttingForm.notes.trim()
            }]);
            if (error) throw error;
            showToast("Cutting log berhasil disimpan!");
            setCuttingForm({ order_name: '', qty_cut: '', notes: '' });
            fetchCuttingLogs();
        } catch (error) {
            showToast("Gagal menyimpan: " + error.message, true);
        } finally { setIsSubmitting(false); }
    };

    const handleDeleteCutting = async (id) => {
        if (!confirm('Hapus log cutting ini?')) return;
        try {
            const { error } = await supabase.from('trx_cutting_log').delete().eq('id', id);
            if (error) throw error;
            showToast("Log dihapus.");
            fetchCuttingLogs();
        } catch (error) { showToast("Gagal menghapus: " + error.message, true); }
    };

    const filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.code?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="w-full animate-in fade-in py-2">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight t-primary mb-2 flex items-center gap-3">
                        <FileEdit className="w-8 h-8 text-brand-green" />
                        Input Laporan {userRole === 'OP_CUTTING' ? 'Cutting' : 'Penggunaan Bahan'}
                    </h2>
                    <p className="t-secondary">
                        Laporkan pemakaian material dan kerusakan. Stok belum terpotong sampai di-Approve SPV.
                    </p>
                </div>

                {/* Tab switcher (only for OP_CUTTING) */}
                {userRole === 'OP_CUTTING' && (
                    <div className="flex items-center gap-2 p-1 bg-input rounded-xl border border-theme w-fit">
                        <button onClick={() => setActiveTab('laporan')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'laporan'
                                ? 'bg-slate-700 t-primary shadow-sm' : 't-secondary hover:t-primary hover:bg-white/5'}`}>
                            Laporan Stok
                        </button>
                        <button onClick={() => setActiveTab('cutting')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'cutting'
                                ? 'bg-slate-700 t-primary shadow-sm' : 't-secondary hover:t-primary hover:bg-white/5'}`}>
                            <Scissors className="w-4 h-4" /> Tracking Cutting
                        </button>
                    </div>
                )}
            </div>

            {/* Toast */}
            {toastMessage && (
                <div className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-xl flex items-center gap-3 shadow-lg animate-in slide-in-from-top-5 duration-300 border ${toastMessage.isError ? 'bg-brand-red/10 border-brand-red/20 text-brand-red' : 'bg-brand-green/10 border-brand-green/20 text-brand-green'}`}>
                    {toastMessage.isError ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                    <p className="font-semibold text-sm">{toastMessage.text}</p>
                </div>
            )}

            {/* ===== TAB: LAPORAN STOK ===== */}
            {activeTab === 'laporan' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        {/* Step 1: Item Selection */}
                        <div className="glass-card p-6">
                            <h3 className="text-lg font-bold t-primary mb-4 flex items-center gap-2">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-green/20 text-brand-green text-xs">1</span>
                                Pilih Material
                            </h3>
                            {!selectedItem ? (
                                <div className="space-y-4">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 t-muted" />
                                        <input type="text" placeholder="Cari berdasarkan nama barang..."
                                            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full bg-input border border-theme t-primary rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-brand-green/30 text-sm" />
                                    </div>
                                    <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                                        {filteredItems.map(item => (
                                            <button key={item.id} onClick={() => setSelectedItem(item)}
                                                className="w-full text-left p-3 rounded-xl border border-theme bg-input hover:border-brand-green/50 transition-all group flex justify-between items-center">
                                                <div>
                                                    <p className="text-sm font-semibold t-primary group-hover:text-brand-green transition-colors">{item.name}</p>
                                                    <p className="text-xs t-muted">{item.brand || 'No Brand'} / {item.category || 'No Category'}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-lg font-mono font-bold t-primary">{item.stock} <span className="text-xs t-secondary">{item.unit}</span></p>
                                                </div>
                                            </button>
                                        ))}
                                        {filteredItems.length === 0 && <p className="t-muted text-sm text-center py-4">Barang tidak ditemukan.</p>}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between p-4 bg-input rounded-xl border border-brand-green/30">
                                    <div>
                                        <p className="text-xs t-secondary uppercase tracking-wider mb-1">Material Terpilih</p>
                                        <p className="text-base font-bold text-brand-green">{selectedItem.name}</p>
                                    </div>
                                    <div className="text-right flex items-center gap-4">
                                        <div>
                                            <p className="text-xs t-secondary uppercase tracking-wider mb-1">Sisa Stok</p>
                                            <p className="text-xl font-mono font-bold t-primary">{selectedItem.stock} <span className="text-sm font-sans font-normal t-muted">{selectedItem.unit}</span></p>
                                        </div>
                                        <button onClick={() => setSelectedItem(null)}
                                            className="px-4 py-2 ml-4 bg-surface hover:bg-input t-primary font-bold rounded-xl transition-all border border-theme text-sm">
                                            Ganti
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Step 2: Input Quantities */}
                        <div className={`glass-card p-6 transition-all duration-300 ${selectedItem ? 'opacity-100 translate-y-0' : 'opacity-50 pointer-events-none translate-y-4'}`}>
                            <h3 className="text-lg font-bold t-primary mb-6 flex items-center gap-2">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-green/20 text-brand-green text-xs">2</span>
                                Rincian Penggunaan
                            </h3>
                            <form onSubmit={handleSubmitReport} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium t-secondary mb-2">Jumlah Pemakaian Normal</label>
                                        <div className="relative">
                                            <input type="number" min="0" disabled={!selectedItem}
                                                value={formData.qty_used} onChange={(e) => setFormData({ ...formData, qty_used: e.target.value })}
                                                className="w-full bg-input border border-brand-green/20 t-primary text-xl font-mono rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-brand-green/50 text-brand-green transition-all" placeholder="0" />
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 t-muted">{selectedItem?.unit || 'Unit'}</div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium t-secondary mb-2">Jumlah Gagal / Kerusakan</label>
                                        <div className="relative">
                                            <input type="number" min="0" disabled={!selectedItem}
                                                value={formData.qty_damage} onChange={(e) => setFormData({ ...formData, qty_damage: e.target.value })}
                                                className={`w-full bg-input border t-primary text-xl font-mono rounded-xl py-3 px-4 focus:outline-none focus:ring-2 transition-all ${qtyDamage > 0 ? 'border-brand-red/50 focus:ring-brand-red/50 text-brand-red' : 'border-theme focus:ring-slate-500'}`} placeholder="0" />
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 t-muted">{selectedItem?.unit || 'Unit'}</div>
                                        </div>
                                    </div>
                                </div>

                                {isOverStock && (
                                    <div className="p-3 bg-brand-red/10 border border-brand-red/20 rounded-lg flex items-start gap-2 mt-6">
                                        <AlertCircle className="w-5 h-5 text-brand-red shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-bold text-brand-red">Total Melebihi Stok!</p>
                                            <p className="text-xs text-brand-red/80">Total: {totalQty}. Stok: {selectedItem.stock}.</p>
                                        </div>
                                    </div>
                                )}

                                {qtyUsed > 0 && (
                                    <div className="mt-6">
                                        <label className="block text-sm font-medium t-secondary mb-2">
                                            Keterangan Pemakaian Normal <span className="text-brand-green/80">* Opsional</span>
                                        </label>
                                        <textarea value={formData.used_note}
                                            onChange={(e) => setFormData({ ...formData, used_note: e.target.value })}
                                            className="w-full bg-input border border-theme t-primary rounded-xl py-3 px-4 min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-brand-green/30 transition-all"
                                            placeholder="Contoh: Pemakaian untuk cetak nota pelanggan ABC" />
                                    </div>
                                )}

                                {qtyDamage > 0 && (
                                    <div>
                                        <label className="block text-sm font-medium text-brand-red/80 mb-2">
                                            Alasan Kerusakan <span className="text-brand-red">* Wajib</span>
                                        </label>
                                        <textarea required value={formData.damage_note}
                                            onChange={(e) => setFormData({ ...formData, damage_note: e.target.value })}
                                            className={`w-full bg-input border t-primary rounded-xl py-3 px-4 min-h-[100px] resize-none focus:outline-none focus:ring-2 transition-all ${isNoteRequired ? 'border-brand-red/50 focus:ring-brand-red/30' : 'border-theme focus:ring-brand-red/30'}`}
                                            placeholder="Misal: Tinta mblobor, roll macet, dll..." />
                                    </div>
                                )}

                                <div className="pt-4 border-t border-theme flex justify-end">
                                    <button type="submit" disabled={!isValid || isSubmitting}
                                        className="flex items-center gap-2 px-8 py-3 bg-brand-green text-slate-900 font-bold rounded-xl hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(6,182,212,0.15)]">
                                        {isSubmitting ? (<><div className="w-5 h-5 rounded-full border-t-2 border-r-2 border-slate-900 animate-spin" /> Mengirim...</>) : (<><Save className="w-5 h-5" /> Kirim ke Supervisor</>)}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* History Sidebar */}
                    <div className="lg:col-span-1">
                        <div className="glass-card p-6 h-full">
                            <h3 className="text-md font-bold t-primary mb-6 flex items-center gap-2">
                                <History className="w-5 h-5 t-secondary" /> Riwayat Laporan Hari Ini
                            </h3>
                            {isLoading ? (
                                <div className="space-y-4">{[1, 2, 3].map(i => (<div key={i} className="animate-pulse"><div className="h-12 bg-surface rounded-lg" /></div>))}</div>
                            ) : recentReports.length === 0 ? (
                                <div className="text-center py-10 opacity-50">
                                    <FileEdit className="w-10 h-10 mx-auto t-muted mb-3" />
                                    <p className="text-sm t-secondary">Belum ada laporan hari ini.</p>
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                                    {recentReports.map(r => (
                                        <div key={r.id} className="bg-input p-3 rounded-lg border border-theme">
                                            <div className="flex justify-between items-start mb-1">
                                                <p className="text-sm font-semibold t-primary truncate pr-2">{r.item?.name || 'Unknown'}</p>
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${r.status === 'Approved' ? 'bg-brand-green/20 text-brand-green' : r.status === 'Rejected' ? 'bg-brand-red/20 text-brand-red' : 'bg-brand-amber/20 text-brand-amber'}`}>
                                                    {r.status.toUpperCase()}
                                                </span>
                                            </div>
                                            <p className="text-xs t-secondary">
                                                {r.type === 'Usage' ? 'Terpakai' : 'Gagal'}: <span className="font-mono t-primary">{r.quantity} {r.item?.unit}</span>
                                            </p>
                                            <p className="text-[10px] t-muted">{new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ===== TAB: TRACKING CUTTING (OP_CUTTING only) ===== */}
            {activeTab === 'cutting' && userRole === 'OP_CUTTING' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Form + Stats */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="glass-card p-5">
                                <p className="text-xs t-muted uppercase tracking-wider mb-1">Total Orderan Hari Ini</p>
                                <p className="text-3xl font-mono font-bold text-brand-green">{cuttingStats.totalOrders}</p>
                                <p className="text-xs t-secondary mt-1">orderan stiker</p>
                            </div>
                            <div className="glass-card p-5">
                                <p className="text-xs t-muted uppercase tracking-wider mb-1">Total Stiker Di-Cut</p>
                                <p className="text-3xl font-mono font-bold text-brand-amber">{cuttingStats.totalCut}</p>
                                <p className="text-xs t-secondary mt-1">lembar stiker</p>
                            </div>
                        </div>

                        {/* Input Form */}
                        <div className="glass-card p-6">
                            <h3 className="text-lg font-bold t-primary mb-6 flex items-center gap-2">
                                <Scissors className="w-5 h-5 text-brand-green" />
                                Input Cutting
                            </h3>
                            <form onSubmit={handleSubmitCutting} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium t-secondary mb-2">Nama Orderan / Stiker</label>
                                    <input type="text" required value={cuttingForm.order_name}
                                        onChange={(e) => setCuttingForm({ ...cuttingForm, order_name: e.target.value })}
                                        className="w-full bg-input border border-theme t-primary rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-brand-green/30 text-sm"
                                        placeholder="Contoh: Stiker Logo PT ABC, Stiker Kemasan XYZ..." />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium t-secondary mb-2">Jumlah Di-Cutting</label>
                                    <div className="relative">
                                        <input type="number" min="1" required value={cuttingForm.qty_cut}
                                            onChange={(e) => setCuttingForm({ ...cuttingForm, qty_cut: e.target.value })}
                                            className="w-full bg-input border border-brand-green/20 t-primary text-xl font-mono rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-brand-green/50 text-brand-green transition-all"
                                            placeholder="0" />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 t-muted">lembar</div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium t-secondary mb-2">Catatan (Opsional)</label>
                                    <input type="text" value={cuttingForm.notes}
                                        onChange={(e) => setCuttingForm({ ...cuttingForm, notes: e.target.value })}
                                        className="w-full bg-input border border-theme t-primary rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-brand-green/10 text-sm"
                                        placeholder="Misal: cutting manual, mesin 2, dll..." />
                                </div>

                                <div className="pt-4 border-t border-theme flex justify-end">
                                    <button type="submit" disabled={!isCuttingValid || isSubmitting}
                                        className="flex items-center gap-2 px-8 py-3 bg-brand-green text-slate-900 font-bold rounded-xl hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(6,182,212,0.15)]">
                                        {isSubmitting ? (<><div className="w-5 h-5 rounded-full border-t-2 border-r-2 border-slate-900 animate-spin" /> Menyimpan...</>) : (<><Scissors className="w-5 h-5" /> Simpan Cutting</>)}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* Cutting History Sidebar */}
                    <div className="lg:col-span-1">
                        <div className="glass-card p-6 h-full">
                            <h3 className="text-md font-bold t-primary mb-6 flex items-center gap-2">
                                <History className="w-5 h-5 t-secondary" /> Log Cutting Hari Ini
                            </h3>

                            {cuttingLogs.length === 0 ? (
                                <div className="text-center py-10 opacity-50">
                                    <Scissors className="w-10 h-10 mx-auto t-muted mb-3" />
                                    <p className="text-sm t-secondary">Belum ada cutting tercatat hari ini.</p>
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                                    {cuttingLogs.map(log => (
                                        <div key={log.id} className="bg-input p-3 rounded-lg border border-theme group">
                                            <div className="flex justify-between items-start mb-1">
                                                <p className="text-sm font-semibold t-primary truncate pr-2">{log.order_name}</p>
                                                <button onClick={() => handleDeleteCutting(log.id)}
                                                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-brand-red/10 text-brand-red transition-all"
                                                    title="Hapus">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                            <p className="text-xs t-secondary">
                                                Jumlah: <span className="font-mono text-brand-green font-bold">{log.qty_cut}</span> lembar
                                            </p>
                                            {log.notes && <p className="text-[10px] t-muted mt-1">📝 {log.notes}</p>}
                                            <p className="text-[10px] t-muted mt-1">{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
