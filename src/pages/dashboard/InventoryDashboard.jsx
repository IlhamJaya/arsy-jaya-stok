
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import {
    Package, Search, Plus, Upload, Filter, Link,
    AlertTriangle, CheckCircle2, Factory, Phone,
    MessageCircle, FileEdit, Edit3
} from 'lucide-react';

export default function InventoryDashboard({ userRole }) {
    const [activeTab, setActiveTab] = useState('inventory'); // 'inventory' | 'suppliers' | 'stock_in'
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Semua');

    // Data States
    const [items, setItems] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Stats
    const [stats, setStats] = useState({ total: 0, critical: 0, healthy: 0 });

    // Modal States
    const [itemModal, setItemModal] = useState({ isOpen: false, isEdit: false, data: null });
    const [supplierModal, setSupplierModal] = useState({ isOpen: false, isEdit: false, data: null });
    const [isSaving, setIsSaving] = useState(false);

    // Form States
    const [itemForm, setItemForm] = useState({ name: '', brand: '', category: '', stock: 0, min_stock: 0, unit: 'Lembar' });
    const [supplierForm, setSupplierForm] = useState({ name: '', contact_number: '', wa_template: '', address: '' });
    const [stockInForm, setStockInForm] = useState({ item_id: '', quantity: '', notes: '' });
    const [formError, setFormError] = useState(null);
    const [stockInSuccess, setStockInSuccess] = useState(false);

    // Audit Modal States
    const [auditModalItem, setAuditModalItem] = useState(null);
    const [isAuditing, setIsAuditing] = useState(false);
    const [auditError, setAuditError] = useState(null);

    // Fetch Data
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            if (activeTab === 'inventory') {
                const { data, error } = await supabase
                    .from('mst_items')
                    .select('*')
                    .order('name');

                if (error) throw error;

                // Transform logic for UI
                const transformedItems = data.map(item => {
                    const isCritical = item.stock <= item.min_stock;
                    return {
                        id: item.id,
                        code: `#ITM - ${item.id.substring(0, 4).toUpperCase()} `,
                        name: item.name,
                        brand: item.brand,
                        category: item.category,
                        stock: item.stock,
                        minStock: item.min_stock,
                        unit: item.unit,
                        isCritical
                    };
                });

                setItems(transformedItems);

                // Calc
                const criticalCount = transformedItems.filter(i => i.isCritical).length;
                setStats({
                    total: transformedItems.length,
                    critical: criticalCount,
                    healthy: transformedItems.length - criticalCount
                });

            } else {
                const { data, error } = await supabase
                    .from('mst_suppliers')
                    .select('*')
                    .order('name');

                if (error) throw error;
                setSuppliers(data);
            }
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setIsLoading(false);
        }
    }, [activeTab]);

    const handleAuditStock = async (itemId, actualStock, notes) => {
        setIsAuditing(true);
        setAuditError(null);
        try {
            const parsedStock = parseFloat(actualStock);
            if (isNaN(parsedStock) || parsedStock < 0) {
                throw new Error('Masukkan angka stok yang valid (lebih dari atau sama dengan 0)');
            }

            if (parsedStock === auditModalItem.item.stock && !notes.trim()) {
                // Silently ignore if no change and no explicit note
                setAuditModalItem(null);
                return;
            }

            const { data, error } = await supabase.rpc('audit_physical_stock', {
                p_item_id: itemId,
                p_actual_qty: parsedStock,
                p_notes: notes.trim() === '' ? 'Audit Manual' : notes
            });

            if (error) {
                // Check custom exception
                if (error.message.includes('Forbidden')) {
                    throw new Error('Hanya Supervisor yang diizinkan melakukan audit stok');
                }
                throw error;
            }

            // Success
            setAuditModalItem(null);
            fetchData(); // Refresh UI
        } catch (err) {
            console.error('Audit Error:', err);
            setAuditError(err.message);
        } finally {
            setIsAuditing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // WA Helper
    const handleOrderWA = (supplier) => {
        if (!supplier.wa_template || !supplier.contact_number) return;

        // Clean phone number (simple)
        let phone = supplier.contact_number;
        if (phone.startsWith('0')) phone = '62' + phone.slice(1);

        const encodedMessage = encodeURIComponent(supplier.wa_template);
        window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank');
    };

    const categories = ['Semua', ...Array.from(new Set(items.map(i => i.category).filter(Boolean))).sort()];

    const filteredItems = items.filter(i => {
        const matchSearch =
            i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (i.brand || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchCategory = selectedCategory === 'Semua' || i.category === selectedCategory;
        return matchSearch && matchCategory;
    });

    const filteredSuppliers = suppliers.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // --- CRUD Handlers ---
    const openItemModal = (item = null) => {
        setFormError(null);
        if (item) {
            setItemForm({
                name: item.name, brand: item.brand, category: item.category,
                stock: item.stock, min_stock: item.minStock, unit: item.unit
            });
            setItemModal({ isOpen: true, isEdit: true, data: item });
        } else {
            setItemForm({ name: '', brand: '', category: '', stock: 0, min_stock: 0, unit: 'Lembar' });
            setItemModal({ isOpen: true, isEdit: false, data: null });
        }
    };

    const saveItem = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        setFormError(null);
        try {
            if (!itemForm.name) throw new Error("Nama barang wajib diisi");

            const payload = {
                name: itemForm.name, brand: itemForm.brand, category: itemForm.category,
                stock: parseInt(itemForm.stock), min_stock: parseInt(itemForm.min_stock), unit: itemForm.unit
            };

            if (itemModal.isEdit) {
                const { error } = await supabase.from('mst_items').update(payload).eq('id', itemModal.data.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('mst_items').insert([payload]);
                if (error) throw error;
            }
            setItemModal({ isOpen: false, isEdit: false, data: null });
            fetchData();
        } catch (err) {
            setFormError(err.message);
        } finally {
            setIsSaving(false);
        }
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

    const handleStockInSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        setFormError(null);
        setStockInSuccess(false);

        try {
            if (!stockInForm.item_id) throw new Error("Pilih barang terlebih dahulu");
            const parsedQty = parseFloat(stockInForm.quantity);
            if (isNaN(parsedQty) || parsedQty <= 0) throw new Error("Jumlah stok masuk harus lebih dari 0");

            const { data, error } = await supabase.rpc('add_incoming_stock', {
                p_item_id: stockInForm.item_id,
                p_incoming_qty: parsedQty,
                p_notes: stockInForm.notes.trim() || 'Restock'
            });

            if (error) throw error;

            setStockInSuccess(true);
            setStockInForm({ item_id: '', quantity: '', notes: '' });
            fetchData(); // Refresh UI in background

            setTimeout(() => setStockInSuccess(false), 3000);
        } catch (err) {
            setFormError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="w-full animate-in fade-in py-2">

            {/* Header & Tabs */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight t-primary mb-2 flex items-center gap-3">
                        <Package className="w-8 h-8 text-brand-green" />
                        Inventory & Suplai
                    </h2>
                    <p className="t-secondary">Kelola master data barang, cek ketersediaan stok, dan hubungi supplier.</p>
                </div>

                <div className="flex items-center gap-2 p-1 bg-input rounded-xl border border-theme w-fit">
                    <button
                        onClick={() => setActiveTab('inventory')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'inventory'
                            ? 'bg-slate-700 t-primary shadow-sm'
                            : 't-secondary hover:t-primary hover:bg-white/5'
                            }`}
                    >
                        Data Master & Stok
                    </button>
                    {(userRole === 'SPV' || userRole === 'SALES') && (
                        <button
                            onClick={() => { setActiveTab('stock_in'); setStockInSuccess(false); setFormError(null); }}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'stock_in'
                                ? 'bg-slate-700 t-primary shadow-sm'
                                : 't-secondary hover:t-primary hover:bg-white/5'
                                }`}
                        >
                            Stok Masuk
                        </button>
                    )}
                    <button
                        onClick={() => setActiveTab('suppliers')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'suppliers'
                            ? 'bg-slate-700 t-primary shadow-sm'
                            : 't-secondary hover:t-primary hover:bg-white/5'
                            }`}
                    >
                        Partner & Supplier
                    </button>
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                {activeTab !== 'stock_in' && (
                    <div className="relative flex-1 md:max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 t-muted" />
                        <input
                            type="text"
                            placeholder={`Cari ${activeTab === 'inventory' ? 'barang atau brand' : 'nama supplier'}...`}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-input border border-theme t-primary rounded-xl py-2 pl-9 pr-4 focus:outline-none focus:ring-2 focus:ring-brand-green/30 text-sm placeholder:t-muted"
                        />
                    </div>
                )}

                {userRole === 'SPV' && activeTab === 'inventory' && (
                    <div className="flex gap-2">
                        <button onClick={() => openItemModal()} className="flex items-center gap-2 px-4 py-2 bg-brand-green text-slate-900 font-medium rounded-xl hover:bg-emerald-400 transition shadow-[0_0_15px_rgba(34,197,94,0.15)]">
                            <Plus className="w-4 h-4" /> <span className="text-sm">Item Baru</span>
                        </button>
                    </div>
                )}

                {userRole === 'SPV' && activeTab === 'suppliers' && (
                    <div className="flex gap-2">
                        <button onClick={() => openSupplierModal()} className="flex items-center gap-2 px-4 py-2 bg-brand-green text-slate-900 font-medium rounded-xl hover:bg-emerald-400 transition shadow-[0_0_15px_rgba(34,197,94,0.15)]">
                            <Plus className="w-4 h-4" /> <span className="text-sm">Supplier Baru</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Category Filter Pills - Hanya tampil di tab Inventory */}
            {activeTab === 'inventory' && categories.length > 1 && (
                <div className="flex flex-wrap gap-2 mb-6">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 ${selectedCategory === cat
                                    ? 'bg-brand-green text-slate-900 border-brand-green shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                                    : 'bg-transparent t-muted border-theme hover:border-brand-green hover:t-primary'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            )}

            {/* INVENTORY VIEW */}
            {activeTab === 'inventory' && (
                <div className="space-y-6">
                    {/* Bento Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div className="glass-card p-6 flex flex-col justify-between group cursor-default">
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-3 bg-slate-500/10 rounded-2xl t-secondary border border-slate-500/20 group-hover:bg-slate-500/20 transition-colors">
                                    <Package className="w-5 h-5" />
                                </div>
                            </div>
                            <div>
                                <h3 className="t-secondary text-sm font-medium mb-1 uppercase tracking-wider">Total Item Aktif</h3>
                                <div className="text-4xl font-mono font-bold t-primary group-hover:t-secondary transition-colors">
                                    {stats.total}
                                </div>
                            </div>
                        </div>
                        <div className="glass-card p-6 flex flex-col justify-between group cursor-default">
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-3 bg-brand-green/10 rounded-2xl text-brand-green border border-brand-green/20 group-hover:bg-brand-green/20 transition-colors">
                                    <CheckCircle2 className="w-5 h-5" />
                                </div>
                            </div>
                            <div>
                                <h3 className="t-secondary text-sm font-medium mb-1 uppercase tracking-wider">Stok Aman</h3>
                                <div className="text-4xl font-mono font-bold t-primary group-hover:text-brand-green transition-colors">
                                    {stats.healthy}
                                </div>
                            </div>
                        </div>
                        <div className="glass-card p-6 flex flex-col justify-between group cursor-default">
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-3 bg-brand-red/10 rounded-2xl text-brand-red border border-brand-red/20 group-hover:bg-brand-red/20 transition-colors">
                                    <AlertTriangle className="w-5 h-5" />
                                </div>
                            </div>
                            <div>
                                <h3 className="t-secondary text-sm font-medium mb-1 uppercase tracking-wider">Stok Kritis</h3>
                                <div className="text-4xl font-mono font-bold t-primary group-hover:text-brand-red transition-colors flex items-end gap-2">
                                    {stats.critical} <span className="text-sm font-sans font-normal text-brand-red/70 mb-1">butuh re-order</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bento Grid layout for Items */}
                    <div className="glass-card xl:col-span-3 min-h-[500px] p-6 lg:col-span-full">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold t-primary flex items-center gap-2">
                                <Package className="w-5 h-5 text-brand-green" /> Katalog Barang
                            </h3>
                        </div>

                        {isLoading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {[1, 2, 3, 4, 5, 6].map((index) => (
                                    <div key={index} className="bg-input rounded-2xl p-5 border border-theme animate-pulse flex flex-col">
                                        <div className="flex gap-4 mb-4">
                                            <div className="w-12 h-12 bg-input rounded-xl" />
                                            <div className="flex-1 space-y-2 py-1">
                                                <div className="h-4 bg-input rounded w-3/4" />
                                                <div className="h-3 bg-input rounded w-1/2" />
                                            </div>
                                        </div>
                                        <div className="h-10 bg-input rounded-xl mt-auto" />
                                    </div>
                                ))}
                            </div>
                        ) : filteredItems.length === 0 ? (
                            <div className="p-12 flex flex-col items-center justify-center text-center h-full border-2 border-dashed border-theme rounded-2xl">
                                <div className="w-16 h-16 rounded-full bg-input flex items-center justify-center mb-4 border border-theme">
                                    <Package className="w-8 h-8 text-slate-600" />
                                </div>
                                <h3 className="text-lg font-medium t-primary mb-1">Belum Ada Item</h3>
                                <p className="t-secondary text-sm max-w-sm">Tambahkan barang ke sistem atau coba cari dengan kata kunci lain.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {filteredItems.map(item => (
                                    <div key={item.id} className="relative bg-input rounded-2xl p-5 border border-theme flex flex-col group hover:border-brand-green/30 transition-all duration-300 hover:shadow-[0_0_20px_rgba(34,197,94,0.05)] hover:-translate-y-1">
                                        {item.isCritical && (
                                            <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full bg-brand-red/10 blur-xl opacity-50 pointer-events-none"></div>
                                        )}

                                        <div className="flex justify-between items-start mb-4 relative z-10">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-input border border-theme flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                                    <Package className="w-5 h-5 t-secondary group-hover:text-white transition-colors" />
                                                </div>
                                                <div>
                                                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase tracking-widest border
                                                        ${item.isCritical ? 'text-brand-red bg-brand-red/10 border-brand-red/20' : 'text-brand-green bg-brand-green/10 border-brand-green/20'}`}>
                                                        {item.isCritical ? 'Kritis' : 'Aman'}
                                                    </span>
                                                </div>
                                            </div>
                                            {userRole === 'SPV' && (
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => openItemModal(item)}
                                                        className="p-1.5 t-muted hover:text-white bg-input hover:bg-slate-700 rounded-lg transition-colors border border-theme"
                                                        title="Edit Data Item"
                                                    >
                                                        <Edit3 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => setAuditModalItem({ item, actualStock: item.stock.toString(), notes: '' })}
                                                        className="p-1.5 t-muted hover:text-white bg-input hover:bg-slate-700 rounded-lg transition-colors border border-theme"
                                                        title="Audit Fisik (SPV Only)"
                                                    >
                                                        <FileEdit className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="mb-4 flex-1 relative z-10">
                                            <h4 className="text-lg font-bold t-primary leading-tight mb-1 truncate" title={item.name}>{item.name}</h4>
                                            <p className="text-sm t-secondary truncate">{item.category || '-'} {item.brand ? `• ${item.brand}` : ''}</p>

                                            <div className="flex items-end gap-2 mt-4">
                                                <span className="text-xs t-muted uppercase tracking-widest select-none">Stok Fisik:</span>
                                                <span className={`text-3xl font-mono font-bold transition-colors ${item.isCritical ? 'text-brand-red' : 'text-white group-hover:text-brand-green'}`}>
                                                    {item.stock}
                                                </span>
                                                <span className="text-sm t-muted font-normal mb-1">{item.unit}</span>
                                            </div>
                                            <p className="text-[10px] t-muted font-mono mt-1">CODE: {item.code.replace(' ', '')} | MIN: {item.minStock}</p>
                                        </div>

                                        {item.isCritical && (
                                            <div className="mt-auto relative z-10 bg-brand-red/10 border border-brand-red/20 rounded-xl p-2.5 flex items-center justify-center gap-2">
                                                <AlertTriangle className="w-4 h-4 text-brand-red" />
                                                <span className="text-xs font-semibold text-brand-red">Butuh Re-order (Min: {item.minStock})</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* SUPPLIERS VIEW */}
            {activeTab === 'suppliers' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {isLoading ? (
                        <>
                            {[1, 2, 3].map(index => (
                                <div key={index} className="glass-card p-6 flex flex-col">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="w-12 h-12 rounded-xl bg-input animate-pulse shrink-0"></div>
                                        <div className="w-6 h-6 rounded bg-input animate-pulse"></div>
                                    </div>
                                    <div className="h-5 w-3/4 bg-surface rounded animate-pulse mb-3"></div>
                                    <div className="h-4 w-1/2 bg-surface rounded animate-pulse mb-6"></div>

                                    <div className="space-y-2 mb-6">
                                        <div className="h-3 w-full bg-surface rounded animate-pulse"></div>
                                        <div className="h-3 w-5/6 bg-surface rounded animate-pulse"></div>
                                    </div>

                                    <div className="mt-auto">
                                        <div className="h-10 w-full bg-input rounded-xl animate-pulse"></div>
                                    </div>
                                </div>
                            ))}
                        </>
                    ) : filteredSuppliers.length === 0 ? (
                        <div className="col-span-full glass-card p-12 flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 rounded-full bg-input flex items-center justify-center mb-4 border border-theme">
                                <Factory className="w-8 h-8 text-slate-600" />
                            </div>
                            <h3 className="text-lg font-medium t-primary mb-1">Belum Ada Supplier</h3>
                            <p className="t-secondary text-sm max-w-sm">Data partner atau supplier tidak ditemukan. Coba hapus filter pencarian.</p>
                        </div>
                    ) : (
                        filteredSuppliers.map(sup => (
                            <div key={sup.id} className="glass-card p-6 flex flex-col group hover:shadow-lg hover:shadow-brand-green/5 transition-all">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="w-12 h-12 rounded-xl bg-input border border-theme flex items-center justify-center shrink-0">
                                        <Factory className="w-6 h-6 t-secondary" />
                                    </div>
                                    {userRole === 'SPV' && (
                                        <button onClick={() => openSupplierModal(sup)} className="t-muted hover:text-white transition-colors" title="Edit Supplier">
                                            <Edit3 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                <h3 className="text-lg font-bold t-primary mb-1 group-hover:text-brand-green transition-colors">{sup.name}</h3>
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
            )}

            {/* STOK MASUK VIEW */}
            {activeTab === 'stock_in' && (userRole === 'SPV' || userRole === 'SALES') && (
                <div className="max-w-2xl mx-auto">
                    <div className="glass-card p-6 md:p-8">
                        <div className="flex items-center gap-4 mb-6 pb-4 border-b border-theme">
                            <div className="w-12 h-12 rounded-xl bg-brand-green/20 border border-brand-green/30 flex items-center justify-center shrink-0">
                                <Package className="w-6 h-6 text-brand-green relative z-10" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold  t-primary">Form Stok Masuk</h3>
                                <p className="text-sm t-secondary">Restock atau penambahan barang ke gudang.</p>
                            </div>
                        </div>

                        <form onSubmit={handleStockInSubmit} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium t-secondary mb-2">Pilih Barang</label>
                                <select
                                    required
                                    value={stockInForm.item_id}
                                    onChange={(e) => setStockInForm({ ...stockInForm, item_id: e.target.value })}
                                    className="w-full bg-input border border-theme t-primary rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-green/50 appearance-none"
                                >
                                    <option value="" disabled>-- Pilih Barang --</option>
                                    {items.map(item => (
                                        <option key={item.id} value={item.id}>
                                            {item.name} {item.brand ? `(${item.brand})` : ''} - Stok Saat Ini: {item.stock} {item.unit}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium t-secondary mb-2">Jumlah Masuk</label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="number"
                                        required
                                        min="0.1"
                                        step="any"
                                        value={stockInForm.quantity}
                                        onChange={(e) => setStockInForm({ ...stockInForm, quantity: e.target.value })}
                                        placeholder="0"
                                        className="w-full bg-input border border-theme t-primary font-mono text-lg rounded-xl px-4 py-3 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green/30"
                                    />
                                    <span className="t-muted font-medium px-2">
                                        {stockInForm.item_id ? items.find(i => i.id === stockInForm.item_id)?.unit || 'Unit' : 'Unit'}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium t-secondary mb-2">Catatan Pemasok / Referensi (Opsional)</label>
                                <textarea
                                    value={stockInForm.notes}
                                    onChange={(e) => setStockInForm({ ...stockInForm, notes: e.target.value })}
                                    placeholder="Contoh: No. PO / Nama Supplier / Keterangan Lainnya"
                                    className="w-full bg-input border border-theme t-primary text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green/30 min-h-[80px] resize-none"
                                ></textarea>
                            </div>

                            {formError && (
                                <div className="p-3 bg-brand-red/10 border border-brand-red/20 rounded-lg flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 text-brand-red shrink-0 mt-0.5" />
                                    <p className="text-sm text-brand-red/90">{formError}</p>
                                </div>
                            )}

                            {stockInSuccess && (
                                <div className="p-3 bg-brand-green/10 border border-brand-green/20 rounded-lg flex items-start gap-2 animate-in slide-in-from-top-2">
                                    <CheckCircle2 className="w-4 h-4 text-brand-green shrink-0 mt-0.5" />
                                    <p className="text-sm text-brand-green/90">Stok berhasil ditambahkan!</p>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isSaving || !stockInForm.item_id}
                                className="w-full py-3.5 mt-2 bg-brand-green text-slate-900 font-bold rounded-xl hover:bg-emerald-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(34,197,94,0.15)] flex justify-center items-center gap-2"
                            >
                                {isSaving ? (
                                    <>
                                        <div className="w-5 h-5 rounded-full border-t-2 border-r-2 border-slate-900 animate-spin"></div>
                                        Menyimpan...
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-5 h-5" />
                                        Simpan Stok Masuk
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Audit Modal */}
            {auditModalItem && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setAuditModalItem(null)}></div>

                    <div className="glass-card w-full max-w-md p-6 relative z-10 animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-bold t-primary mb-2">Audit Stok Fisik</h3>
                        <p className="text-sm t-secondary mb-6">
                            Sesuaikan jumlah stok untuk <span className="text-brand-green font-medium">{auditModalItem.item.name}</span> jika ada selisih dengan kenyataan.
                        </p>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-xs font-semibold t-secondary uppercase tracking-wider mb-2">Stok Sistem Saat Ini</label>
                                <div className="flex items-center gap-3 p-3 bg-input rounded-xl border border-theme">
                                    <Package className="w-5 h-5 t-muted" />
                                    <span className="text-xl font-mono  t-primary">{auditModalItem.item.stock}</span>
                                    <span className="text-sm t-muted">{auditModalItem.item.unit}</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-brand-amber uppercase tracking-wider mb-2">Stok Fisik Aktual</label>
                                <input
                                    type="number"
                                    value={auditModalItem.actualStock}
                                    onChange={(e) => setAuditModalItem({ ...auditModalItem, actualStock: e.target.value })}
                                    className="w-full bg-input border border-brand-amber/30 t-primary font-mono text-lg rounded-xl px-4 py-3 focus:outline-none focus:border-brand-amber focus:ring-1 focus:ring-brand-amber/50"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold t-secondary uppercase tracking-wider mb-2">Catatan Audit</label>
                                <textarea
                                    value={auditModalItem.notes}
                                    onChange={(e) => setAuditModalItem({ ...auditModalItem, notes: e.target.value })}
                                    placeholder="Misal: Stok susut karena rusak / salah hitung bulan lalu"
                                    className="w-full bg-input border border-theme t-primary text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green/30 min-h-[80px] resize-none"
                                ></textarea>
                            </div>

                            {auditError && (
                                <div className="p-3 bg-brand-red/10 border border-brand-red/20 rounded-lg flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 text-brand-red shrink-0 mt-0.5" />
                                    <p className="text-xs text-brand-red/90">{auditError}</p>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-theme">
                            <button
                                onClick={() => setAuditModalItem(null)}
                                disabled={isAuditing}
                                className="px-4 py-2 text-sm font-medium t-secondary hover:text-white transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                onClick={() => handleAuditStock(auditModalItem.item.id, auditModalItem.actualStock, auditModalItem.notes)}
                                disabled={isAuditing || (parseFloat(auditModalItem.actualStock) === auditModalItem.item.stock && auditModalItem.notes.trim() === '')}
                                className="flex items-center gap-2 px-5 py-2 bg-brand-amber text-slate-900 font-bold rounded-xl hover:bg-yellow-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                            >
                                {isAuditing ? (
                                    <>
                                        <div className="w-4 h-4 rounded-full border-t-2 border-r-2 border-slate-900 animate-spin"></div>
                                        Memproses...
                                    </>
                                ) : (
                                    <>Simpan Perubahan</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ITEM MODAL */}
            {itemModal.isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => !isSaving && setItemModal({ isOpen: false })}></div>
                    <div className="glass-card w-full max-w-lg p-6 relative z-10 animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-bold t-primary mb-6 flex items-center gap-2">
                            <Package className="w-5 h-5 text-brand-green" />
                            {itemModal.isEdit ? 'Update Data Item' : 'Tambah Item Baru'}
                        </h3>

                        <form onSubmit={saveItem} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-xs font-semibold t-secondary uppercase tracking-wider mb-2">Nama Barang *</label>
                                    <input
                                        type="text" required
                                        value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                                        className="w-full bg-input border border-theme t-primary rounded-xl px-4 py-2 focus:border-brand-green focus:ring-1 focus:ring-brand-green/30"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold t-secondary uppercase tracking-wider mb-2">Merek / Brand</label>
                                    <input
                                        type="text"
                                        value={itemForm.brand} onChange={(e) => setItemForm({ ...itemForm, brand: e.target.value })}
                                        className="w-full bg-input border border-theme t-primary rounded-xl px-4 py-2 focus:border-brand-green focus:ring-1 focus:ring-brand-green/30"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold t-secondary uppercase tracking-wider mb-2">Kategori</label>
                                    <input
                                        type="text"
                                        value={itemForm.category} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                                        className="w-full bg-input border border-theme t-primary rounded-xl px-4 py-2 focus:border-brand-green focus:ring-1 focus:ring-brand-green/30"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold t-secondary uppercase tracking-wider mb-2">Stok Baru</label>
                                    <input
                                        type="number" min="0" required
                                        value={itemForm.stock} onChange={(e) => setItemForm({ ...itemForm, stock: e.target.value })}
                                        className="w-full bg-input border border-theme t-primary rounded-xl px-4 py-2 focus:border-brand-green focus:ring-1 focus:ring-brand-green/30"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold t-secondary uppercase tracking-wider mb-2">Batas Minimum Kritis</label>
                                    <input
                                        type="number" min="0" required
                                        value={itemForm.min_stock} onChange={(e) => setItemForm({ ...itemForm, min_stock: e.target.value })}
                                        className="w-full bg-input border border-theme t-primary rounded-xl px-4 py-2 focus:border-brand-green focus:ring-1 focus:ring-brand-green/30"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-semibold t-secondary uppercase tracking-wider mb-2">Satuan (Unit)</label>
                                    <select
                                        value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                                        className="w-full bg-input border border-theme t-primary rounded-xl px-4 py-2 focus:border-brand-green focus:ring-1 focus:ring-brand-green/30"
                                    >
                                        <option value="Lembar">Lembar</option>
                                        <option value="Pcs">Pcs</option>
                                        <option value="Roll">Roll</option>
                                        <option value="Box">Box</option>
                                    </select>
                                </div>
                            </div>

                            {formError && (
                                <div className="p-3 bg-brand-red/10 border border-brand-red/20 rounded-lg text-xs text-brand-red mt-4">{formError}</div>
                            )}

                            <div className="flex justify-end gap-3 pt-4 border-t border-theme mt-6">
                                <button type="button" onClick={() => setItemModal({ isOpen: false })} disabled={isSaving} className="px-4 py-2 text-sm font-medium t-secondary hover:text-white transition-colors">Batal</button>
                                <button type="submit" disabled={isSaving} className="px-6 py-2 bg-brand-green text-slate-900 font-bold rounded-xl hover:bg-emerald-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                    {isSaving ? 'Menyimpan...' : 'Simpan Data'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* SUPPLIER MODAL */}
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
                                    className="w-full bg-input border border-theme t-primary rounded-xl px-4 py-2 focus:border-brand-green focus:ring-1 focus:ring-brand-green/30"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold t-secondary uppercase tracking-wider mb-2">Telepon / WhatsApp</label>
                                <input
                                    type="text"
                                    value={supplierForm.contact_number} onChange={(e) => setSupplierForm({ ...supplierForm, contact_number: e.target.value })}
                                    placeholder="Contoh: 628123456789 (Gunakan 62)"
                                    className="w-full bg-input border border-theme t-primary rounded-xl px-4 py-2 focus:border-brand-green focus:ring-1 focus:ring-brand-green/30"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold t-secondary uppercase tracking-wider mb-2">Template Pesan WA</label>
                                <textarea
                                    value={supplierForm.wa_template} onChange={(e) => setSupplierForm({ ...supplierForm, wa_template: e.target.value })}
                                    placeholder="Isi custom pesan WhatsApp default disini..."
                                    className="w-full bg-input border border-theme t-primary text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green/30 min-h-[100px] resize-none"
                                ></textarea>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold t-secondary uppercase tracking-wider mb-2">Alamat Lengkap</label>
                                <textarea
                                    value={supplierForm.address} onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                                    className="w-full bg-input border border-theme t-primary text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green/30 min-h-[80px] resize-none"
                                ></textarea>
                            </div>

                            {formError && (
                                <div className="p-3 bg-brand-red/10 border border-brand-red/20 rounded-lg text-xs text-brand-red mt-4">{formError}</div>
                            )}

                            <div className="flex justify-end gap-3 pt-4 border-t border-theme mt-6">
                                <button type="button" onClick={() => setSupplierModal({ isOpen: false })} disabled={isSaving} className="px-4 py-2 text-sm font-medium t-secondary hover:text-white transition-colors">Batal</button>
                                <button type="submit" disabled={isSaving} className="px-6 py-2 bg-brand-green text-slate-900 font-bold rounded-xl hover:bg-emerald-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                    {isSaving ? 'Menyimpan...' : 'Simpan Data'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}
