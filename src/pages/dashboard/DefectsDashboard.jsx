import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { AlertTriangle, Send, History, CheckCircle, FileWarning, Edit2 } from 'lucide-react';
import { capitalizeWords, handleNumberInput } from '../../utils/formatters.js';

export default function DefectsDashboard() {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    // Form State
    const [formData, setFormData] = useState({
        order_name: '',
        error_source: '',
        error_category: '',
        quantity: '',
        notes: ''
    });

    // Dropdown Data from Settings
    const [sourcesOptions, setSourcesOptions] = useState([]);
    const [categoriesOptions, setCategoriesOptions] = useState([]);

    // History Data
    // Edit Defect State (Khusus SPV)
    const [editingDefect, setEditingDefect] = useState(null);
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setIsLoading(true);
        try {
            // 0. Fetch User
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const { data: profileData } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
                setUser(profileData || session.user);
            }
            // 1. Fetch Global Settings for Dropdowns
            const { data: settingsData, error: settingsError } = await supabase
                .from('app_settings')
                .select('defect_sources, defect_categories')
                .eq('id', 1)
                .single();

            if (!settingsError && settingsData) {
                if (settingsData.defect_sources && Array.isArray(settingsData.defect_sources)) {
                    setSourcesOptions(settingsData.defect_sources);
                    if (settingsData.defect_sources.length > 0) setFormData(f => ({ ...f, error_source: settingsData.defect_sources[0] }));
                }
                if (settingsData.defect_categories && Array.isArray(settingsData.defect_categories)) {
                    setCategoriesOptions(settingsData.defect_categories);
                    if (settingsData.defect_categories.length > 0) setFormData(f => ({ ...f, error_category: settingsData.defect_categories[0] }));
                }
            }

            // 2. Fetch Recent Defects History
            await fetchHistory();

        } catch (error) {
            console.error("Error fetching initial defects data:", error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchHistory = async () => {
        try {
            const { data, error } = await supabase
                .from('trx_defects')
                .select(`
                    id, order_name, error_source, error_category, quantity, notes, created_at, status,
                    profiles!trx_defects_reporter_id_fkey(full_name)
                `)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setDefectsHistory(data || []);
        } catch (error) {
            console.error("Error fetching defect history:", error.message);
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.order_name || !formData.error_source || !formData.error_category || !formData.quantity) {
            setMessage({ type: 'error', text: 'Mohon lengkapi semua field wajib.' });
            return;
        }

        setIsSubmitting(true);
        setMessage({ type: '', text: '' });

        try {
            const { error } = await supabase.from('trx_defects').insert([
                {
                    reporter_id: user.id,
                    order_name: formData.order_name,
                    error_source: formData.error_source,
                    error_category: formData.error_category,
                    quantity: parseFloat(formData.quantity) || 0,
                    notes: formData.notes
                }
            ]);

            if (error) throw error;

            setMessage({ type: 'success', text: 'Laporan kendala berhasil dikirim!' });
            setFormData({
                order_name: '',
                error_source: sourcesOptions[0] || '',
                error_category: categoriesOptions[0] || '',
                quantity: '',
                notes: ''
            });

            // Refresh table
            fetchHistory();

            setTimeout(() => setMessage({ type: '', text: '' }), 4000);
        } catch (err) {
            console.error("Submit Defect Error:", err.message);
            setMessage({ type: 'error', text: 'Gagal mengirim laporan. ' + err.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Apakah Anda yakin ingin menghapus catatan ini? Hanya SPV yang bisa melakukan ini.")) return;
        try {
            const { error } = await supabase.from('trx_defects').delete().eq('id', id);
            if (error) throw error;
            fetchHistory();
        } catch (error) {
            alert("Gagal menghapus: " + error.message);
        }
    };

    const handleEdit = (defect) => {
        setEditingDefect({
            id: defect.id,
            order_name: defect.order_name,
            error_source: defect.error_source,
            error_category: defect.error_category,
            quantity: defect.quantity,
            notes: defect.notes || ''
        });
    };

    const handleSaveEdit = async (e) => {
        e.preventDefault();
        if (!editingDefect) return;

        setIsSavingEdit(true);
        try {
            const { error } = await supabase
                .from('trx_defects')
                .update({
                    order_name: editingDefect.order_name,
                    error_source: editingDefect.error_source,
                    error_category: editingDefect.error_category,
                    quantity: parseFloat(editingDefect.quantity) || 0,
                    notes: editingDefect.notes
                })
                .eq('id', editingDefect.id);

            if (error) throw error;

            setMessage({ type: 'success', text: 'Perubahan Laporan Kendala berhasil disimpan!' });
            setEditingDefect(null);
            fetchHistory();

            setTimeout(() => setMessage({ type: '', text: '' }), 4000);
        } catch (err) {
            console.error("Update Defect Error:", err.message);
            alert("Gagal menyimpan perubahan: " + err.message);
        } finally {
            setIsSavingEdit(false);
        }
    };

    if (isLoading) {
        return (
            <div className="w-full h-96 flex items-center justify-center">
                <div className="w-10 h-10 border-t-2 border-r-2 border-orange-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    const canManageDefects = user?.role === 'SPV';

    return (
        <div className="w-full animate-in fade-in py-2">
            <div className="mb-8">
                <h2 className="text-3xl font-bold tracking-tight t-primary mb-2 flex items-center gap-3">
                    <AlertTriangle className="w-8 h-8 text-orange-500" />
                    Lapor Kendala Produksi
                </h2>
                <p className="t-secondary">Laporkan cacat produksi, kesalahan desain, atau kegagalan sistem untuk evaluasi Quality Control tanpa mengubah stok fisik.</p>
            </div>

            {message.text && (
                <div className={`p-4 mb-6 rounded-xl flex items-start gap-3 border ${message.type === 'success' ? 'bg-accent-base/10 border-accent-base/20 text-accent-base' : 'bg-brand-red/10 border-brand-red/20 text-brand-red'}`}>
                    {message.type === 'success' ? <CheckCircle className="w-5 h-5 mt-0.5" /> : <FileWarning className="w-5 h-5 mt-0.5" />}
                    <p className="text-sm font-medium">{message.text}</p>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Form Section */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="glass-card p-6 border border-orange-500/20">
                        <h3 className="text-xl font-bold t-primary mb-6 flex items-center gap-2">
                            <FileWarning className="w-5 h-5 text-orange-400" />
                            Form Pelaporan
                        </h3>

                        {sourcesOptions.length === 0 ? (
                            <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-400 text-sm">
                                Modul Kendala belum di setup di Database. Minta Admin/SPV untuk menjalankan migration SQL.
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold t-secondary uppercase tracking-wider mb-2">Nama Orderan/Kerjaan *</label>
                                    <input type="text" required
                                        value={formData.order_name}
                                        onChange={e => setFormData({ ...formData, order_name: e.target.value })}
                                        className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 transition-all font-mono text-sm t-primary"
                                        style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}
                                        placeholder="Misal: Label Kopi Senja 100pcs"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold t-secondary uppercase tracking-wider mb-2">Pihak Terlapor (Sumber Masalah) *</label>
                                    <select required
                                        value={formData.error_source}
                                        onChange={e => setFormData({ ...formData, error_source: e.target.value })}
                                        className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 transition-all t-primary font-medium"
                                        style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}>
                                        <option value="" disabled>Pilih Pihak</option>
                                        {sourcesOptions.map((opt, i) => (
                                            <option key={`src-${i}`} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold t-secondary uppercase tracking-wider mb-2">Jenis Kendala / Kerusakan *</label>
                                    <select required
                                        value={formData.error_category}
                                        onChange={e => setFormData({ ...formData, error_category: e.target.value })}
                                        className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 transition-all t-primary font-medium"
                                        style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}>
                                        <option value="" disabled>Pilih Kendala</option>
                                        {categoriesOptions.map((opt, i) => (
                                            <option key={`cat-${i}`} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold t-secondary uppercase tracking-wider mb-2">Estimasi Lembar/Jumlah Gagal *</label>
                                    <input type="number" step="0.01" min="0" required
                                        value={formData.quantity}
                                        onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                                        className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 transition-all font-mono text-sm t-primary"
                                        style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}
                                        placeholder="0"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold t-secondary uppercase tracking-wider mb-2">Keterangan / Kronologi Singkat</label>
                                    <textarea rows="3"
                                        value={formData.notes}
                                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                        className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 transition-all font-mono text-sm t-primary resize-none"
                                        style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}
                                        placeholder="Contoh: Pisau cutting macet di tengah jalan"
                                    />
                                </div>

                                <button type="submit" disabled={isSubmitting}
                                    className="w-full mt-2 flex justify-center items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-all disabled:opacity-50">
                                    {isSubmitting ? 'Mengirim...' : <><Send className="w-4 h-4" /> Laporkan Kendala</>}
                                </button>
                            </form>
                        )}
                    </div>
                </div>

                {/* History Section */}
                <div className="lg:col-span-8">
                    <div className="glass-card p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold t-primary flex items-center gap-2">
                                <History className="w-5 h-5 text-accent-base" />
                                Riwayat Laporan Kendala
                            </h3>
                            <button onClick={fetchHistory} className="text-xs font-medium bg-accent-base/10 text-accent-base hover:bg-accent-base/20 px-3 py-1.5 rounded-lg transition-colors">
                                Refresh Data
                            </button>
                        </div>

                        <div className="table-container max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="sticky top-0 z-10" style={{ background: 'var(--bg-glass)' }}>
                                        <th className="py-4 px-4 text-xs font-bold t-secondary uppercase tracking-wider border-b border-theme">Waktu (Pelapor)</th>
                                        <th className="py-4 px-4 text-xs font-bold t-secondary uppercase tracking-wider border-b border-theme">Order / Kerjaan</th>
                                        <th className="py-4 px-4 text-xs font-bold t-secondary uppercase tracking-wider border-b border-theme">Kategori & Pihak</th>
                                        <th className="py-4 px-4 text-xs font-bold t-secondary uppercase tracking-wider border-b border-theme text-right">Qty Gagal</th>
                                        {canManageDefects && <th className="py-4 px-4 text-xs font-bold t-secondary uppercase tracking-wider border-b border-theme text-right">Aksi</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {defectsHistory.length === 0 ? (
                                        <tr>
                                            <td colSpan={canManageDefects ? 5 : 4} className="py-8 text-center t-muted text-sm">
                                                Belum ada laporan kendala.
                                            </td>
                                        </tr>
                                    ) : (
                                        defectsHistory.map((defect) => (
                                            <tr key={defect.id} className="border-b border-theme/50 hover:bg-theme-glow transition-colors">
                                                <td className="py-3 px-4">
                                                    <div className="text-sm font-medium t-primary">
                                                        {new Date(defect.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                    <div className="text-xs t-muted mt-0.5 mt-1">Oleh: {defect.profiles?.full_name || 'Unknown'}</div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="text-sm font-bold t-primary">{defect.order_name}</div>
                                                    <div className="text-xs t-muted mt-0.5 line-clamp-1">{defect.notes}</div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/10 text-orange-500 mb-1">
                                                        {defect.error_category}
                                                    </div>
                                                    <div className="text-xs t-secondary">Via: <span className="font-semibold text-brand-red">{defect.error_source}</span></div>
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <span className="text-sm font-bold t-primary bg-slate-500/10 px-2 py-1 rounded-md">{defect.quantity}</span>
                                                </td>
                                                {canManageDefects && (
                                                    <td className="py-3 px-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button onClick={() => handleEdit(defect)} className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 hover:underline px-2 py-1 rounded hover:bg-emerald-500/10 transition-colors" title="Edit Laporan">
                                                                Edit
                                                            </button>
                                                            <button onClick={() => handleDelete(defect.id)} className="text-[10px] font-bold uppercase tracking-wider text-brand-red hover:underline px-2 py-1 rounded hover:bg-brand-red/10 transition-colors" title="Hapus Laporan">
                                                                Hapus
                                                            </button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit Defect Modal (Khusus SPV) */}
            {editingDefect && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => !isSavingEdit && setEditingDefect(null)}></div>
                    <div className="glass-card w-full max-w-lg p-6 relative z-10 animate-in zoom-in-95 duration-200" style={{ border: '1px solid var(--border-glass)' }}>
                        <h3 className="text-xl font-bold t-primary mb-6 flex items-center gap-2">
                            <Edit2 className="w-5 h-5 text-emerald-500" />
                            Edit Laporan Kendala
                        </h3>

                        <form onSubmit={handleSaveEdit} className="space-y-4">
                            <p className="text-sm t-secondary mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                                Mode Edit SPV. Anda dapat merevisi detail laporan kendala ini.
                            </p>

                            <div>
                                <label className="block text-sm font-medium t-secondary mb-1">Nama Order / Project *</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-2.5 rounded-xl border"
                                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }}
                                    value={editingDefect.order_name}
                                    onChange={(e) => setEditingDefect({ ...editingDefect, order_name: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium t-secondary mb-1">Pihak Terlapor *</label>
                                    <select
                                        required
                                        className="w-full px-4 py-2.5 rounded-xl border focus:outline-none"
                                        style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }}
                                        value={editingDefect.error_source}
                                        onChange={(e) => setEditingDefect({ ...editingDefect, error_source: e.target.value })}
                                    >
                                        <option value="" disabled>Pilih Pihak</option>
                                        {sourcesOptions.map((opt, i) => (
                                            <option key={`edit-src-${i}`} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium t-secondary mb-1">Jenis Kendala *</label>
                                    <select
                                        required
                                        className="w-full px-4 py-2.5 rounded-xl border focus:outline-none"
                                        style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }}
                                        value={editingDefect.error_category}
                                        onChange={(e) => setEditingDefect({ ...editingDefect, error_category: e.target.value })}
                                    >
                                        <option value="" disabled>Pilih Kendala</option>
                                        {categoriesOptions.map((opt, i) => (
                                            <option key={`edit-cat-${i}`} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium t-secondary mb-1">Jumlah/Estimasi Gagal *</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    required
                                    className="w-full px-4 py-2.5 rounded-xl border"
                                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }}
                                    value={editingDefect.quantity}
                                    onChange={(e) => setEditingDefect({ ...editingDefect, quantity: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium t-secondary mb-1">Keterangan / Kronologi Singkat</label>
                                <textarea
                                    className="w-full px-4 py-2.5 rounded-xl border resize-none"
                                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }}
                                    rows="3"
                                    value={editingDefect.notes}
                                    onChange={(e) => setEditingDefect({ ...editingDefect, notes: e.target.value })}
                                ></textarea>
                            </div>

                            <div className="flex gap-3 justify-end pt-4 mt-6" style={{ borderTop: '1px solid var(--border-glass)' }}>
                                <button
                                    type="button"
                                    onClick={() => setEditingDefect(null)}
                                    className="px-4 py-2 text-sm font-medium rounded-xl t-secondary hover:bg-white/5 transition-colors"
                                    disabled={isSavingEdit}
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingEdit}
                                    className="px-5 py-2 text-sm font-bold text-white bg-blue-500 rounded-xl hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/25 flex items-center justify-center min-w-[120px]"
                                >
                                    {isSavingEdit ? (
                                        <div className="w-5 h-5 border-t-2 border-r-2 border-white rounded-full animate-spin"></div>
                                    ) : 'Simpan Perubahan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
