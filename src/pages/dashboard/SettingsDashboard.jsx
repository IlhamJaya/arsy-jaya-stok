import React, { useState, useEffect } from 'react';
import { Settings, Save, Smartphone, BellRing, MessageSquare, AlertTriangle } from 'lucide-react';
import { supabase } from '../../supabaseClient';

export default function SettingsDashboard() {
    const [settings, setSettings] = useState({
        wa_threshold: 10,
        spv_wa_number: '628159440003',
        spv_wa_group: '',
        wa_template_damage: '',
        wa_template_usage: '',
        wa_template_stockin: '',
        wa_template_cutting: '',
        wa_template_defect: '',
        wa_template_restock_usage: '',
        defect_sources: '',
        defect_categories: ''
    });

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [hasTemplateCols, setHasTemplateCols] = useState(true);
    const [hasDefectCols, setHasDefectCols] = useState(false);
    const [hasDefectTemplate, setHasDefectTemplate] = useState(false);
    const [hasRestockTemplate, setHasRestockTemplate] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.from('app_settings').select('*').eq('id', 1).single();
            if (error) throw error;
            if (data) {
                const templatesExist = 'wa_template_damage' in data;
                const defectsExist = 'defect_sources' in data;
                const defectTemplateExists = 'wa_template_defect' in data;
                const restockTemplateExists = 'wa_template_restock_usage' in data;

                setHasTemplateCols(templatesExist);
                setHasDefectCols(defectsExist);
                setHasDefectTemplate(defectTemplateExists);
                setHasRestockTemplate(restockTemplateExists);

                setSettings({
                    wa_threshold: data.wa_threshold,
                    spv_wa_number: data.spv_wa_number,
                    spv_wa_group: 'spv_wa_group' in data ? (data.spv_wa_group || '') : '',
                    wa_template_damage: templatesExist ? (data.wa_template_damage || '') : '',
                    wa_template_usage: templatesExist ? (data.wa_template_usage || '') : '',
                    wa_template_stockin: templatesExist ? (data.wa_template_stockin || '') : '',
                    wa_template_cutting: templatesExist ? (data.wa_template_cutting || '') : '',
                    wa_template_defect: defectTemplateExists ? (data.wa_template_defect || '') : '',
                    wa_template_restock_usage: restockTemplateExists ? (data.wa_template_restock_usage || '') : '',
                    defect_sources: defectsExist && Array.isArray(data.defect_sources) ? data.defect_sources.join(', ') : '',
                    defect_categories: defectsExist && Array.isArray(data.defect_categories) ? data.defect_categories.join(', ') : ''
                });
            }
        } catch (err) {
            console.error("Error fetching settings:", err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveSettings = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        setMessage({ type: '', text: '' });

        try {
            const payload = {
                wa_threshold: settings.wa_threshold,
                spv_wa_number: settings.spv_wa_number
            };

            // Attach group WA if the column exists in data state
            if ('spv_wa_group' in settings) {
                payload.spv_wa_group = settings.spv_wa_group;
            }

            if (hasTemplateCols) {
                payload.wa_template_damage = settings.wa_template_damage;
                payload.wa_template_usage = settings.wa_template_usage;
                payload.wa_template_stockin = settings.wa_template_stockin;
                payload.wa_template_cutting = settings.wa_template_cutting;
            }

            if (hasRestockTemplate) {
                payload.wa_template_restock_usage = settings.wa_template_restock_usage;
            }

            if (hasDefectTemplate) {
                payload.wa_template_defect = settings.wa_template_defect;
            }

            if (hasDefectCols) {
                payload.defect_sources = settings.defect_sources.split(',').map(s => s.trim()).filter(Boolean);
                payload.defect_categories = settings.defect_categories.split(',').map(s => s.trim()).filter(Boolean);
            }

            const { error } = await supabase
                .from('app_settings')
                .update(payload)
                .eq('id', 1);

            if (error) throw error;

            setMessage({ type: 'success', text: 'Pengaturan berhasil disimpan!' });
            setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        } catch (err) {
            console.error("Error saving settings:", err.message);
            setMessage({ type: 'error', text: 'Gagal menyimpan: ' + err.message });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="w-full h-96 flex items-center justify-center">
                <div className="w-10 h-10 border-t-2 border-r-2 border-accent-base rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="w-full animate-in fade-in py-2">
            <div className="mb-8">
                <h2 className="text-3xl font-bold tracking-tight t-primary mb-2 flex items-center gap-3">
                    <Settings className="w-8 h-8 t-secondary" />
                    Pengaturan Sistem
                </h2>
                <p className="t-secondary">Konfigurasi notifikasi WhatsApp dan template laporan.</p>
            </div>

            {message.text && (
                <div className={`p-4 mb-6 rounded-xl flex items-start gap-3 border ${message.type === 'success'
                    ? 'bg-accent-base/10 border-accent-base/20 text-accent-base'
                    : 'bg-brand-red/10 border-brand-red/20 text-brand-red'
                    }`}>
                    <BellRing className="w-5 h-5 shrink-0 mt-0.5" />
                    <p className="text-sm font-medium">{message.text}</p>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* LEFT: Main Settings Form */}
                <div className="glass-card p-6 md:p-8">
                    <form onSubmit={handleSaveSettings} className="space-y-8">

                        {/* WhatsApp Section */}
                        <div>
                            <h3 className="text-xl font-bold t-primary mb-6 flex items-center gap-2">
                                <Smartphone className="w-5 h-5 text-accent-base" />
                                Konfigurasi WhatsApp API
                            </h3>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-xs font-semibold t-secondary uppercase tracking-wider mb-2">WhatsApp Alert Threshold</label>
                                    <p className="text-xs t-muted mb-3">Batas jumlah kerusakan sebelum notifikasi dikirim otomatis.</p>
                                    <input type="number" min="1" required
                                        value={settings.wa_threshold}
                                        onChange={(e) => setSettings({ ...settings, wa_threshold: parseInt(e.target.value) })}
                                        className="w-full max-w-xs border rounded-xl px-4 py-3 focus:outline-none focus:border-accent-base focus:ring-1 focus:ring-accent-base/50 transition-all font-mono t-primary"
                                        style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold t-secondary uppercase tracking-wider mb-2">Nomor Target SPV</label>
                                        <p className="text-[10px] t-muted mb-3 block h-8">Format angka negara (6281...)</p>
                                        <input type="text"
                                            value={settings.spv_wa_number}
                                            onChange={(e) => setSettings({ ...settings, spv_wa_number: e.target.value })}
                                            className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-accent-base focus:ring-1 focus:ring-accent-base/50 transition-all font-mono t-primary"
                                            style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}
                                            placeholder="6281..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold t-secondary uppercase tracking-wider mb-2">ID Grup (Opsional)</label>
                                        <p className="text-[10px] t-muted mb-3 block h-8">Contoh: 12036...430@g.us</p>
                                        <input type="text"
                                            value={settings.spv_wa_group}
                                            onChange={(e) => setSettings({ ...settings, spv_wa_group: e.target.value })}
                                            className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-accent-base focus:ring-1 focus:ring-accent-base/50 transition-all font-mono t-primary"
                                            style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}
                                            placeholder="Kosongkan jika tidak ada"
                                        />
                                    </div>
                                </div>
                                <p className="text-xs t-muted border-l-2 border-accent-base pl-3 mt-4">
                                    Notifikasi akan dikirimkan ke <b>Nomor SPV</b> dan <b>Grup WhatsApp</b> secara bersamaan jika keduanya diisi.
                                </p>
                            </div>
                        </div>

                        {/* Defect Settings Section */}
                        <div className="pt-6" style={{ borderTop: '1px solid var(--border-glass)' }}>
                            <h3 className="text-xl font-bold text-orange-400 mb-6 flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-orange-400" />
                                Kategori Laporan Kendala
                            </h3>
                            {!hasDefectCols && (
                                <div className="p-3 mb-4 bg-brand-amber/10 border border-brand-amber/20 rounded-lg text-sm text-brand-amber text-left">
                                    Update schema database untuk membuka fitur ini (jalankan add_defects.sql).
                                </div>
                            )}
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-xs font-semibold t-secondary uppercase tracking-wider mb-2">Pihak Terlapor / Terdakwa</label>
                                    <p className="text-xs t-muted mb-3">Pisahkan dengan koma. Contoh: Admin, Desainer, Operator</p>
                                    <textarea rows="2"
                                        value={settings.defect_sources}
                                        onChange={(e) => setSettings({ ...settings, defect_sources: e.target.value })}
                                        disabled={!hasDefectCols}
                                        className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/50 transition-all font-mono t-primary disabled:opacity-50 text-sm"
                                        style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold t-secondary uppercase tracking-wider mb-2">Pilihan Kategori Kendala</label>
                                    <p className="text-xs t-muted mb-3">Pisahkan dengan koma. Contoh: Salah Bahan, Gagal Mesin</p>
                                    <textarea rows="3"
                                        value={settings.defect_categories}
                                        onChange={(e) => setSettings({ ...settings, defect_categories: e.target.value })}
                                        disabled={!hasDefectCols}
                                        className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/50 transition-all font-mono t-primary disabled:opacity-50 text-sm"
                                        style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Save Button */}
                        <div className="pt-4" style={{ borderTop: '1px solid var(--border-glass)' }}>
                            <button type="submit" disabled={isSaving}
                                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(59,130,246,0.2)] border border-blue-500/30">
                                {isSaving ? (
                                    <><div className="w-4 h-4 border-t-2 border-slate-950 rounded-full animate-spin"></div> Menyimpan...</>
                                ) : (
                                    <><Save className="w-4 h-4" /> Simpan Konfigurasi</>
                                )}
                            </button>
                        </div>
                    </form >
                </div >

                {/* RIGHT Column */}
                < div className="space-y-8" >

                    {/* Notification Templates */}
                    < div className="glass-card p-6 md:p-8" >
                        <h3 className="text-xl font-bold t-primary mb-2 flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-accent-base" />
                            Template Pesan WhatsApp
                        </h3>
                        <p className="text-sm t-secondary mb-4">
                            Gunakan variabel dalam tanda kurung kurawal. Contoh: {'{operator}'}, {'{item}'}, {'{qty}'}, {'{unit}'}, {'{notes}'}, {'{final_stock}'}, {'{stock}'}, {'{min_stock}'}, {'{order}'}, {'{date}'}, {'{time}'}
                        </p>

                        {
                            !hasTemplateCols && (
                                <div className="p-3 mb-4 bg-brand-amber/10 border border-brand-amber/20 rounded-lg text-sm text-brand-amber">
                                    Update schema database untuk membuka fitur ini (jalankan add_wa_templates.sql).
                                </div>
                            )
                        }

                        <div className="space-y-5">
                            <div>
                                <label className="block text-xs font-semibold text-brand-red uppercase tracking-wider mb-2">Template Laporan Kerusakan</label>
                                <textarea rows="4" value={settings.wa_template_damage} onChange={(e) => setSettings({ ...settings, wa_template_damage: e.target.value })} disabled={!hasTemplateCols} className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/50 transition-all font-mono text-xs t-primary resize-y disabled:opacity-50" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }} />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-accent-base uppercase tracking-wider mb-2">Template Laporan Pemakaian</label>
                                <textarea rows="4" value={settings.wa_template_usage} onChange={(e) => setSettings({ ...settings, wa_template_usage: e.target.value })} disabled={!hasTemplateCols} className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-accent-base focus:ring-1 focus:ring-accent-base/50 transition-all font-mono text-xs t-primary resize-y disabled:opacity-50" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }} />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-amber-500 uppercase tracking-wider mb-2">Template Peringatan Restok (pemakaian + stok kritis)</label>
                                <p className="text-[11px] t-muted mb-2 leading-relaxed">
                                    Dikirim lewat webhook <b>trx_stock_log</b> (log pemakaian), sebagai pesan terpisah dari WA pemakaian. Aktif jika <b>Min. Stok</b> pada barang &gt; 0 dan sisa stok setelah pemakaian ≤ batas minimal. Pastikan webhook Database untuk <b>trx_stock_log</b> mengarah ke <code className="font-mono">fonnte-alert</code>.
                                    Placeholder: {'{item}'}, {'{stock}'}, {'{min_stock}'}, {'{unit}'}, {'{operator}'}, {'{qty}'}, {'{notes}'}, {'{date}'}, {'{time}'}.
                                </p>
                                {!hasRestockTemplate && (
                                    <div className="p-2 mb-2 bg-brand-amber/10 border border-brand-amber/20 rounded-lg text-[11px] text-brand-amber">
                                        Jalankan migrasi SQL <code className="font-mono">20260328120000_wa_template_restock_and_submit_order.sql</code> di Supabase agar kolom ini tersedia.
                                    </div>
                                )}
                                <textarea
                                    rows="8"
                                    value={settings.wa_template_restock_usage}
                                    onChange={(e) => setSettings({ ...settings, wa_template_restock_usage: e.target.value })}
                                    disabled={!hasTemplateCols || !hasRestockTemplate}
                                    className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all font-mono text-xs t-primary resize-y disabled:opacity-50"
                                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">Template Stok Masuk</label>
                                <textarea rows="5" value={settings.wa_template_stockin} onChange={(e) => setSettings({ ...settings, wa_template_stockin: e.target.value })} disabled={!hasTemplateCols} className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/50 transition-all font-mono text-xs t-primary resize-y disabled:opacity-50" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }} />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-brand-amber uppercase tracking-wider mb-2">Template Tracking Cutting</label>
                                <textarea rows="4" value={settings.wa_template_cutting} onChange={(e) => setSettings({ ...settings, wa_template_cutting: e.target.value })} disabled={!hasTemplateCols} className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-brand-amber focus:ring-1 focus:ring-brand-amber/50 transition-all font-mono text-xs t-primary resize-y disabled:opacity-50" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }} />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-orange-400 uppercase tracking-wider mb-2">Template Laporan Kendala (QC)</label>
                                <textarea rows="4" value={settings.wa_template_defect} onChange={(e) => setSettings({ ...settings, wa_template_defect: e.target.value })} disabled={!hasDefectTemplate} className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/50 transition-all font-mono text-xs t-primary resize-y disabled:opacity-50" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }} />
                            </div>

                            <button type="button" onClick={handleSaveSettings} disabled={isSaving || !hasTemplateCols}
                                className="w-full flex justify-center items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm border border-blue-500/30 text-sm">
                                {isSaving ? 'Menyimpan...' : 'Simpan Semua Perubahan'}
                            </button>
                        </div>
                    </div >

                    {/* Mode tampilan dihapus: sudah ada toggle di tempat lain */}

                </div >
            </div >
        </div >
    );
}
