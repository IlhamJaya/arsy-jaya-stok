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
        } catch (error) {
            console.error("Error fetching initial defects data:", error.message);
        } finally {
            setIsLoading(false);
        }
    };

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

            setTimeout(() => setMessage({ type: '', text: '' }), 4000);
        } catch (err) {
            console.error("Submit Defect Error:", err.message);
            setMessage({ type: 'error', text: 'Gagal mengirim laporan. ' + err.message });
        } finally {
            setIsSubmitting(false);
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

            <div className="flex justify-center flex-1 w-full min-h-[50vh]">
                {/* Form Section */}
                <div className="w-full max-w-2xl space-y-6">
                    <div className="glass-card p-8 border border-orange-500/20 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-3xl pointer-events-none"></div>
                        <h3 className="text-xl font-bold t-primary mb-6 flex items-center gap-2 relative z-10">
                            <FileWarning className="w-5 h-5 text-orange-400" />
                            Form Pelaporan Kendala
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
            </div>
        </div>
    );
}
