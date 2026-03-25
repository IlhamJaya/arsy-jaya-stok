import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { FileEdit, Search, AlertCircle, Save, CheckCircle2, History, Scissors, Trash2, X } from 'lucide-react';
import { capitalizeWords, handleNumberInput } from '../../utils/formatters.js';

export default function InputReportDashboard({ userRole }) {
    // == Shared State ==
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toastMessage, setToastMessage] = useState(null);

    // Tab: 'laporan' or 'cutting' (cutting only for OP_CUTTING)
    const [activeTab, setActiveTab] = useState(userRole === 'OP_CUTTING' ? 'cutting' : 'laporan');

    useEffect(() => {
        setActiveTab(userRole === 'OP_CUTTING' ? 'cutting' : 'laporan');
    }, [userRole]);

    // == Laporan Stok State ==
    const [items, setItems] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);
    const [recentReports, setRecentReports] = useState([]);
    const [formData, setFormData] = useState({ qty_used: '', used_note: '', qty_damage: '', damage_note: '' });

    // == Cutting Tracker State ==
    const [cuttingForm, setCuttingForm] = useState({ order_name: '', qty_cut: '', notes: '', item_id: '' });
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
    const isCuttingValid = cuttingForm.order_name.trim() !== '' && parseInt(cuttingForm.qty_cut) > 0 && cuttingForm.item_id !== '';

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
            if (qtyUsed > 0) {
                const { data, error } = await supabase.rpc('submit_report_direct', {
                    p_item_id: selectedItem.id,
                    p_type: 'Usage',
                    p_quantity: qtyUsed,
                    p_notes: formData.used_note.trim() || 'Pemakaian normal produksi'
                });
                if (error) throw error;
            }
            if (qtyDamage > 0) {
                const { data, error } = await supabase.rpc('submit_report_direct', {
                    p_item_id: selectedItem.id,
                    p_type: 'Damage',
                    p_quantity: qtyDamage,
                    p_notes: formData.damage_note
                });
                if (error) throw error;
            }
            showToast("Laporan Berhasil! Stok otomatis terpotong.");
            setFormData({ qty_used: '', used_note: '', qty_damage: '', damage_note: '' });
            setSelectedItem(null); setSearchTerm('');
            await fetchItems();
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
                notes: cuttingForm.notes.trim(),
                item_id: cuttingForm.item_id || null,
            }]);
            if (error) throw error;
            showToast("Cutting log berhasil disimpan!");
            setCuttingForm({ order_name: '', qty_cut: '', notes: '', item_id: '' });
            fetchCuttingLogs();
        } catch (error) {
            showToast("Gagal menyimpan: " + error.message, true);
        } finally { setIsSubmitting(false); }
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
                        <FileEdit className="w-8 h-8 text-accent-base" />
                        Input Laporan {userRole === 'OP_CUTTING' ? 'Cutting' : 'Penggunaan Bahan'}
                    </h2>
                    <p className="t-secondary">
                        Laporkan pemakaian material dan kerusakan. Stok akan langsung terpotong otomatis.
                    </p>
                </div>


            </div>

            {/* Toast */}
            {toastMessage && (
                <div className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-xl flex items-center gap-3 shadow-lg animate-in slide-in-from-top-5 duration-300 border ${toastMessage.isError ? 'bg-brand-red/10 border-brand-red/20 text-brand-red' : 'bg-accent-base/10 border-accent-base/20 text-accent-base'}`}>
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
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent-base/20 text-accent-base text-xs">1</span>
                                Pilih Material
                            </h3>
                            {!selectedItem ? (
                                <div className="space-y-4">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 t-muted" />
                                        <input type="text" placeholder="Cari berdasarkan nama barang..."
                                            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full bg-input border border-theme t-primary rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-accent-base/30 text-sm" />
                                    </div>
                                    <div className="max-h-[340px] overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                                        {filteredItems.map(item => {
                                            const maxStock = Math.max((item.min_stock || 10) * 4, item.stock, 50);
                                            const stockPct = Math.min((item.stock / maxStock) * 100, 100);
                                            const stockColor = item.stock <= (item.min_stock || 0) ? 'bg-brand-red' : item.stock <= ((item.min_stock || 0) * 1.5) ? 'bg-brand-amber' : 'bg-emerald-500';

                                            return (
                                                <button key={item.id} onClick={() => setSelectedItem(item)}
                                                    className="w-full text-left p-4 rounded-2xl border border-theme bg-surface hover:bg-input hover:border-accent-base/50 transition-all duration-300 group flex flex-col gap-3 relative overflow-hidden shadow-sm hover:shadow-md">
                                                    <div className="flex justify-between items-center w-full">
                                                        <div>
                                                            <p className="text-sm font-bold t-primary group-hover:text-accent-base transition-colors">{item.name}</p>
                                                            <p className="text-[11px] font-mono t-muted tracking-wide mt-0.5">{item.brand || 'No Brand'} / {item.category || '-'}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-lg font-mono font-bold t-primary">{item.stock} <span className="text-[10px] font-sans font-bold uppercase tracking-wider t-secondary">{item.unit}</span></p>
                                                        </div>
                                                    </div>
                                                    {/* Visual Stock Indicator */}
                                                    <div className="w-full h-1.5 bg-input rounded-full overflow-hidden border border-theme/50">
                                                        <div className={`h-full ${stockColor} transition-all duration-500 rounded-full`} style={{ width: `${stockPct}%` }} />
                                                    </div>
                                                </button>
                                            );
                                        })}
                                        {filteredItems.length === 0 && <p className="t-muted text-sm text-center py-8 border-2 border-dashed rounded-2xl mx-1" style={{ borderColor: 'var(--border-glass)' }}>Barang tidak ditemukan.</p>}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3 p-5 bg-surface rounded-2xl border border-accent-base/30 relative overflow-hidden shadow-md group">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-accent-base/5 rounded-full blur-3xl pointer-events-none group-hover:bg-accent-base/10 transition-colors"></div>
                                    <div className="flex items-center justify-between relative z-10">
                                        <div>
                                            <p className="text-[10px] t-secondary uppercase tracking-widest font-bold mb-1">Material Terpilih</p>
                                            <p className="text-lg font-bold text-accent-base">{selectedItem.name}</p>
                                            <p className="text-xs t-muted font-mono mt-0.5">{selectedItem.code || '-'}</p>
                                        </div>
                                        <div className="text-right flex items-center gap-3">
                                            <div className="bg-input px-3 py-2 rounded-xl border border-theme">
                                                <p className="text-[10px] t-secondary uppercase tracking-widest font-bold mb-0.5">Sisa Fisik</p>
                                                <p className="text-xl font-mono font-bold t-primary leading-none">{selectedItem.stock} <span className="text-xs font-sans font-bold t-muted uppercase">{selectedItem.unit}</span></p>
                                            </div>
                                            <button onClick={() => setSelectedItem(null)}
                                                className="p-2.5 bg-input hover:bg-brand-red/10 t-muted hover:text-brand-red rounded-xl transition-all border border-theme text-sm shadow-sm" title="Ganti Material">
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                    {/* Selected Item Stock Bar */}
                                    {(() => {
                                        const maxStock = Math.max((selectedItem.min_stock || 10) * 4, selectedItem.stock, 50);
                                        const stockPct = Math.min((selectedItem.stock / maxStock) * 100, 100);
                                        const stockColor = selectedItem.stock <= (selectedItem.min_stock || 0) ? 'bg-brand-red' : selectedItem.stock <= ((selectedItem.min_stock || 0) * 1.5) ? 'bg-brand-amber' : 'bg-emerald-500';
                                        return (
                                            <div className="w-full h-1.5 bg-input rounded-full overflow-hidden border border-theme/50 relative z-10 mt-2">
                                                <div className={`h-full ${stockColor} transition-all duration-500 rounded-full`} style={{ width: `${stockPct}%` }} />
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>

                        {/* Step 2: Input Quantities */}
                        <div className={`glass-card p-6 transition-all duration-300 ${selectedItem ? 'opacity-100 translate-y-0' : 'opacity-50 pointer-events-none translate-y-4'}`}>
                            <h3 className="text-lg font-bold t-primary mb-6 flex items-center gap-2">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent-base/20 text-accent-base text-xs">2</span>
                                Rincian Penggunaan
                            </h3>
                            <form onSubmit={handleSubmitReport} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium t-secondary mb-2">Jumlah Pemakaian Normal</label>
                                        <div className="relative">
                                            <input type="number" min="0" disabled={!selectedItem}
                                                value={formData.qty_used} onChange={(e) => setFormData({ ...formData, qty_used: handleNumberInput(e, showToast) })}
                                                className="w-full bg-input border border-accent-base/20 t-primary text-xl font-mono rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-accent-base/50 text-accent-base transition-all" placeholder="0" />
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 t-muted">{selectedItem?.unit || 'Unit'}</div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium t-secondary mb-2">Jumlah Gagal / Kerusakan</label>
                                        <div className="relative">
                                            <input type="number" min="0" disabled={!selectedItem}
                                                value={formData.qty_damage} onChange={(e) => setFormData({ ...formData, qty_damage: handleNumberInput(e, showToast) })}
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
                                            Keterangan Pemakaian Normal <span className="text-accent-base/80">* Opsional</span>
                                        </label>
                                        <textarea value={formData.used_note}
                                            onChange={(e) => setFormData({ ...formData, used_note: capitalizeWords(e.target.value) })}
                                            className="w-full bg-input border border-theme t-primary rounded-xl py-3 px-4 min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-accent-base/30 transition-all"
                                            placeholder="Contoh: Pemakaian untuk cetak nota pelanggan ABC" />
                                    </div>
                                )}

                                {qtyDamage > 0 && (
                                    <div>
                                        <label className="block text-sm font-medium text-brand-red/80 mb-2">
                                            Alasan Kerusakan <span className="text-brand-red">* Wajib</span>
                                        </label>
                                        <textarea required value={formData.damage_note}
                                            onChange={(e) => setFormData({ ...formData, damage_note: capitalizeWords(e.target.value) })}
                                            className={`w-full bg-input border t-primary rounded-xl py-3 px-4 min-h-[100px] resize-none focus:outline-none focus:ring-2 transition-all ${isNoteRequired ? 'border-brand-red/50 focus:ring-brand-red/30' : 'border-theme focus:ring-brand-red/30'}`}
                                            placeholder="Misal: Tinta mblobor, roll macet, dll..." />
                                    </div>
                                )}

                                <div className="pt-6 border-t border-theme flex justify-end">
                                    <button type="submit" disabled={!isValid || isSubmitting}
                                        className="group relative flex items-center justify-center gap-2 w-full md:w-auto px-8 py-3.5 font-bold rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden hover:shadow-[0_0_25px_rgba(6,182,212,0.4)] shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                                        style={{ backgroundColor: 'var(--color-accent-base)' }}
                                        >
                                        <div className="absolute inset-0 bg-black/10 dark:bg-white/20 group-hover:translate-x-full transition-transform duration-700 -translate-x-full skew-x-12"></div>
                                        <span className="relative z-10 flex items-center gap-2 t-on-accent text-base">
                                            {isSubmitting ? (<><div className="w-5 h-5 rounded-full border-t-2 border-r-2 t-on-accent animate-spin" /> Memproses...</>) : (<><Save className="w-5 h-5" /> Simpan & Potong Stok</>)}
                                        </span>
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
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${r.status === 'Approved' ? 'bg-accent-base/20 text-accent-base' : r.status === 'Rejected' ? 'bg-brand-red/20 text-brand-red' : 'bg-brand-amber/20 text-brand-amber'}`}>
                                                    {r.status === 'Approved' ? 'TERCATAT' : r.status === 'Rejected' ? 'DITOLAK' : 'PENDING'}
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
                                <p className="text-3xl font-mono font-bold text-accent-base">{cuttingStats.totalOrders}</p>
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
                                <Scissors className="w-5 h-5 text-accent-base" />
                                Input Cutting
                            </h3>
                            <form onSubmit={handleSubmitCutting} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium t-secondary mb-2">Nama Orderan / Stiker</label>
                                    <input type="text" required value={cuttingForm.order_name}
                                        onChange={(e) => setCuttingForm({ ...cuttingForm, order_name: capitalizeWords(e.target.value) })}
                                        className="w-full bg-input border border-theme t-primary rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-accent-base/30 text-sm"
                                        placeholder="Contoh: Stiker Logo PT ABC, Stiker Kemasan XYZ..." />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium t-secondary mb-2">
                                        Jenis Bahan <span className="text-brand-red">* Wajib</span>
                                    </label>
                                    <select
                                        required
                                        value={cuttingForm.item_id}
                                        onChange={(e) => setCuttingForm({ ...cuttingForm, item_id: e.target.value })}
                                        className="w-full bg-input border border-accent-base/20 t-primary rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-accent-base/30 text-sm cursor-pointer"
                                    >
                                        <option value="" style={{ background: 'var(--select-bg)' }}>-- Pilih Jenis Bahan --</option>
                                        {items.map(item => (
                                            <option key={item.id} value={item.id} style={{ background: 'var(--select-bg)' }}>
                                                {item.name} {item.category ? `(${item.category})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium t-secondary mb-2">Jumlah Di-Cutting</label>
                                    <div className="relative">
                                        <input type="number" min="1" required value={cuttingForm.qty_cut}
                                            onChange={(e) => setCuttingForm({ ...cuttingForm, qty_cut: handleNumberInput(e, showToast) })}
                                            className="w-full bg-input border border-accent-base/20 t-primary text-xl font-mono rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-accent-base/50 text-accent-base transition-all"
                                            placeholder="0" />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 t-muted">lembar</div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium t-secondary mb-2">Catatan (Opsional)</label>
                                    <input type="text" value={cuttingForm.notes}
                                        onChange={(e) => setCuttingForm({ ...cuttingForm, notes: capitalizeWords(e.target.value) })}
                                        className="w-full bg-input border border-theme t-primary rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-accent-base/10 text-sm"
                                        placeholder="Misal: cutting manual, mesin 2, dll..." />
                                </div>

                                <div className="pt-4 border-t border-theme flex justify-end">
                                    <button type="submit" disabled={!isCuttingValid || isSubmitting}
                                        className="flex items-center gap-2 px-8 py-3 t-on-accent font-bold rounded-xl hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(6,182,212,0.15)]"
                                        style={{ backgroundColor: 'var(--color-accent-base)' }}
                                        >
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
                                            <div className="mb-1">
                                                <p className="text-sm font-semibold t-primary truncate pr-2">{log.order_name}</p>
                                            </div>
                                            <p className="text-xs t-secondary">
                                                Jumlah: <span className="font-mono text-accent-base font-bold">{log.qty_cut}</span> lembar
                                            </p>
                                            {log.item_id && (
                                                <p className="text-[10px] text-brand-amber mt-0.5">🧴 {items.find(i => i.id === log.item_id)?.name || 'Bahan tidak ditemukan'}</p>
                                            )}
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
