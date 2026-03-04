import React, { useState } from 'react';
import {
    Package,
    Send,
    AlertTriangle,
    History,
    CheckCircle2
} from 'lucide-react';

export default function OperatorDashboard() {
    const [formData, setFormData] = useState({
        itemId: '',
        usageQty: '',
        damageQty: '',
        notes: ''
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    // Mock data for mst_items
    const items = [
        { id: '1', name: 'Stiker Chromo A3+', category: 'Kertas', unit: 'Lembar', stock: 12500 },
        { id: '2', name: 'Stiker Vinyl Putih A3+', category: 'Kertas', unit: 'Lembar', stock: 8300 },
        { id: '3', name: 'Art Carton 260g', category: 'Kertas', unit: 'Lembar', stock: 4200 },
        { id: '4', name: 'Tinta Cyan Eco', category: 'Tinta', unit: 'Botol', stock: 12 },
    ];

    const needsReason = parseFloat(formData.damageQty) > 0;

    const handleSubmit = (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        // Simulate API delay
        setTimeout(() => {
            console.log('Submitting Reports:', formData);
            setIsSubmitting(false);
            setShowSuccess(true);

            // Reset form
            setFormData({
                itemId: '',
                usageQty: '',
                damageQty: '',
                notes: ''
            });

            // Hide success message after 3 seconds
            setTimeout(() => setShowSuccess(false), 3000);
        }, 600);
    };

    return (
        <div className="w-full max-w-2xl mx-auto pt-4 md:pt-10 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Header Profile for Mobile Context */}
            <div className="flex items-center justify-between mb-8 md:hidden glass-card p-4 mx-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center">
                        <span className="text-sm font-medium text-slate-300">OP</span>
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-slate-200 leading-tight">Budi Santoso</h3>
                        <p className="text-[11px] text-brand-green font-mono">OP_CETAK</p>
                    </div>
                </div>
                <button className="p-2 text-slate-400 hover:text-white bg-white/5 rounded-lg active:scale-95 transition-all">
                    <History className="w-5 h-5" />
                </button>
            </div>

            <div className="px-4 md:px-0">
                <header className="mb-6">
                    <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Input Pemakaian</h2>
                    <p className="text-slate-400 text-sm">Catat pemakaian atau kerusakan bahan baku shift ini.</p>
                </header>

                {showSuccess && (
                    <div className="mb-6 p-4 rounded-xl bg-brand-green/10 border border-brand-green/20 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                        <CheckCircle2 className="w-5 h-5 text-brand-green shrink-0 mt-0.5" />
                        <div>
                            <h4 className="text-sm font-medium text-brand-green">Laporan Berhasil Terkirim</h4>
                            <p className="text-xs text-brand-green/80 mt-1">Laporan masuk ke status Pending & menunggu review SPV.</p>
                        </div>
                    </div>
                )}

                {/* Main Form Card */}
                <div className="glass-card overflow-hidden">
                    <form onSubmit={handleSubmit} className="p-5 md:p-8 space-y-6">

                        {/* Item Selection */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Pilih Bahan Baku <span className="text-brand-red">*</span></label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Package className="h-5 w-5 text-slate-500 group-focus-within:text-brand-green transition-colors" />
                                </div>
                                <select
                                    required
                                    value={formData.itemId}
                                    onChange={(e) => setFormData({ ...formData, itemId: e.target.value })}
                                    className="w-full bg-slate-900/50 border border-white/10 text-white rounded-xl py-3.5 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green/50 appearance-none transition-all placeholder:text-slate-500 text-base"
                                >
                                    <option value="" disabled>-- Pilih Bahan --</option>
                                    {items.map(item => (
                                        <option key={item.id} value={item.id}>
                                            {item.name} (Sisa: {item.stock.toLocaleString('id-ID')} {item.unit})
                                        </option>
                                    ))}
                                </select>
                                {/* Custom Chevron for select */}
                                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                                    <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        {/* Quantities (Usage & Damage) */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Jumlah Pakai <span className="text-brand-red">*</span></label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="1"
                                        required
                                        placeholder="0"
                                        value={formData.usageQty}
                                        onChange={(e) => setFormData({ ...formData, usageQty: e.target.value })}
                                        className="w-full bg-slate-900/50 border border-white/10 text-white rounded-xl py-3.5 px-4 focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green/50 transition-all text-xl font-mono"
                                    />
                                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                                        <span className="text-slate-500 text-sm font-medium uppercase min-w-[30px] text-right">
                                            {formData.itemId ? items.find(i => i.id === formData.itemId)?.unit : 'Qty'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Rusak / Gagal</label>
                                <div className="relative group">
                                    <input
                                        type="number"
                                        min="0"
                                        placeholder="0"
                                        value={formData.damageQty}
                                        onChange={(e) => setFormData({ ...formData, damageQty: e.target.value })}
                                        className={`w-full bg-slate-900/50 border border-white/10 text-white rounded-xl py-3.5 px-4 focus:outline-none focus:ring-2 transition-all text-xl font-mono
                      ${parseFloat(formData.damageQty) > 0 ? 'focus:ring-brand-red/30 focus:border-brand-red/50 text-brand-red' : 'focus:ring-brand-amber/30 focus:border-brand-amber/50'}`}
                                    />
                                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                                        <span className="text-slate-500 text-sm font-medium uppercase min-w-[30px] text-right">
                                            {formData.itemId ? items.find(i => i.id === formData.itemId)?.unit : 'Qty'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Conditional Reason Field */}
                        <div className={`transition-all duration-300 overflow-hidden ${needsReason ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'}`}>
                            <label className="block text-sm font-medium font-bold text-brand-red mb-2 flex items-center gap-1.5">
                                <AlertTriangle className="w-4 h-4" /> Alasan Kerusakan <span className="text-brand-red">*</span>
                            </label>
                            <textarea
                                required={needsReason}
                                rows={2}
                                placeholder="Misal: Kertas lecek dari pabrik, mesin macet..."
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                className="w-full bg-slate-900/50 border border-brand-red/20 text-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-brand-red/30 focus:border-brand-red/50 transition-all placeholder:text-slate-500 resize-none text-sm"
                            />
                        </div>

                        {/* Submit Button */}
                        <div className="pt-4 mt-6 border-t border-white/5">
                            <button
                                type="submit"
                                disabled={isSubmitting || !formData.itemId || !formData.usageQty}
                                className="relative w-full overflow-hidden rounded-xl bg-brand-green text-slate-900 font-bold py-4 text-sm tracking-wide hover:bg-emerald-400 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed group flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? (
                                    <div className="flex items-center gap-2">
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-slate-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Memproses...
                                    </div>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                        KIRIM LAPORAN
                                    </>
                                )}
                            </button>
                        </div>

                    </form>
                </div>
            </div>
        </div>
    );
}
