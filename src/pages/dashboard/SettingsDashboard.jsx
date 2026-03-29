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
        wa_template_restock_usage: '',
        wa_template_bot_stock: '',
        fonnte_api_token: '',
        is_active_usage: true,
        is_active_damage: true,
        is_active_stockin: true,
        is_active_cutting: true,
        is_active_defect: true,
        is_active_restock: true,
        is_active_bot: true,
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
    const [hasBotStockTemplate, setHasBotStockTemplate] = useState(false);
    const [hasFonnteTokenCol, setHasFonnteTokenCol] = useState(false);
    const [hasToggles, setHasToggles] = useState(false);
    const [openAccordion, setOpenAccordion] = useState(null);
    const [deviceStatus, setDeviceStatus] = useState({ status: 'idle', info: null });
    const [showToken, setShowToken] = useState(false);

    const ToggleSwitch = ({ label, checked, onChange, disabled }) => (
        <label className={`flex items-center ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
            <div className="relative">
                <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} disabled={disabled} />
                <div className={`block w-10 h-6 rounded-full transition-colors ${checked ? 'bg-emerald-500' : 'bg-[var(--border-glass)]'}`}></div>
                <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${checked ? 'transform translate-x-4' : ''}`}></div>
            </div>
            {label && <div className="ml-3 text-sm font-semibold t-primary">{label}</div>}
        </label>
    );

    const AccordionCard = ({ title, isActive, onToggleActive, children, isOpen, onToggleOpen, disabledToggle }) => (
        <div className="border rounded-xl transition-all overflow-hidden mb-4" style={{ borderColor: 'var(--border-glass)', background: 'var(--bg-card)' }}>
            <div className={`p-4 flex items-center justify-between cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors`} onClick={onToggleOpen}>
                <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                    <ToggleSwitch checked={isActive} onChange={(e) => { onToggleActive(e.target.checked); }} disabled={disabledToggle} />
                    <span className={`font-bold text-sm ${isActive ? 't-primary' : 't-muted'}`}>{title}</span>
                </div>
                <div className="text-xs font-semibold t-muted bg-black/5 dark:bg-white/5 px-3 py-1 rounded-full">{isOpen ? 'Tutup' : 'Edit Template'}</div>
            </div>
            {isOpen && (
                <div className={`p-4 border-t transition-opacity ${!isActive ? 'opacity-40 pointer-events-none' : 'opacity-100'}`} style={{ borderColor: 'var(--border-glass)', background: 'var(--bg-input)' }}>
                    {children}
                </div>
            )}
        </div>
    );

    const checkFonnteDevice = async (token) => {
        if (!token) return;
        setDeviceStatus({ status: 'loading', info: null });
        try {
            const res = await fetch('https://api.fonnte.com/device', {
                method: 'POST',
                headers: { 'Authorization': token }
            });
            const result = await res.json();
            if (result.status === true && result.device_status === 'connect') {
                setDeviceStatus({ status: 'connected', info: `${result.name || 'WA'} (${result.device || 'OK'})` });
            } else {
                setDeviceStatus({ status: 'disconnected', info: result.reason || result.detail || 'Device Not Connected' });
            }
        } catch (err) {
            setDeviceStatus({ status: 'error', info: err.message });
        }
    };

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
                const botStockTemplateExists = 'wa_template_bot_stock' in data;
                const fonnteTokenColExists = 'fonnte_api_token' in data;
                const toggleExists = 'is_active_usage' in data;

                setHasTemplateCols(templatesExist);
                setHasDefectCols(defectsExist);
                setHasDefectTemplate(defectTemplateExists);
                setHasRestockTemplate(restockTemplateExists);
                setHasBotStockTemplate(botStockTemplateExists);
                setHasFonnteTokenCol(fonnteTokenColExists);
                setHasToggles(toggleExists);

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
                    wa_template_bot_stock: botStockTemplateExists ? (data.wa_template_bot_stock || '📊 *LAPORAN SISA STOK ARSY JAYA* 📊\n\n{stock_list}\n\n_Diperbarui pada: {date} {time}_') : '',
                    fonnte_api_token: fonnteTokenColExists ? (data.fonnte_api_token || '') : '',
                    is_active_usage: toggleExists ? data.is_active_usage : true,
                    is_active_damage: toggleExists ? data.is_active_damage : true,
                    is_active_stockin: toggleExists ? data.is_active_stockin : true,
                    is_active_cutting: toggleExists ? data.is_active_cutting : true,
                    is_active_defect: toggleExists ? data.is_active_defect : true,
                    is_active_restock: toggleExists ? data.is_active_restock : true,
                    is_active_bot: toggleExists ? data.is_active_bot : true,
                    defect_sources: defectsExist && Array.isArray(data.defect_sources) ? data.defect_sources.join(', ') : '',
                    defect_categories: defectsExist && Array.isArray(data.defect_categories) ? data.defect_categories.join(', ') : ''
                });

                if (fonnteTokenColExists && data.fonnte_api_token) {
                    checkFonnteDevice(data.fonnte_api_token);
                }
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

            if (hasBotStockTemplate) {
                payload.wa_template_bot_stock = settings.wa_template_bot_stock;
            }

            if (hasToggles) {
                payload.is_active_usage = settings.is_active_usage;
                payload.is_active_damage = settings.is_active_damage;
                payload.is_active_stockin = settings.is_active_stockin;
                payload.is_active_cutting = settings.is_active_cutting;
                payload.is_active_defect = settings.is_active_defect;
                payload.is_active_restock = settings.is_active_restock;
                payload.is_active_bot = settings.is_active_bot;
            }

            if (hasFonnteTokenCol) {
                payload.fonnte_api_token = settings.fonnte_api_token;
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
            if (hasFonnteTokenCol && settings.fonnte_api_token) checkFonnteDevice(settings.fonnte_api_token);
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

                        {/* Fonnte WhatsApp Gateway Configuration */}
                        <div className="mb-10">
                            <h3 className="text-xl font-bold t-primary mb-6 flex items-center gap-2">
                                <Smartphone className="w-5 h-5 text-accent-base" />
                                Fonnte Device & API Token
                            </h3>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-xs font-semibold t-secondary uppercase tracking-wider mb-2">Fonnte API Token</label>
                                    <p className="text-xs t-muted mb-3">Jika dikosongkan, sistem memakai default <code className="px-1 text-emerald-400 bg-emerald-500/10 rounded">.env</code>: {import.meta.env.VITE_FONNTE_TOKEN ? 'Tersedia' : 'Tidak Ada'}.</p>
                                    {!hasFonnteTokenCol && (
                                        <div className="p-2 mb-2 bg-brand-amber/10 border border-brand-amber/20 rounded-lg text-[11px] text-brand-amber">
                                            Jalankan migrasi SQL <code className="font-mono">20260329113000</code> agar token bisa disimpan.
                                        </div>
                                    )}
                                    <div className="flex gap-3">
                                        <div className="relative flex-1 max-w-md">
                                            <input 
                                                type={showToken ? "text" : "password"}
                                                value={settings.fonnte_api_token}
                                                onChange={(e) => setSettings({ ...settings, fonnte_api_token: e.target.value })}
                                                className="w-full border rounded-xl px-4 py-3 pr-24 focus:outline-none focus:border-accent-base focus:ring-1 focus:ring-accent-base/50 transition-all font-mono t-primary"
                                                style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}
                                                placeholder="Token API Fonnte..."
                                                disabled={!hasFonnteTokenCol}
                                            />
                                            <button type="button" onClick={() => setShowToken(!showToken)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] uppercase font-bold text-accent-base/70 hover:text-accent-base">
                                                {showToken ? 'Sembunyikan' : 'Tampilkan'}
                                            </button>
                                        </div>
                                        <button type="button" onClick={() => checkFonnteDevice(settings.fonnte_api_token || import.meta.env.VITE_FONNTE_TOKEN)} 
                                                className="px-4 py-3 bg-brand-navy/50 hover:bg-brand-navy border border-[var(--border-glass)] text-xs font-bold rounded-xl t-primary transition-all whitespace-nowrap">
                                            Cek Koneksi
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 p-4 rounded-xl border flex-wrap" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}>
                                    <div className="text-sm font-semibold t-secondary">Status WhatsApp:</div>
                                    {deviceStatus.status === 'idle' && <span className="text-xs px-2 py-1 rounded bg-gray-500/20 text-gray-400">Belum Dicek</span>}
                                    {deviceStatus.status === 'loading' && <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400 animate-pulse">Memeriksa...</span>}
                                    {deviceStatus.status === 'connected' && <span className="text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 font-bold">✅ Terhubung ({deviceStatus.info})</span>}
                                    {deviceStatus.status === 'disconnected' && <span className="text-xs px-2 py-1 rounded bg-brand-red/20 text-brand-red font-bold">❌ Terputus ({deviceStatus.info})</span>}
                                    {deviceStatus.status === 'error' && <span className="text-xs px-2 py-1 rounded bg-orange-500/20 text-orange-400 font-bold">⚠️ Error API ({deviceStatus.info})</span>}
                                </div>
                            </div>
                        </div>

                        {/* WhatsApp Section */}
                        <div className="pt-6" style={{ borderTop: '1px solid var(--border-glass)' }}>
                            <h3 className="text-xl font-bold t-primary mb-6 flex items-center gap-2">
                                Target Penerima (SPV & Grup)
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
                                        <p className="text-[10px] t-muted mb-3 block h-8">Otomatis diubah menjadi 628...</p>
                                        <input type="text"
                                            value={settings.spv_wa_number}
                                            onChange={(e) => {
                                                let val = e.target.value.replace(/\D/g, '');
                                                if (val.startsWith('0')) val = '62' + val.substring(1);
                                                setSettings({ ...settings, spv_wa_number: val });
                                            }}
                                            className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-accent-base focus:ring-1 focus:ring-accent-base/50 transition-all font-mono t-primary"
                                            style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}
                                            placeholder="6281..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold t-secondary uppercase tracking-wider mb-2">ID Grup (Opsional)</label>
                                        <p className="text-[10px] t-muted mb-3 block h-8">Wajib diakhiri dengan @g.us<br/>Contoh: 12036...430@g.us</p>
                                        <input type="text"
                                            value={settings.spv_wa_group}
                                            onChange={(e) => setSettings({ ...settings, spv_wa_group: e.target.value.trim() })}
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

                        <div className="space-y-4">
                            <AccordionCard title="📱 Laporan Pemakaian" isActive={settings.is_active_usage} onToggleActive={(val) => setSettings({...settings, is_active_usage: val})} isOpen={openAccordion === 'usage'} onToggleOpen={() => setOpenAccordion(openAccordion === 'usage' ? null : 'usage')} disabledToggle={!hasTemplateCols || !hasToggles}>
                                <label className="block text-xs font-semibold text-accent-base uppercase tracking-wider mb-2">Pesan Pemakaian Bahan</label>
                                <textarea rows="3" value={settings.wa_template_usage} onChange={(e) => setSettings({ ...settings, wa_template_usage: e.target.value })} disabled={!hasTemplateCols} className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-accent-base focus:ring-1 transition-all font-mono text-xs t-primary resize-y" style={{ background: 'var(--bg-base)', borderColor: 'var(--border-glass)' }} />
                            </AccordionCard>

                            <AccordionCard title="🔥 Laporan Kerusakan (Damage)" isActive={settings.is_active_damage} onToggleActive={(val) => setSettings({...settings, is_active_damage: val})} isOpen={openAccordion === 'damage'} onToggleOpen={() => setOpenAccordion(openAccordion === 'damage' ? null : 'damage')} disabledToggle={!hasTemplateCols || !hasToggles}>
                                <label className="block text-xs font-semibold text-brand-red uppercase tracking-wider mb-2">Pesan Barang Rusak</label>
                                <textarea rows="3" value={settings.wa_template_damage} onChange={(e) => setSettings({ ...settings, wa_template_damage: e.target.value })} disabled={!hasTemplateCols} className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-brand-red focus:ring-1 transition-all font-mono text-xs t-primary resize-y" style={{ background: 'var(--bg-base)', borderColor: 'var(--border-glass)' }} />
                            </AccordionCard>

                            <AccordionCard title="📦 Stok Masuk" isActive={settings.is_active_stockin} onToggleActive={(val) => setSettings({...settings, is_active_stockin: val})} isOpen={openAccordion === 'stockin'} onToggleOpen={() => setOpenAccordion(openAccordion === 'stockin' ? null : 'stockin')} disabledToggle={!hasTemplateCols || !hasToggles}>
                                <label className="block text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">Pesan Stok Masuk</label>
                                <textarea rows="3" value={settings.wa_template_stockin} onChange={(e) => setSettings({ ...settings, wa_template_stockin: e.target.value })} disabled={!hasTemplateCols} className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-blue-400 focus:ring-1 transition-all font-mono text-xs t-primary resize-y" style={{ background: 'var(--bg-base)', borderColor: 'var(--border-glass)' }} />
                            </AccordionCard>

                            <AccordionCard title="✂️ Tracking Cutting" isActive={settings.is_active_cutting} onToggleActive={(val) => setSettings({...settings, is_active_cutting: val})} isOpen={openAccordion === 'cutting'} onToggleOpen={() => setOpenAccordion(openAccordion === 'cutting' ? null : 'cutting')} disabledToggle={!hasTemplateCols || !hasToggles}>
                                <label className="block text-xs font-semibold text-amber-500 uppercase tracking-wider mb-2">Pesan Log Cutting</label>
                                <textarea rows="3" value={settings.wa_template_cutting} onChange={(e) => setSettings({ ...settings, wa_template_cutting: e.target.value })} disabled={!hasTemplateCols} className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 focus:ring-1 transition-all font-mono text-xs t-primary resize-y" style={{ background: 'var(--bg-base)', borderColor: 'var(--border-glass)' }} />
                            </AccordionCard>

                            <AccordionCard title="⚠️ Kendala Produksi (QC)" isActive={settings.is_active_defect} onToggleActive={(val) => setSettings({...settings, is_active_defect: val})} isOpen={openAccordion === 'defect'} onToggleOpen={() => setOpenAccordion(openAccordion === 'defect' ? null : 'defect')} disabledToggle={!hasDefectCols || !hasToggles}>
                                <label className="block text-xs font-semibold text-orange-400 uppercase tracking-wider mb-2">Pesan Kendala Mesin / Cetakan</label>
                                <textarea rows="4" value={settings.wa_template_defect} onChange={(e) => setSettings({ ...settings, wa_template_defect: e.target.value })} disabled={!hasDefectTemplate} className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400 focus:ring-1 transition-all font-mono text-xs t-primary resize-y" style={{ background: 'var(--bg-base)', borderColor: 'var(--border-glass)' }} />
                            </AccordionCard>

                            <AccordionCard title="📛 Peringatan Restok (Batas Kritis)" isActive={settings.is_active_restock} onToggleActive={(val) => setSettings({...settings, is_active_restock: val})} isOpen={openAccordion === 'restock'} onToggleOpen={() => setOpenAccordion(openAccordion === 'restock' ? null : 'restock')} disabledToggle={!hasTemplateCols || !hasRestockTemplate || !hasToggles}>
                                <label className="block text-xs font-semibold text-brand-red uppercase tracking-wider mb-2">Pesan Bila Bahan Menyentuh Batas</label>
                                {!hasRestockTemplate && (
                                    <div className="p-2 mb-2 bg-brand-amber/10 border border-brand-amber/20 rounded-lg text-[11px] text-brand-amber">
                                        Jalankan migrasi SQL <code className="font-mono">..._wa_template_restock...</code> untuk fitur ini.
                                    </div>
                                )}
                                <textarea rows="6" value={settings.wa_template_restock_usage} onChange={(e) => setSettings({ ...settings, wa_template_restock_usage: e.target.value })} disabled={!hasTemplateCols || !hasRestockTemplate} className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-brand-red focus:ring-1 transition-all font-mono text-xs t-primary resize-y" style={{ background: 'var(--bg-base)', borderColor: 'var(--border-glass)' }} />
                            </AccordionCard>

                            <AccordionCard title="🤖 Bot Konfirmasi Laporan Stok" isActive={settings.is_active_bot} onToggleActive={(val) => setSettings({...settings, is_active_bot: val})} isOpen={openAccordion === 'bot'} onToggleOpen={() => setOpenAccordion(openAccordion === 'bot' ? null : 'bot')} disabledToggle={!hasBotStockTemplate || !hasToggles}>
                                <label className="block text-xs font-semibold text-emerald-500 uppercase tracking-wider mb-2">Pesan Otomatis Gateway</label>
                                <p className="text-[11px] t-muted mb-2">Dikirim lewat bot Whatsapp (keyword "laporkan sisa stok"). Placeholder: {'{stock_list}'}, {'{date}'}, {'{time}'}</p>
                                {!hasBotStockTemplate && (
                                    <div className="p-2 mb-2 bg-brand-amber/10 border border-brand-amber/20 rounded-lg text-[11px] text-brand-amber">
                                        Jalankan migrasi SQL <code className="font-mono">..._fonnte_bot_stock_template.sql</code> untuk fitur ini.
                                    </div>
                                )}
                                <textarea rows="6" value={settings.wa_template_bot_stock} onChange={(e) => setSettings({ ...settings, wa_template_bot_stock: e.target.value })} disabled={!hasBotStockTemplate} className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-1 transition-all font-mono text-xs t-primary resize-y" style={{ background: 'var(--bg-base)', borderColor: 'var(--border-glass)' }} />
                            </AccordionCard>
                        </div>

                        {/* Save Button explicitly placed at the bottom for Template edits */}
                        <div className="pt-4" style={{ borderTop: '1px solid var(--border-glass)' }}>
                            <button type="button" onClick={handleSaveSettings} disabled={isSaving || !hasTemplateCols}
                                className="w-full flex justify-center items-center gap-2 px-6 py-4 bg-accent-base hover:bg-accent-hover text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(16,185,129,0.2)] border border-accent-base/30 text-sm">
                                {isSaving ? (
                                    <><div className="w-4 h-4 border-t-2 border-white rounded-full animate-spin"></div> Menyimpan...</>
                                ) : (
                                    <><Save className="w-4 h-4" /> Simpan Semua Perubahan</>
                                )}
                            </button>
                        </div>

                    </div >
                </div >
            </div >
        </div >
    );
}
