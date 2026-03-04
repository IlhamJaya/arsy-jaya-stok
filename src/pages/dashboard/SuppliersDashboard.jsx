import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { Factory, Search, Plus, Phone, MessageCircle, Edit3 } from 'lucide-react';

export default function SuppliersDashboard({ userRole }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [suppliers, setSuppliers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [supplierModal, setSupplierModal] = useState({ isOpen: false, isEdit: false, data: null });
    const [supplierForm, setSupplierForm] = useState({ name: '', contact_number: '', wa_template: '', address: '' });
    const [isSaving, setIsSaving] = useState(false);
    const [formError, setFormError] = useState(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('mst_suppliers')
                .select('*')
                .order('name');
            if (error) throw error;
            setSuppliers(data);
        } catch (err) {
            console.error('Error fetching suppliers:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleOrderWA = (supplier) => {
        if (!supplier.wa_template || !supplier.contact_number) return;
        let phone = supplier.contact_number;
        if (phone.startsWith('0')) phone = '62' + phone.slice(1);
        const encodedMessage = encodeURIComponent(supplier.wa_template);
        window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank');
    };

    const openSupplierModal = (supplier = null) => {
        setFormError(null);
        if (supplier) {
            setSupplierForm({
                name: supplier.name,
                contact_number: supplier.contact_number || '',
                wa_template: supplier.wa_template || '',
                address: supplier.address || ''
            });
            setSupplierModal({ isOpen: true, isEdit: true, data: supplier });
        } else {
            setSupplierForm({ name: '', contact_number: '', wa_template: 'Halo Admin,\n\nKami ingin memesan material *[Nama Material]* sebanyak *[Jumlah]*. Mohon info stok dan ketersediaannya.\n\nTerima kasih!', address: '' });
            setSupplierModal({ isOpen: true, isEdit: false, data: null });
        }
    };

    const saveSupplier = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        setFormError(null);
        try {
            if (!supplierForm.name) throw new Error("Nama supplier wajib diisi");

            const payload = {
                name: supplierForm.name, contact_number: supplierForm.contact_number,
                wa_template: supplierForm.wa_template, address: supplierForm.address
            };

            if (supplierModal.isEdit) {
                const { error } = await supabase.from('mst_suppliers').update(payload).eq('id', supplierModal.data.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('mst_suppliers').insert([payload]);
                if (error) throw error;
            }
            setSupplierModal({ isOpen: false, isEdit: false, data: null });
            fetchData();
        } catch (err) {
            setFormError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const filteredSuppliers = suppliers.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 lg:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl lg:text-3xl font-bold tracking-tight t-primary flex items-center gap-3">
                        <Factory className="w-8 h-8 text-brand-green" /> Partner & Supplier
                    </h2>
                    <p className="t-secondary mt-1">Kelola data partner dan supplier bahan baku Anda.</p>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1 md:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 t-muted" />
                    <input
                        type="text"
                        placeholder="Cari nama supplier..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-input border border-theme t-primary rounded-xl py-2 pl-9 pr-4 focus:outline-none focus:ring-2 focus:ring-brand-green/30 text-sm placeholder:t-muted"
                    />
                </div>

                {userRole === 'SPV' && (
                    <div className="flex gap-2">
                        <button onClick={() => openSupplierModal()} className="flex items-center gap-2 px-4 py-2 bg-brand-green text-slate-900 font-medium rounded-xl hover:bg-emerald-400 transition shadow-[0_0_15px_rgba(34,197,94,0.15)]">
                            <Plus className="w-4 h-4" /> <span className="text-sm">Supplier Baru</span>
                        </button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {isLoading ? (
                    <div className="col-span-full py-12 text-center text-sm t-muted flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-brand-green border-t-transparent rounded-full animate-spin" /> Memuat data...
                    </div>
                ) : filteredSuppliers.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-sm t-muted">
                        Tidak ada supplier yang ditemukan.
                    </div>
                ) : (
                    filteredSuppliers.map(sup => (
                        <div key={sup.id} className="relative bg-input rounded-2xl p-6 border border-theme flex flex-col group hover:border-blue-500/30 transition-all hover:shadow-[0_0_20px_rgba(59,130,246,0.05)]">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500 border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors">
                                    <Factory className="w-5 h-5" />
                                </div>
                                {userRole === 'SPV' && (
                                    <button onClick={() => openSupplierModal(sup)} className="t-muted hover:text-white transition-colors" title="Edit Supplier">
                                        <Edit3 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            <h3 className="text-lg font-bold t-primary mb-1 group-hover:text-blue-500 transition-colors">{sup.name}</h3>
                            <p className="text-sm t-secondary mb-4 flex items-center gap-2">
                                <Phone className="w-3.5 h-3.5" /> {sup.contact_number || '-'}
                            </p>

                            {sup.address && (
                                <p className="text-xs t-muted mb-6 line-clamp-2 bg-input p-2 rounded-lg border border-theme">{sup.address}</p>
                            )}

                            <div className="mt-auto">
                                <button
                                    onClick={() => handleOrderWA(sup)}
                                    disabled={!sup.wa_template}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/30 hover:bg-[#25D366] hover:text-white hover:border-[#25D366] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <MessageCircle className="w-4 h-4" /> Order via WhatsApp
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {supplierModal.isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => !isSaving && setSupplierModal({ isOpen: false })}></div>
                    <div className="glass-card w-full max-w-lg p-6 relative z-10 animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-bold t-primary mb-6 flex items-center gap-2">
                            <Factory className="w-5 h-5 text-brand-green" />
                            {supplierModal.isEdit ? 'Update Supplier' : 'Tambah Supplier Baru'}
                        </h3>

                        <form onSubmit={saveSupplier} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold t-secondary uppercase tracking-wider mb-2">Nama Supplier/Partner *</label>
                                <input
                                    type="text" required
                                    value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                                    className="w-full bg-input border border-theme t-primary rounded-xl px-4 py-2.5 focus:border-brand-green focus:ring-1 focus:ring-brand-green/30"
                                    placeholder="PT Maju Mundur"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold t-secondary uppercase tracking-wider mb-2">No. WhatsApp</label>
                                <input
                                    type="text"
                                    value={supplierForm.contact_number} onChange={(e) => setSupplierForm({ ...supplierForm, contact_number: e.target.value })}
                                    className="w-full bg-input border border-theme t-primary rounded-xl px-4 py-2.5 focus:border-brand-green focus:ring-1 focus:ring-brand-green/30"
                                    placeholder="Contoh: 0812345678"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold t-secondary uppercase tracking-wider mb-2">Alamat (Opsional)</label>
                                <textarea
                                    value={supplierForm.address} onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                                    className="w-full bg-input border border-theme t-primary rounded-xl px-4 py-2.5 focus:border-brand-green focus:ring-1 focus:ring-brand-green/30 min-h-[80px]"
                                    placeholder="Alamat lengkap supplier..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold t-secondary uppercase tracking-wider mb-2">Template Order WhatsApp</label>
                                <textarea
                                    required
                                    value={supplierForm.wa_template} onChange={(e) => setSupplierForm({ ...supplierForm, wa_template: e.target.value })}
                                    className="w-full bg-input border border-theme t-primary rounded-xl px-4 py-2.5 focus:border-brand-green focus:ring-1 focus:ring-brand-green/30 min-h-[120px] font-mono text-sm leading-relaxed"
                                />
                                <p className="text-[10px] t-muted mt-2 leading-relaxed">Pesan ini akan dikirim saat Anda klik tombol 'Order via WhatsApp'.</p>
                            </div>

                            {formError && (
                                <div className="p-3 bg-brand-red/10 border border-brand-red/20 rounded-lg text-xs text-brand-red mt-4">{formError}</div>
                            )}

                            <div className="flex justify-end gap-3 pt-4 border-t border-theme mt-6">
                                <button type="button" onClick={() => setSupplierModal({ isOpen: false })} disabled={isSaving} className="px-4 py-2 text-sm font-medium t-secondary hover:text-white transition-colors">Batal</button>
                                <button type="submit" disabled={isSaving} className="px-6 py-2 bg-brand-green text-slate-900 font-bold rounded-xl hover:bg-emerald-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                    {isSaving ? 'Menyimpan...' : 'Simpan Supplier'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
