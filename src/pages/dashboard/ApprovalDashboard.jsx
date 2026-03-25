import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import {
    CheckCircle2,
    Search,
    AlertTriangle,
    FileText,
    Scissors,
    ArrowUpCircle,
    Settings2,
    Package,
    CalendarDays,
    Filter,
} from 'lucide-react';

function dayBoundsISO(d) {
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);
    return { start: start.toISOString(), end: end.toISOString() };
}

function formatRole(role) {
    if (!role) return '';
    return role.replace('OP_', '');
}

/** @param {string} iso */
function formatLogTime(iso) {
    return new Date(iso).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function ApprovalDashboard() {
    const [selectedDate, setSelectedDate] = useState(() => {
        const t = new Date();
        return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('ALL'); // ALL | USAGE | DAMAGE | CUTTING | DEFECT | STOCK_IN | AUDIT
    const [visibleCount, setVisibleCount] = useState(30);
    const [entries, setEntries] = useState([]);
    const [stats, setStats] = useState({
        criticalStock: 0,
        countReports: 0,
        countCutting: 0,
        countDefects: 0,
        countStockMoves: 0,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');

    const selectedDay = useMemo(() => {
        const [y, m, day] = selectedDate.split('-').map(Number);
        return new Date(y, m - 1, day);
    }, [selectedDate]);

    useEffect(() => {
        setVisibleCount(30);
    }, [selectedDate, searchTerm, typeFilter]);

    const fetchCriticalStock = useCallback(async () => {
        try {
            const { data: itemsData } = await supabase.from('mst_items').select('stock, min_stock');
            const criticalCount = itemsData ? itemsData.filter((i) => i.stock <= i.min_stock).length : 0;
            setStats((prev) => ({ ...prev, criticalStock: criticalCount }));
        } catch (e) {
            console.error('Error fetching critical stock:', e);
        }
    }, []);

    const fetchDailyLog = useCallback(async () => {
        setIsLoading(true);
        setErrorMsg('');
        const { start, end } = dayBoundsISO(selectedDay);

        try {
            const [
                { data: reports, error: errReports },
                { data: cuttings, error: errCut },
                { data: defects, error: errDef },
                { data: stockLogs, error: errStock },
            ] = await Promise.all([
                supabase
                    .from('trx_reports')
                    .select(
                        `id, type, quantity, status, notes, created_at, item:mst_items(name, unit), operator:profiles!trx_reports_operator_id_fkey(full_name, role)`
                    )
                    .gte('created_at', start)
                    .lte('created_at', end)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('trx_cutting_log')
                    .select('id, order_name, qty_cut, notes, created_at, operator_id, item_id')
                    .gte('created_at', start)
                    .lte('created_at', end)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('trx_defects')
                    .select(
                        `id, order_name, error_source, error_category, quantity, notes, created_at, status, profiles!trx_defects_reporter_id_fkey(full_name)`
                    )
                    .gte('created_at', start)
                    .lte('created_at', end)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('trx_stock_log')
                    .select(
                        `id, change_amount, previous_stock, final_stock, source, notes, created_at, changed_by, item:mst_items(name, unit)`
                    )
                    .gte('created_at', start)
                    .lte('created_at', end)
                    .in('source', ['STOCK_IN', 'AUDIT'])
                    .order('created_at', { ascending: false }),
            ]);

            if (errReports) throw errReports;
            if (errCut) throw errCut;
            if (errDef) throw errDef;
            if (errStock) throw errStock;

            const operatorIds = new Set();
            (cuttings || []).forEach((l) => operatorIds.add(l.operator_id));
            (stockLogs || []).forEach((l) => l.changed_by && operatorIds.add(l.changed_by));

            let profileMap = {};
            if (operatorIds.size > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, full_name, role')
                    .in('id', [...operatorIds]);
                (profiles || []).forEach((p) => {
                    profileMap[p.id] = p;
                });
            }

            const itemIds = [...new Set((cuttings || []).map((l) => l.item_id).filter(Boolean))];
            let itemMap = {};
            if (itemIds.length > 0) {
                const { data: items } = await supabase.from('mst_items').select('id, name, unit').in('id', itemIds);
                (items || []).forEach((it) => {
                    itemMap[it.id] = it;
                });
            }

            const merged = [];

            (reports || []).forEach((r) => {
                const isUsage = r.type === 'Usage';
                merged.push({
                    key: `report:${r.id}`,
                    kind: isUsage ? 'USAGE' : 'DAMAGE',
                    created_at: r.created_at,
                    title: r.item?.name || 'Barang tidak diketahui',
                    badge: isUsage ? 'Pemakaian' : 'Kerusakan',
                    badgeClass: isUsage
                        ? 'text-accent-base bg-accent-base/10 border-accent-base/20'
                        : 'text-brand-amber bg-brand-amber/10 border-brand-amber/20',
                    lines: [
                        r.operator
                            ? `${r.operator.full_name} (${formatRole(r.operator.role)})`
                            : 'Operator tidak diketahui',
                        `${r.quantity} ${r.item?.unit || 'qty'}`,
                        r.status === 'Approved'
                            ? 'Status: Tercatat'
                            : r.status === 'Rejected'
                              ? 'Status: Ditolak'
                              : 'Status: Pending',
                    ],
                    notes: r.notes || '',
                });
            });

            (cuttings || []).forEach((c) => {
                const prof = profileMap[c.operator_id];
                const it = c.item_id ? itemMap[c.item_id] : null;
                merged.push({
                    key: `cutting:${c.id}`,
                    kind: 'CUTTING',
                    created_at: c.created_at,
                    title: c.order_name || 'Order cutting',
                    badge: 'Cutting',
                    badgeClass: 'text-violet-400 bg-violet-400/10 border-violet-400/20',
                    lines: [
                        prof ? `${prof.full_name} (${formatRole(prof.role)})` : 'Operator cutting',
                        it ? `Bahan: ${it.name}` : null,
                        `${c.qty_cut} lembar / unit dipotong`,
                    ].filter(Boolean),
                    notes: c.notes || '',
                });
            });

            (defects || []).forEach((d) => {
                const name = d.profiles?.full_name || 'Pelapor';
                merged.push({
                    key: `defect:${d.id}`,
                    kind: 'DEFECT',
                    created_at: d.created_at,
                    title: d.order_name || 'Laporan kendala',
                    badge: 'Kendala',
                    badgeClass: 'text-brand-red bg-brand-red/10 border-brand-red/20',
                    lines: [
                        name,
                        `${d.error_source} · ${d.error_category}`,
                        `Qty: ${d.quantity}`,
                        d.status ? `Status: ${d.status}` : null,
                    ].filter(Boolean),
                    notes: d.notes || '',
                });
            });

            (stockLogs || []).forEach((s) => {
                const prof = s.changed_by ? profileMap[s.changed_by] : null;
                const isIn = s.source === 'STOCK_IN';
                merged.push({
                    key: `stock:${s.id}`,
                    kind: isIn ? 'STOCK_IN' : 'AUDIT',
                    created_at: s.created_at,
                    title: s.item?.name || 'Item',
                    badge: isIn ? 'Stok masuk' : 'Audit / opname',
                    badgeClass: isIn
                        ? 'text-sky-400 bg-sky-400/10 border-sky-400/20'
                        : 'text-brand-amber bg-brand-amber/10 border-brand-amber/20',
                    lines: [
                        prof ? `${prof.full_name} (${formatRole(prof.role)})` : 'Sistem / user',
                        `Δ ${s.change_amount > 0 ? '+' : ''}${s.change_amount} ${s.item?.unit || ''}`.trim(),
                        `Stok: ${s.previous_stock} → ${s.final_stock}`,
                    ],
                    notes: s.notes || '',
                });
            });

            merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            setEntries(merged);
            setStats((prev) => ({
                ...prev,
                countReports: (reports || []).length,
                countCutting: (cuttings || []).length,
                countDefects: (defects || []).length,
                countStockMoves: (stockLogs || []).length,
            }));
        } catch (error) {
            console.error('Error fetching daily log:', error);
            setErrorMsg(error.message);
            setEntries([]);
        } finally {
            setIsLoading(false);
        }
    }, [selectedDay]);

    useEffect(() => {
        fetchDailyLog();
        fetchCriticalStock();
    }, [fetchDailyLog, fetchCriticalStock]);

    const filteredEntries = useMemo(() => {
        let list = entries;
        if (typeFilter !== 'ALL') {
            list = list.filter((e) => e.kind === typeFilter);
        }
        if (!searchTerm.trim()) return list;
        const q = searchTerm.toLowerCase();
        return list.filter((e) => {
            const blob = [e.title, e.badge, e.notes, ...(e.lines || [])].join(' ').toLowerCase();
            return blob.includes(q);
        });
    }, [entries, typeFilter, searchTerm]);

    const totalToday = stats.countReports + stats.countCutting + stats.countDefects + stats.countStockMoves;

    const filterChips = [
        { id: 'ALL', label: 'Semua' },
        { id: 'USAGE', label: 'Pemakaian' },
        { id: 'DAMAGE', label: 'Kerusakan' },
        { id: 'CUTTING', label: 'Cutting' },
        { id: 'DEFECT', label: 'Kendala' },
        { id: 'STOCK_IN', label: 'Stok masuk' },
        { id: 'AUDIT', label: 'Audit' },
    ];

    const iconFor = (kind) => {
        switch (kind) {
            case 'USAGE':
            case 'DAMAGE':
                return Package;
            case 'CUTTING':
                return Scissors;
            case 'DEFECT':
                return AlertTriangle;
            case 'STOCK_IN':
                return ArrowUpCircle;
            case 'AUDIT':
                return Settings2;
            default:
                return FileText;
        }
    };

    return (
        <div className="w-full animate-in fade-in py-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
                <div className="glass-card p-3 sm:p-4 flex items-center gap-3 sm:gap-4 group cursor-default col-span-2 lg:col-span-1">
                    <div className="p-2.5 sm:p-3 bg-accent-base/10 rounded-xl text-accent-base border border-accent-base/20 group-hover:bg-accent-base/20 transition-colors shrink-0">
                        <CalendarDays className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="t-secondary text-[10px] sm:text-xs font-semibold mb-0.5 uppercase tracking-wider">
                            Aktivitas hari ini
                        </h3>
                        <div className="text-xl sm:text-2xl font-mono font-bold t-primary group-hover:text-accent-base transition-colors leading-none">
                            {isLoading ? '…' : totalToday}
                        </div>
                        <p className="text-[10px] t-muted mt-1 truncate">Semua jenis kejadian</p>
                    </div>
                </div>

                <div className="glass-card p-3 sm:p-4 flex items-center gap-3 sm:gap-4 group cursor-default">
                    <div className="p-2.5 sm:p-3 bg-slate-500/10 rounded-xl t-secondary border border-theme group-hover:bg-slate-500/15 transition-colors shrink-0">
                        <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="t-secondary text-[10px] sm:text-xs font-semibold mb-0.5 uppercase tracking-wider">
                            Laporan stok
                        </h3>
                        <div className="text-xl sm:text-2xl font-mono font-bold t-primary leading-none">
                            {isLoading ? '…' : stats.countReports}
                        </div>
                        <p className="text-[10px] t-muted mt-1">Pakai & rusak</p>
                    </div>
                </div>

                <div className="glass-card p-3 sm:p-4 flex items-center gap-3 sm:gap-4 group cursor-default">
                    <div className="p-2.5 sm:p-3 bg-violet-500/10 rounded-xl text-violet-400 border border-violet-500/20 shrink-0">
                        <Scissors className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="t-secondary text-[10px] sm:text-xs font-semibold mb-0.5 uppercase tracking-wider">
                            Cutting
                        </h3>
                        <div className="text-xl sm:text-2xl font-mono font-bold t-primary leading-none">
                            {isLoading ? '…' : stats.countCutting}
                        </div>
                        <p className="text-[10px] t-muted mt-1">Tracking potong</p>
                    </div>
                </div>

                <div className="glass-card p-3 sm:p-4 flex items-center gap-3 sm:gap-4 group cursor-default col-span-2 lg:col-span-1">
                    <div className="p-2.5 sm:p-3 bg-brand-red/10 rounded-xl text-brand-red border border-brand-red/20 shrink-0">
                        <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="t-secondary text-[10px] sm:text-xs font-semibold mb-0.5 uppercase tracking-wider">
                            Stok kritis
                        </h3>
                        <div className="text-xl sm:text-2xl font-mono font-bold t-primary group-hover:text-brand-red transition-colors leading-none">
                            {isLoading ? '…' : stats.criticalStock}
                        </div>
                        <p className="text-[10px] t-muted mt-1">
                            Kendala: {isLoading ? '…' : stats.countDefects} · Stok in/audit:{' '}
                            {isLoading ? '…' : stats.countStockMoves}
                        </p>
                    </div>
                </div>
            </div>

            <div className="glass-card p-5 sm:p-6 flex flex-col min-h-[480px]">
                <div className="flex flex-col gap-4 mb-6">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold tracking-tight t-primary mb-1 flex items-center gap-2">
                            Log harian
                        </h2>
                        <p className="t-secondary text-sm">
                            Satu linimasa: pemakaian & kerusakan stok, cutting, lapor kendala, stok masuk, dan audit
                            — tanpa duplikat dari laporan yang sama.
                        </p>
                    </div>

                    <div className="flex flex-col xl:flex-row xl:items-end gap-3 xl:gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                            <div>
                                <label className="block text-[10px] font-semibold t-muted uppercase tracking-wider mb-1.5">
                                    Tanggal
                                </label>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="border rounded-xl py-2 px-3 text-sm t-primary focus:outline-none focus:ring-2 focus:ring-accent-base/30"
                                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    const t = new Date();
                                    setSelectedDate(
                                        `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
                                    );
                                }}
                                className="px-4 py-2 text-sm font-medium rounded-xl border t-secondary hover:t-primary transition-colors h-[42px] self-end"
                                style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}
                            >
                                Hari ini
                            </button>
                        </div>

                        <div className="relative flex-1 min-w-0">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 t-muted" />
                            <input
                                type="text"
                                placeholder="Cari judul, operator, catatan…"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full border rounded-xl py-2 pl-9 pr-4 focus:outline-none focus:ring-2 focus:ring-accent-base/30 text-sm t-primary transition-all"
                                style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}
                            />
                        </div>

                        <button
                            onClick={() => {
                                fetchDailyLog();
                                fetchCriticalStock();
                            }}
                            className="p-2.5 rounded-xl border t-muted hover:t-primary transition-colors shrink-0 h-[42px] w-[42px] flex items-center justify-center self-end"
                            style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}
                            title="Muat ulang"
                        >
                            <svg
                                className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                            </svg>
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] t-muted uppercase tracking-wider flex items-center gap-1 mr-1">
                            <Filter className="w-3.5 h-3.5" /> Jenis
                        </span>
                        {filterChips.map((c) => (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => setTypeFilter(c.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                    typeFilter === c.id
                                        ? 't-primary border-accent-base/40 bg-accent-base/10'
                                        : 't-muted border-transparent hover:border-theme'
                                }`}
                                style={
                                    typeFilter === c.id
                                        ? {}
                                        : { background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }
                                }
                            >
                                {c.label}
                            </button>
                        ))}
                    </div>
                </div>

                {errorMsg && (
                    <div className="mb-4 p-3 rounded-xl border border-brand-red/30 bg-brand-red/10 text-sm text-brand-red">
                        {errorMsg}
                    </div>
                )}

                {isLoading ? (
                    <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div
                                key={i}
                                className="rounded-2xl p-4 border animate-pulse flex gap-4"
                                style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}
                            >
                                <div className="w-12 h-12 rounded-xl shrink-0" style={{ background: 'var(--bg-surface)' }} />
                                <div className="flex-1 space-y-2 py-1">
                                    <div className="h-4 rounded w-2/3" style={{ background: 'var(--bg-surface)' }} />
                                    <div className="h-3 rounded w-1/2" style={{ background: 'var(--bg-surface)' }} />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filteredEntries.length === 0 ? (
                    <div
                        className="p-12 flex flex-col items-center justify-center text-center flex-1 border-2 border-dashed rounded-2xl"
                        style={{ borderColor: 'var(--border-glass)' }}
                    >
                        <div className="w-16 h-16 rounded-full bg-accent-base/10 flex items-center justify-center mb-4 border border-accent-base/20">
                            <CheckCircle2 className="w-8 h-8 text-accent-base" />
                        </div>
                        <h3 className="text-lg font-medium t-primary mb-1">Belum ada aktivitas</h3>
                        <p className="t-secondary text-sm max-w-md">
                            Tidak ada entri log untuk tanggal ini
                            {searchTerm || typeFilter !== 'ALL' ? ' (atau filter/pencarian tidak cocok)' : ''}.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col space-y-3">
                        {filteredEntries.slice(0, visibleCount).map((entry) => {
                            const Icon = iconFor(entry.kind);
                            return (
                                <div
                                    key={entry.key}
                                    className="relative rounded-2xl p-4 border flex flex-col md:flex-row md:items-start gap-4 group hover:border-accent-base/25 transition-all duration-300"
                                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}
                                >
                                    <div className="flex items-start gap-4 flex-1 min-w-0">
                                        <div
                                            className="w-12 h-12 rounded-xl border flex items-center justify-center shrink-0"
                                            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-glass)' }}
                                        >
                                            <Icon className="w-6 h-6 t-muted group-hover:t-primary transition-colors" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                <h4 className="text-base font-bold t-primary truncate max-w-full" title={entry.title}>
                                                    {entry.title}
                                                </h4>
                                                <span
                                                    className={`inline-block text-[10px] font-mono px-2 py-0.5 rounded-full uppercase tracking-wider border shrink-0 ${entry.badgeClass}`}
                                                >
                                                    {entry.badge}
                                                </span>
                                            </div>
                                            <p className="text-[10px] t-muted font-mono tracking-wider mb-2">
                                                {formatLogTime(entry.created_at)}
                                            </p>
                                            <ul className="text-sm t-secondary space-y-0.5">
                                                {entry.lines.map((line, idx) => (
                                                    <li key={idx}>{line}</li>
                                                ))}
                                            </ul>
                                            {entry.notes ? (
                                                <div className="inline-flex items-start gap-1.5 bg-surface border border-theme rounded-lg p-2 mt-3 w-full max-w-xl">
                                                    <FileText className="w-3 h-3 t-muted shrink-0 mt-0.5" />
                                                    <p
                                                        className="text-[11px] t-secondary leading-relaxed line-clamp-3"
                                                        title={entry.notes}
                                                    >
                                                        {entry.notes}
                                                    </p>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {visibleCount < filteredEntries.length && (
                            <div className="flex justify-center pt-4 pb-2">
                                <button
                                    type="button"
                                    onClick={() => setVisibleCount((p) => p + 20)}
                                    className="px-6 py-2.5 bg-surface border border-theme t-primary font-bold text-sm rounded-xl hover:border-accent-base/50 hover:text-accent-base transition-all shadow-sm"
                                >
                                    Muat lebih banyak ({filteredEntries.length - visibleCount} lagi)
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
