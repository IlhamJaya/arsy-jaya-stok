
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import {
  FileText, Calendar, Filter, Download,
  BarChart3, PieChart as PieChartIcon, CheckCircle2, Factory, User, Package, AlertTriangle,
  ArrowUpCircle, ArrowDownCircle, Settings2, History, Scissors, Trash2, Plus, Database, Truck, RefreshCw, Edit2
} from 'lucide-react';
import { capitalizeWords, handleNumberInput } from '../../utils/formatters.js';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
  PieChart, Pie, AreaChart, Area
} from 'recharts';

import * as XLSX from 'xlsx';

// Custom Colors for Charts
const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const SOURCE_LABELS = {
  REPORT_USAGE: { label: 'Pemakaian', color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20', icon: ArrowDownCircle },
  REPORT_DAMAGE: { label: 'Kerusakan', color: 'text-brand-red', bg: 'bg-brand-red/10 border-brand-red/20', icon: AlertTriangle },
  STOCK_IN: { label: 'Stok Masuk', color: 'text-accent-base', bg: 'bg-accent-base/10 border-accent-base/20', icon: ArrowUpCircle },
  AUDIT: { label: 'Audit Opname', color: 'text-brand-amber', bg: 'bg-brand-amber/10 border-brand-amber/20', icon: Settings2 }
};

export default function ReportsDashboard({ userRole }) {
  const [activeTab, setActiveTab] = useState('produksi'); // 'produksi' | 'stok'
  const [materialOptions, setMaterialOptions] = useState([]);
  const [operatorOptions, setOperatorOptions] = useState([]);
  const [reports, setReports] = useState([]);
  const [stockLogs, setStockLogs] = useState([]);

  // Pagination states
  const [visibleReportsCount, setVisibleReportsCount] = useState(15);
  const [visibleStockCount, setVisibleStockCount] = useState(15);
  const [visibleCuttingCount, setVisibleCuttingCount] = useState(15);
  const [visibleDefectsCount, setVisibleDefectsCount] = useState(15);

  const [defectsLogs, setDefectsLogs] = useState([]);
  const [editingDefect, setEditingDefect] = useState(null);
  const [sourcesOptions, setSourcesOptions] = useState([]);
  const [categoriesOptions, setCategoriesOptions] = useState([]);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from('app_settings').select('*').eq('id', 1).single();
      if (data) {
        if (data.defect_sources) setSourcesOptions(data.defect_sources);
        if (data.defect_categories) setCategoriesOptions(data.defect_categories);
      }
    };
    fetchSettings();
  }, []);

  // State untuk Edit Cutting Log (Khusus SPV)
  const [editingCuttingLog, setEditingCuttingLog] = useState(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [cuttingLogs, setCuttingLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [dateRange, setDateRange] = useState('month');
  const [selectedType, setSelectedType] = useState('ALL');
  // Custom date range
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  // Specific month (YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    setVisibleReportsCount(15);
    setVisibleStockCount(15);
    setVisibleCuttingCount(15);
    setVisibleDefectsCount(15);
  }, [activeTab, dateRange, customStart, customEnd, selectedMonth, selectedType]);

  // Analytics View Type
  const [chartType, setChartType] = useState('operator');

  const getTimeFilter = useCallback(() => {
    const now = new Date();
    if (dateRange === 'today') {
      return { start: new Date(now.setHours(0, 0, 0, 0)).toISOString(), end: null };
    } else if (dateRange === 'week') {
      const s = new Date(); s.setDate(s.getDate() - 7);
      return { start: s.toISOString(), end: null };
    } else if (dateRange === 'month') {
      const s = new Date(); s.setDate(s.getDate() - 30);
      return { start: s.toISOString(), end: null };
    } else if (dateRange === 'custom') {
      if (!customStart) return { start: null, end: null };
      const start = new Date(customStart); start.setHours(0, 0, 0, 0);
      const end = customEnd ? new Date(customEnd) : new Date();
      end.setHours(23, 59, 59, 999);
      return { start: start.toISOString(), end: end.toISOString() };
    } else if (dateRange === 'bulan') {
      const [y, m] = selectedMonth.split('-').map(Number);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0, 23, 59, 59, 999);
      return { start: start.toISOString(), end: end.toISOString() };
    }
    return { start: null, end: null };
  }, [dateRange, customStart, customEnd, selectedMonth]);

  // === TAB 1: Fetch Reports from trx_reports ===
  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const { start, end } = getTimeFilter();
      let query = supabase
        .from('trx_reports')
        .select(`
            id, type, quantity, notes, status, created_at,
            item:mst_items(name, unit, stock),
            operator:profiles!trx_reports_operator_id_fkey(full_name, role)
        `)
        .eq('status', 'Approved')
        .order('created_at', { ascending: false });

      if (start) query = query.gte('created_at', start);
      if (end) query = query.lte('created_at', end);

      const { data, error } = await query;
      if (error) throw error;

      let transformed = data.map(d => ({
        id: d.id,
        date: new Date(d.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }),
        rawDate: new Date(d.created_at),
        type: d.operator?.role?.replace('OP_', '') || 'Unknown',
        itemName: d.item?.name || 'Unknown Item',
        itemUnit: d.item?.unit || '-',
        operatorName: d.operator?.full_name || 'Unknown Operator',
        qtyUsed: d.type === 'Usage' ? d.quantity : 0,
        qtyDamage: d.type === 'Damage' ? d.quantity : 0,
        reason: d.notes,
        finalStock: d.item?.stock
      }));

      if (selectedType !== 'ALL') {
        transformed = transformed.filter(r => r.type.toUpperCase() === selectedType.toUpperCase());
      }
      setReports(transformed);
    } catch (err) {
      console.error("Error fetching reports:", err);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, selectedType, getTimeFilter]);

  // === TAB 2: Fetch Stock Movement Logs from trx_stock_log ===
  const fetchStockLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const { start, end } = getTimeFilter();
      let query = supabase
        .from('trx_stock_log')
        .select(`
            id, change_amount, previous_stock, final_stock, source, notes, created_at,
            item:mst_items(name, unit)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (start) query = query.gte('created_at', start);
      if (end) query = query.lte('created_at', end);

      if (selectedType !== 'ALL') {
        const sourceFilter = selectedType === 'MASUK' ? 'STOCK_IN'
          : selectedType === 'KELUAR' ? ['REPORT_USAGE', 'REPORT_DAMAGE']
            : selectedType === 'AUDIT' ? 'AUDIT'
              : null;

        if (sourceFilter) {
          if (Array.isArray(sourceFilter)) {
            query = query.in('source', sourceFilter);
          } else {
            query = query.eq('source', sourceFilter);
          }
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      setStockLogs(data || []);
    } catch (err) {
      console.error("Error fetching stock logs:", err);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, selectedType, getTimeFilter]);

  // === TAB 3: Fetch Cutting Logs from trx_cutting_log ===
  const fetchCuttingLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const { start, end } = getTimeFilter();
      // Step 1: Fetch cutting logs (no join — operator_id FK is to auth.users, not profiles)
      let query = supabase
        .from('trx_cutting_log')
        .select('id, order_name, qty_cut, notes, created_at, operator_id, item_id')
        .order('created_at', { ascending: false })
        .limit(200);

      if (start) query = query.gte('created_at', start);
      if (end) query = query.lte('created_at', end);

      const { data: logs, error } = await query;
      if (error) throw error;

      if (!logs || logs.length === 0) {
        setCuttingLogs([]);
        return;
      }

      // Step 2: Get unique operator IDs and fetch their names from profiles
      const operatorIds = [...new Set(logs.map(l => l.operator_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', operatorIds);

      const profileMap = {};
      (profiles || []).forEach(p => { profileMap[p.id] = p.full_name; });

      // Step 3: Fetch item names for item_id
      const itemIds = [...new Set(logs.map(l => l.item_id).filter(Boolean))];
      let itemMap = {};
      if (itemIds.length > 0) {
        const { data: items } = await supabase
          .from('mst_items')
          .select('id, name, category')
          .in('id', itemIds);
        (items || []).forEach(item => { itemMap[item.id] = item; });
      }

      // Step 4: Merge into logs
      const enriched = logs.map(l => ({
        ...l,
        operator: { full_name: profileMap[l.operator_id] || 'Unknown' },
        item: l.item_id ? (itemMap[l.item_id] || null) : null,
      }));

      setCuttingLogs(enriched);
    } catch (err) {
      console.error("Error fetching cutting logs:", err);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, getTimeFilter]);


  // === TAB 4: Fetch Defects Logs from trx_defects ===
  const fetchDefectsLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const { start, end } = getTimeFilter();
      let query = supabase.from('trx_defects').select(`
          id, order_name, error_source, error_category, quantity, notes, created_at, status,
          profiles!trx_defects_reporter_id_fkey(full_name)
      `).order('created_at', { ascending: false });

      if (start) query = query.gte('created_at', start);
      if (end) query = query.lte('created_at', end);

      const { data, error } = await query;
      if (error) throw error;
      setDefectsLogs(data || []);
    } catch (err) {
      console.error("Error fetching defect logs:", err);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, getTimeFilter]);


  useEffect(() => {
    if (activeTab === 'produksi') {
      fetchReports();
    } else if (activeTab === 'stok') {
      fetchStockLogs();
    } else if (activeTab === 'cutting') {
      fetchCuttingLogs();
    } else if (activeTab === 'kendala') {
      fetchDefectsLogs();
    }
  }, [activeTab, fetchReports, fetchStockLogs, fetchCuttingLogs, fetchDefectsLogs]);

  // === Analytics (Tab 1 only) ===
  const analyticsData = useMemo(() => {
    const grouped = {};
    reports.forEach(r => {
      if (r.qtyDamage <= 0) return;
      const key = chartType === 'operator' ? r.operatorName : r.itemName;
      if (!grouped[key]) grouped[key] = { name: key, totalKerusakan: 0 };
      grouped[key].totalKerusakan += r.qtyDamage;
    });
    return Object.values(grouped).sort((a, b) => b.totalKerusakan - a.totalKerusakan).slice(0, 5);
  }, [reports, chartType]);

  const totalDamage = useMemo(() => reports.reduce((acc, curr) => acc + curr.qtyDamage, 0), [reports]);
  const totalUsed = useMemo(() => reports.reduce((acc, curr) => acc + curr.qtyUsed, 0), [reports]);

  // === Stock Log Stats (Tab 2) ===
  const stockLogStats = useMemo(() => {
    let totalIn = 0, totalOut = 0, totalAudit = 0;
    stockLogs.forEach(log => {
      if (log.source === 'STOCK_IN') totalIn += Math.abs(log.change_amount);
      else if (log.source === 'REPORT_USAGE' || log.source === 'REPORT_DAMAGE') totalOut += Math.abs(log.change_amount);
      else if (log.source === 'AUDIT') totalAudit++;
    });
    return { totalIn, totalOut, totalAudit, totalEntries: stockLogs.length };
  }, [stockLogs]);

  // === Cutting Log Stats (Tab 3) ===
  const cuttingLogStats = useMemo(() => {
    const totalCut = cuttingLogs.reduce((acc, curr) => acc + curr.qty_cut, 0);
    return { totalOrders: cuttingLogs.length, totalCut };
  }, [cuttingLogs]);

  // === Top Bahan Di-Cut Chart Data ===
  const topBahanData = useMemo(() => {
    const grouped = {};
    cuttingLogs.forEach(l => {
      const key = l.item?.name || 'Tidak Diketahui';
      if (!grouped[key]) grouped[key] = { name: key, totalLembar: 0 };
      grouped[key].totalLembar += l.qty_cut;
    });
    return Object.values(grouped).sort((a, b) => b.totalLembar - a.totalLembar).slice(0, 6);
  }, [cuttingLogs]);



  // Export Excel
  const handleExportExcel = () => {
    let worksheet;
    let sheetName = "";
    if (activeTab === 'produksi') {
      sheetName = "Laporan_Produksi";
      worksheet = XLSX.utils.json_to_sheet(reports.map(r => ({
        "Tanggal": r.date, "Tipe": r.type, "Operator": r.operatorName,
        "Item": r.itemName, "Terpakai": r.qtyUsed, "Rusak": r.qtyDamage,
        "Alasan": r.reason || '-', "Stok Akhir": r.finalStock
      })));
    } else if (activeTab === 'stok') {
      sheetName = "Riwayat_Stok";
      worksheet = XLSX.utils.json_to_sheet(stockLogs.map(l => ({
        "Tanggal": new Date(l.created_at).toLocaleString('id-ID'),
        "Item": l.item?.name || '-',
        "Tipe": SOURCE_LABELS[l.source]?.label || l.source,
        "Perubahan": l.change_amount, "Stok Awal": l.previous_stock,
        "Stok Akhir": l.final_stock, "Catatan": l.notes || '-'
      })));
    } else {
      sheetName = "Tracking_Cutting";
      worksheet = XLSX.utils.json_to_sheet(cuttingLogs.map(l => ({
        "Tanggal": new Date(l.created_at).toLocaleString('id-ID'),
        "Order": l.order_name,
        "Bahan": l.item?.name || '-',
        "Lembar Di-Cut": l.qty_cut,
        "Operator": l.operator?.full_name || '-',
        "Catatan": l.notes || '-'
      })));
    }
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `ArsyStok_${sheetName}_${Date.now()}.xlsx`);
  };

  // Hapus Cutting Log (Hanya SPV)
  const handleDeleteCutting = async (id) => {
    if (userRole !== 'SPV') return;
    if (!window.confirm('Yakin ingin menghapus riwayat log cutting ini?')) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.from('trx_cutting_log').delete().eq('id', id);
      if (error) throw error;
      await fetchCuttingLogs();
    } catch (err) {
      console.error('Error in delete cutting log:', err);
      alert(`Gagal menghapus log cutting: ${err.message}`);
    }
  };

  const handleEditCutting = (log) => {
    setEditingCuttingLog({
      id: log.id,
      order_name: log.order_name,
      item_id: log.item_id || '',
      qty_cut: log.qty_cut,
      notes: log.notes || ''
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingCuttingLog) return;

    setIsSavingEdit(true);
    try {
      const { error } = await supabase
        .from('trx_cutting_log')
        .update({
          order_name: editingCuttingLog.order_name,
          item_id: editingCuttingLog.item_id || null, // Handle empty string as null
          qty_cut: parseInt(editingCuttingLog.qty_cut, 10),
          notes: editingCuttingLog.notes
        })
        .eq('id', editingCuttingLog.id);

      if (error) {
        throw new Error(error.message);
      }

      alert('Berhasil: Log Cutting telah diperbarui!');
      setEditingCuttingLog(null);
      await fetchCuttingLogs(); // Refresh the table
    } catch (err) {
      console.error('Error updating cutting log:', err);
      alert(`Gagal menyimpan perubahan log: ${err.message}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Handlers for Editing Defects (Khusus SPV)
  const handleDeleteDefect = async (id) => {
    if (!confirm("Apakah Anda yakin ingin menghapus catatan kendala ini?")) return;
    try {
      const { error } = await supabase.from('trx_defects').delete().eq('id', id);
      if (error) throw error;
      fetchDefectsLogs();
    } catch (error) {
      alert("Gagal menghapus: " + error.message);
    }
  };

  const handleEditDefect = (defect) => {
    setEditingDefect({
      id: defect.id,
      order_name: defect.order_name,
      error_source: defect.error_source,
      error_category: defect.error_category,
      quantity: defect.quantity,
      notes: defect.notes || ''
    });
  };

  const handleSaveDefectEdit = async (e) => {
    e.preventDefault();
    if (!editingDefect) return;
    setIsSavingEdit(true);
    try {
      const { error } = await supabase.from('trx_defects').update({
        order_name: editingDefect.order_name,
        error_source: editingDefect.error_source,
        error_category: editingDefect.error_category,
        quantity: parseFloat(editingDefect.quantity) || 0,
        notes: editingDefect.notes
      }).eq('id', editingDefect.id);
      if (error) throw error;
      alert('Berhasil: Laporan Kendala telah diperbarui!');
      setEditingDefect(null);
      fetchDefectsLogs();
    } catch (err) {
      alert("Gagal menyimpan perubahan: " + err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="w-full animate-in fade-in py-2">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight t-primary mb-2 flex items-center gap-3">
            <FileText className="w-8 h-8 text-brand-amber" />
            Laporan Sistem
          </h2>
          <p className="t-secondary">Analitik kerusakan, riwayat pemakaian, pergerakan stok, dan ekspor data.</p>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => { setActiveTab('produksi'); setSelectedType('ALL'); }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all border ${activeTab === 'produksi' ? 'bg-accent-base/10 text-accent-base border-accent-base/20 shadow-sm' : 't-muted border-transparent hover:bg-accent-base/5'}`}
        >
          <FileText className="w-4 h-4" /> Laporan Produksi
        </button>
        <button
          onClick={() => { setActiveTab('stok'); setSelectedType('ALL'); }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all border ${activeTab === 'stok' ? 'bg-brand-amber/10 text-brand-amber border-brand-amber/20 shadow-sm' : 't-muted border-transparent hover:bg-brand-amber/5'}`}
        >
          <History className="w-4 h-4" /> Riwayat Stok
        </button>
        <button
          onClick={() => { setActiveTab('cutting'); setSelectedType('ALL'); }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all border ${activeTab === 'cutting' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20 shadow-sm' : 't-muted border-transparent hover:bg-blue-500/5'}`}
        >
          <Scissors className="w-4 h-4" /> Tracking Cutting
        </button>
        {userRole !== 'OP_CETAK' && (
          <button
            onClick={() => { setActiveTab('kendala'); setSelectedType('ALL'); }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all border ${activeTab === 'kendala' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20 shadow-sm' : 't-muted border-transparent hover:bg-orange-500/5'}`}
          >
            <AlertTriangle className="w-4 h-4" /> Laporan Kendala
          </button>
        )}
      </div>

      {/* BENTO GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">

        {/* Filters & Actions - Full Width */}
        <div className="glass-card p-5 flex flex-col md:flex-row gap-4 items-center justify-between md:col-span-2 lg:col-span-full xl:col-span-full">
          <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
            <div className="flex flex-col gap-2">
              {/* Mode selector */}
              <div className="flex items-center gap-3 p-2 rounded-xl border" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}>
                <Calendar className="w-5 h-5 text-brand-amber ml-2 shrink-0" />
                <select value={dateRange} onChange={(e) => setDateRange(e.target.value)}
                  className="bg-transparent border-none t-primary text-sm font-medium focus:outline-none focus:ring-0 cursor-pointer appearance-none pr-6"
                >
                  <option value="today" style={{ background: 'var(--select-bg)' }}>Hari Ini</option>
                  <option value="week" style={{ background: 'var(--select-bg)' }}>7 Hari Terakhir</option>
                  <option value="month" style={{ background: 'var(--select-bg)' }}>30 Hari Terakhir</option>
                  <option value="bulan" style={{ background: 'var(--select-bg)' }}>Bulan Tertentu</option>
                  <option value="custom" style={{ background: 'var(--select-bg)' }}>Rentang Custom</option>
                  <option value="all" style={{ background: 'var(--select-bg)' }}>Semua Waktu</option>
                </select>
              </div>

              {/* Month picker */}
              {dateRange === 'bulan' && (
                <div className="flex items-center gap-2 p-2 rounded-xl border animate-in fade-in slide-in-from-top-1 duration-200" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-transparent border-none t-primary text-sm font-medium focus:outline-none focus:ring-0 cursor-pointer w-full"
                  />
                </div>
              )}

              {/* Custom date range picker */}
              {dateRange === 'custom' && (
                <div className="flex flex-col gap-1.5 p-2.5 rounded-xl border animate-in fade-in slide-in-from-top-1 duration-200" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] t-muted uppercase tracking-wider w-10 shrink-0">Dari</span>
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="bg-transparent border-none t-primary text-sm font-medium focus:outline-none focus:ring-0 cursor-pointer flex-1"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] t-muted uppercase tracking-wider w-10 shrink-0">Sampai</span>
                    <input
                      type="date"
                      value={customEnd}
                      min={customStart}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="bg-transparent border-none t-primary text-sm font-medium focus:outline-none focus:ring-0 cursor-pointer flex-1"
                    />
                  </div>
                </div>
              )}

              {/* Informative label */}
              <p className="text-[10px] t-muted font-mono px-1">
                {(() => {
                  const fmt = (d) => d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
                  const now = new Date();
                  if (dateRange === 'today') return `📅 ${fmt(now)}`;
                  if (dateRange === 'week') { const s = new Date(); s.setDate(s.getDate() - 7); return `📅 ${fmt(s)} – ${fmt(now)}`; }
                  if (dateRange === 'month') { const s = new Date(); s.setDate(s.getDate() - 30); return `📅 ${fmt(s)} – ${fmt(now)}`; }
                  if (dateRange === 'bulan' && selectedMonth) {
                    const [y, m] = selectedMonth.split('-').map(Number);
                    const start = new Date(y, m - 1, 1);
                    const end = new Date(y, m, 0);
                    return `📅 ${fmt(start)} – ${fmt(end)}`;
                  }
                  if (dateRange === 'custom') {
                    if (customStart && customEnd) return `📅 ${fmt(new Date(customStart))} – ${fmt(new Date(customEnd))}`;
                    if (customStart) return `📅 Mulai ${fmt(new Date(customStart))}`;
                    return '📅 Pilih tanggal mulai';
                  }
                  return '📅 Semua data yang tersedia';
                })()}
              </p>
            </div>



            <div className="flex items-center gap-3 p-2 rounded-xl border" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}>
              <Filter className="w-5 h-5 text-accent-base ml-2" />
              <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)}
                className="bg-transparent border-none t-primary text-sm font-medium focus:outline-none focus:ring-0 cursor-pointer appearance-none pr-6"
                disabled={activeTab === 'cutting'}
              >
                {activeTab === 'produksi' ? (
                  <>
                    <option value="ALL" style={{ background: 'var(--select-bg)' }}>Semua Tipe</option>
                    <option value="CETAK" style={{ background: 'var(--select-bg)' }}>Cetak</option>
                    <option value="CUTTING" style={{ background: 'var(--select-bg)' }}>Cutting</option>
                  </>
                ) : activeTab === 'stok' ? (
                  <>
                    <option value="ALL" style={{ background: 'var(--select-bg)' }}>Semua Pergerakan</option>
                    <option value="MASUK" style={{ background: 'var(--select-bg)' }}>Stok Masuk</option>
                    <option value="KELUAR" style={{ background: 'var(--select-bg)' }}>Stok Keluar</option>
                    <option value="AUDIT" style={{ background: 'var(--select-bg)' }}>Audit</option>
                  </>
                ) : (
                  <option value="ALL" style={{ background: 'var(--select-bg)' }}>Semua Order</option>
                )}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <button onClick={handleExportExcel}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-accent-base/10 text-accent-base font-medium border border-accent-base/20 rounded-xl hover:bg-accent-base hover:t-on-accent transition-colors">
              <Download className="w-4 h-4" /> Excel
            </button>

          </div>
        </div>

        {/* ========== TAB 1: PRODUKSI ========== */}
        {activeTab === 'produksi' && (
          <>
            {/* 1x1 Card: Total Terpakai */}
            <div className="glass-card p-6 flex flex-col justify-between group cursor-default relative overflow-hidden">
              <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-accent-base/5 rounded-full blur-2xl pointer-events-none transition-all group-hover:bg-accent-base/10"></div>
              <div className="flex items-start justify-between mb-4 relative z-10">
                <div className="p-3 bg-accent-base/10 rounded-2xl text-accent-base border border-accent-base/20 group-hover:bg-accent-base/20 transition-colors">
                  <Package className="w-6 h-6" />
                </div>
              </div>
              <div className="relative z-10">
                <h3 className="t-secondary text-sm font-medium mb-1 uppercase tracking-wider">Total Item Dipakai</h3>
                <div className="text-4xl font-mono font-bold t-primary group-hover:text-accent-base transition-colors">{totalUsed}</div>
              </div>
            </div>

            {/* 1x1 Card: Total Rusak */}
            <div className="glass-card p-6 flex flex-col justify-between group cursor-default relative overflow-hidden">
              <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-brand-red/5 rounded-full blur-2xl pointer-events-none transition-all group-hover:bg-brand-red/10"></div>
              <div className="flex items-start justify-between mb-4 relative z-10">
                <div className="p-3 bg-brand-red/10 rounded-2xl text-brand-red border border-brand-red/20 group-hover:bg-brand-red/20 transition-colors">
                  <AlertTriangle className="w-6 h-6" />
                </div>
              </div>
              <div className="relative z-10">
                <h3 className="t-secondary text-sm font-medium mb-1 uppercase tracking-wider">Total Item Rusak</h3>
                <div className="text-4xl font-mono font-bold t-primary group-hover:text-brand-red transition-colors">{totalDamage}</div>
              </div>
            </div>

            {/* 2x1 Card: Analytics Chart */}
            <div className="glass-card p-6 flex flex-col md:col-span-2 lg:col-span-2 xl:col-span-2 min-h-[300px]">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold t-primary flex items-center gap-2">
                  <PieChartIcon className="w-5 h-5 text-brand-amber" /> Damage Analytics
                </h3>
                <div className="flex rounded-xl p-1 border" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}>
                  <button onClick={() => setChartType('operator')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${chartType === 'operator' ? 'bg-accent-base/20 t-primary shadow-sm' : 't-muted hover:t-secondary'}`}
                  >Operator</button>
                  <button onClick={() => setChartType('item')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${chartType === 'item' ? 'bg-accent-base/20 t-primary shadow-sm' : 't-muted hover:t-secondary'}`}
                  >Item</button>
                </div>
              </div>

              <div className="flex-1 w-full flex items-center justify-center min-h-[200px]">
                {isLoading ? (
                  <div className="w-48 h-48 rounded-full border-4 animate-pulse" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}></div>
                ) : analyticsData.length === 0 ? (
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 border" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}>
                      <PieChartIcon className="w-8 h-8 t-muted" />
                    </div>
                    <p className="t-secondary text-sm">Belum ada data kerusakan pada periode ini.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={analyticsData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="totalKerusakan" nameKey="name" stroke="none">
                        {analyticsData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: 'var(--bg-body)', borderColor: 'var(--border-glass)', borderRadius: '12px', boxShadow: 'var(--shadow-card)' }}
                        itemStyle={{ color: 'var(--text-primary)', fontWeight: 'bold' }}
                      />
                      <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle"
                        formatter={(value) => <span className="t-secondary text-xs font-medium ml-1">{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Produksi History Table */}
            <div className="glass-card overflow-hidden flex flex-col md:col-span-2 lg:col-span-3 xl:col-span-4 min-h-[400px]">
              <div className="p-6 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-glass)' }}>
                <h3 className="font-bold t-primary flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-accent-base" /> Detail Riwayat Laporan
                </h3>
                <span className="text-xs t-muted font-mono">
                  {reports.length} data
                </span>
              </div>

              <div className="flex-1 overflow-x-auto">
                {isLoading ? (
                  <div className="p-12 flex items-center justify-center">
                    <div className="w-8 h-8 border-t-2 border-r-2 border-accent-base rounded-full animate-spin"></div>
                  </div>
                ) : reports.length === 0 ? (
                  <div className="p-12 flex flex-col items-center justify-center text-center h-full border-2 border-dashed mx-2 my-2 rounded-2xl" style={{ borderColor: 'var(--border-glass)' }}>
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 border" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}>
                      <FileText className="w-8 h-8 t-muted" />
                    </div>
                    <h3 className="text-lg font-medium t-primary mb-1">Tidak Ada Data</h3>
                    <p className="t-secondary text-sm max-w-sm">Belum ada laporan produksi yang tercatat pada filter ini.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 pb-2 px-1">
                      {reports.slice(0, visibleReportsCount).map((r, i) => (
                        <div key={r.id || i} className="group flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-surface border border-theme hover:border-accent-base/40 hover:shadow-md transition-all duration-300">
                          {/* Left: Time & Operator */}
                          <div className="flex items-center gap-4 md:w-1/3">
                            <div className="w-12 h-12 rounded-2xl bg-input border border-theme flex flex-col items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                              <span className="text-xs font-bold t-primary">{r.date.split(',')[0].split(' ')[0]}</span>
                              <span className="text-[10px] font-mono t-muted">{r.date.split(',')[0].split(' ')[1]?.substring(0,3)}</span>
                            </div>
                            <div>
                              <p className="text-sm font-bold t-primary flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 t-muted" /> {r.operatorName}
                              </p>
                              <p className="text-[10px] font-mono t-muted mt-1">{r.date.split(',')[1]}</p>
                            </div>
                          </div>
                          
                          {/* Middle: Item Details */}
                          <div className="flex-1">
                            <p className="text-sm font-bold text-accent-base flex items-center gap-1.5 mb-1">
                                <Package className="w-4 h-4 text-accent-base" /> {r.itemName}
                            </p>
                            <span className="inline-block text-[10px] border px-2 py-0.5 rounded-md font-mono tracking-widest bg-input text-secondary border-theme uppercase">
                                {r.type}
                            </span>
                          </div>

                          {/* Right: Quantities */}
                          <div className="flex items-center justify-between md:justify-end gap-4 md:gap-6 mt-3 md:mt-0 pt-3 md:pt-0 border-t border-theme md:border-none w-full md:w-auto">
                            <div className="text-center w-1/3 md:w-auto">
                              <p className="text-[9px] uppercase font-bold t-muted mb-1 opacity-70">Terpakai</p>
                              <p className="text-lg font-mono font-bold t-primary min-w-[40px] leading-none">{r.qtyUsed}</p>
                            </div>
                            <div className="text-center w-1/3 md:w-auto min-w-[50px]">
                              <p className="text-[9px] uppercase font-bold text-brand-red mb-1 opacity-70">Rusak</p>
                              {r.qtyDamage > 0 ? (
                                <span className="text-sm font-mono font-bold text-brand-red bg-brand-red/10 border border-brand-red/20 px-2 py-0.5 rounded-lg shadow-sm whitespace-nowrap">{r.qtyDamage}</span>
                              ) : (
                                <span className="text-xs t-muted leading-[1.75rem]">-</span>
                              )}
                            </div>
                            <div className="text-right w-1/3 md:w-auto md:pl-4 md:pr-1 md:border-l md:border-theme min-w-[70px]">
                              <p className="text-[9px] uppercase font-bold t-secondary mb-1 opacity-70">Sisa Stok</p>
                              <div className="flex items-center justify-end gap-1.5">
                                <span className="text-lg font-mono font-bold text-accent-base leading-none">{r.finalStock != null ? r.finalStock : '-'}</span>
                                {r.finalStock != null && <CheckCircle2 className="w-3 h-3 text-accent-base/50" />}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {/* Load More Button Reports */}
                      {visibleReportsCount < reports.length && (
                        <div className="flex justify-center pt-6 pb-2">
                            <button
                                onClick={() => setVisibleReportsCount(prev => prev + 15)}
                                className="flex items-center gap-2 px-6 py-2.5 bg-surface border border-theme t-primary font-bold text-sm rounded-xl hover:border-accent-base/50 hover:text-accent-base transition-all shadow-sm"
                            >
                                Tampilkan Lebih Banyak ({reports.length - visibleReportsCount} item lagi)
                            </button>
                        </div>
                      )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ========== TAB 2: RIWAYAT STOK ========== */}
        {activeTab === 'stok' && (
          <>
            {/* 1x1 Card: Total Stok Masuk */}
            <div className="glass-card p-6 flex flex-col justify-between group cursor-default relative overflow-hidden">
              <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-accent-base/5 rounded-full blur-2xl pointer-events-none transition-all group-hover:bg-accent-base/10"></div>
              <div className="flex items-start justify-between mb-4 relative z-10">
                <div className="p-3 bg-accent-base/10 rounded-2xl text-accent-base border border-accent-base/20 group-hover:bg-accent-base/20 transition-colors">
                  <ArrowUpCircle className="w-6 h-6" />
                </div>
              </div>
              <div className="relative z-10">
                <h3 className="t-secondary text-sm font-medium mb-1 uppercase tracking-wider">Total Stok Masuk</h3>
                <div className="text-4xl font-mono font-bold t-primary group-hover:text-accent-base transition-colors">+{stockLogStats.totalIn}</div>
              </div>
            </div>

            {/* 1x1 Card: Total Stok Keluar */}
            <div className="glass-card p-6 flex flex-col justify-between group cursor-default relative overflow-hidden">
              <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-brand-red/5 rounded-full blur-2xl pointer-events-none transition-all group-hover:bg-brand-red/10"></div>
              <div className="flex items-start justify-between mb-4 relative z-10">
                <div className="p-3 bg-brand-red/10 rounded-2xl text-brand-red border border-brand-red/20 group-hover:bg-brand-red/20 transition-colors">
                  <ArrowDownCircle className="w-6 h-6" />
                </div>
              </div>
              <div className="relative z-10">
                <h3 className="t-secondary text-sm font-medium mb-1 uppercase tracking-wider">Total Stok Keluar</h3>
                <div className="text-4xl font-mono font-bold t-primary group-hover:text-brand-red transition-colors">-{stockLogStats.totalOut}</div>
              </div>
            </div>

            {/* 1x1 Card: Audit Count */}
            <div className="glass-card p-6 flex flex-col justify-between group cursor-default relative overflow-hidden">
              <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-brand-amber/5 rounded-full blur-2xl pointer-events-none transition-all group-hover:bg-brand-amber/10"></div>
              <div className="flex items-start justify-between mb-4 relative z-10">
                <div className="p-3 bg-brand-amber/10 rounded-2xl text-brand-amber border border-brand-amber/20 group-hover:bg-brand-amber/20 transition-colors">
                  <Settings2 className="w-6 h-6" />
                </div>
              </div>
              <div className="relative z-10">
                <h3 className="t-secondary text-sm font-medium mb-1 uppercase tracking-wider">Audit Dilakukan</h3>
                <div className="text-4xl font-mono font-bold t-primary group-hover:text-brand-amber transition-colors">{stockLogStats.totalAudit}</div>
              </div>
            </div>

            {/* Stock Log Table - Full Width */}
            <div className="glass-card overflow-hidden flex flex-col md:col-span-2 lg:col-span-3 xl:col-span-4 min-h-[400px]">
              <div className="p-6 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-glass)' }}>
                <h3 className="font-bold t-primary flex items-center gap-2">
                  <History className="w-5 h-5 text-brand-amber" /> Seluruh Pergerakan Stok
                </h3>
                <span className="text-xs t-muted font-mono">{stockLogs.length} entri</span>
              </div>

              <div className="flex-1 overflow-x-auto">
                {isLoading ? (
                  <div className="p-12 flex items-center justify-center">
                    <div className="w-8 h-8 border-t-2 border-r-2 border-brand-amber rounded-full animate-spin"></div>
                  </div>
                ) : stockLogs.length === 0 ? (
                  <div className="p-12 flex flex-col items-center justify-center text-center h-full border-2 border-dashed mx-2 my-2 rounded-2xl" style={{ borderColor: 'var(--border-glass)' }}>
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 border" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}>
                      <History className="w-8 h-8 t-muted" />
                    </div>
                    <h3 className="text-lg font-medium t-primary mb-1">Belum Ada Pergerakan</h3>
                    <p className="t-secondary text-sm max-w-sm">Belum ada data stok masuk, keluar, atau audit pada filter ini.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 pb-2 px-1">
                      {stockLogs.slice(0, visibleStockCount).map((log, i) => {
                        const sourceInfo = SOURCE_LABELS[log.source] || { label: log.source, color: 't-muted', bg: 'bg-slate-500/10 border-slate-500/20', icon: FileText };
                        const SourceIcon = sourceInfo.icon;
                        const dateObj = new Date(log.created_at);
                        const isPositive = log.change_amount > 0;
                        
                        return (
                          <div key={log.id || i} className="group flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-surface border border-theme hover:border-brand-amber/40 hover:shadow-md transition-all duration-300">
                             {/* Left: Time */}
                             <div className="flex items-center gap-4 md:w-1/4 min-w-[150px]">
                                <div className={`w-12 h-12 rounded-2xl bg-input border border-theme flex flex-col items-center justify-center shrink-0 group-hover:scale-105 transition-transform ${isPositive ? 'text-accent-base border-accent-base/20' : 'text-brand-red border-brand-red/20'}`}>
                                   {isPositive ? <ArrowUpCircle className="w-4 h-4 mb-0.5 opacity-80"/> : <ArrowDownCircle className="w-4 h-4 mb-0.5 opacity-80"/>}
                                   <span className="text-[9px] font-mono uppercase font-bold">{dateObj.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' })}</span>
                                </div>
                                <div>
                                   <p className="text-sm font-bold t-primary">{dateObj.toLocaleDateString('id-ID', { day:'2-digit', month:'short' })}</p>
                                   <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 mt-1 rounded border tracking-wide ${sourceInfo.bg} ${sourceInfo.color}`}>
                                      <SourceIcon className="w-3 h-3 opacity-70" /> {sourceInfo.label}
                                   </span>
                                </div>
                             </div>

                             {/* Middle: Item Details */}
                             <div className="flex-1 min-w-[180px]">
                                <p className="text-sm font-bold t-primary flex items-center gap-1.5"><Package className="w-4 h-4 text-accent-base opacity-90" /> {log.item?.name || '-'}</p>
                                <p className="text-[11px] t-secondary mt-1 tracking-wide" title={log.notes}>{log.notes || '-'}</p>
                             </div>

                             {/* Right: Quantity changes */}
                             <div className="flex items-center justify-between md:justify-end gap-3 md:gap-5 mt-3 md:mt-0 pt-3 md:pt-0 border-t border-theme md:border-none w-full md:w-auto">
                                <div className="text-left md:text-right w-1/3 md:w-auto">
                                   <p className="text-[9px] uppercase font-bold t-muted mb-1 opacity-70">Perubahan</p>
                                   <span className={`text-xl font-mono font-bold leading-none inline-block ${isPositive ? 'text-accent-base' : 'text-brand-red'}`}>
                                      {isPositive ? `+${log.change_amount}` : log.change_amount}
                                   </span>
                                </div>
                                
                                <div className="hidden md:block w-px h-8 bg-theme mx-2"></div>
                                
                                <div className="flex items-center gap-3 md:gap-4 w-2/3 md:w-auto justify-end">
                                   <div className="text-center opacity-80">
                                      <p className="text-[9px] uppercase font-bold t-secondary mb-1">Awal</p>
                                      <span className="text-sm font-mono t-secondary opacity-75">{log.previous_stock}</span>
                                   </div>
                                   <span className="text-theme font-bold text-xs opacity-50">-&gt;</span>
                                   <div className="text-center bg-input px-3 py-1.5 rounded-xl border border-theme min-w-[60px]">
                                      <p className="text-[9px] uppercase font-bold text-brand-amber mb-0.5 opacity-90">Akhir</p>
                                      <span className="text-base font-mono font-bold t-primary leading-none">{log.final_stock}</span>
                                   </div>
                                </div>
                             </div>
                          </div>
                        );
                      })}

                      {/* Load More Button Stock Logs */}
                      {visibleStockCount < stockLogs.length && (
                        <div className="flex justify-center pt-6 pb-2">
                            <button
                                onClick={() => setVisibleStockCount(prev => prev + 15)}
                                className="flex items-center gap-2 px-6 py-2.5 bg-surface border border-theme t-primary font-bold text-sm rounded-xl hover:border-brand-amber/50 hover:text-brand-amber transition-all shadow-sm"
                            >
                                Tampilkan Lebih Banyak ({stockLogs.length - visibleStockCount} item lagi)
                            </button>
                        </div>
                      )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
        {/* ========== TAB 3: TRACKING CUTTING ========== */}
        {activeTab === 'cutting' && (
          <>
            {/* 1x1 Card: Total Orders */}
            <div className="glass-card p-6 flex flex-col justify-between group cursor-default relative overflow-hidden">
              <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none transition-all group-hover:bg-blue-500/10"></div>
              <div className="flex items-start justify-between mb-4 relative z-10">
                <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500 border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors">
                  <FileText className="w-6 h-6" />
                </div>
              </div>
              <div className="relative z-10">
                <h3 className="t-secondary text-sm font-medium mb-1 uppercase tracking-wider">Total Order Dikerjakan</h3>
                <div className="text-4xl font-mono font-bold t-primary group-hover:text-blue-500 transition-colors">{cuttingLogStats.totalOrders}</div>
              </div>
            </div>

            {/* 1x1 Card: Total Cut */}
            <div className="glass-card p-6 flex flex-col justify-between group cursor-default relative overflow-hidden">
              <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-accent-base/5 rounded-full blur-2xl pointer-events-none transition-all group-hover:bg-accent-base/10"></div>
              <div className="flex items-start justify-between mb-4 relative z-10">
                <div className="p-3 bg-accent-base/10 rounded-2xl text-accent-base border border-accent-base/20 group-hover:bg-accent-base/20 transition-colors">
                  <Scissors className="w-6 h-6" />
                </div>
              </div>
              <div className="relative z-10">
                <h3 className="t-secondary text-sm font-medium mb-1 uppercase tracking-wider">Total Lembar Di-Cut</h3>
                <div className="text-4xl font-mono font-bold t-primary group-hover:text-accent-base transition-colors">{cuttingLogStats.totalCut}</div>
              </div>
            </div>

            {/* 2x1 Card: Top Bahan Di-Cut */}
            <div className="glass-card p-6 md:col-span-2 relative overflow-hidden flex flex-col">
              <h3 className="text-md font-bold t-primary mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-brand-amber" /> Top Bahan Paling Banyak Di-Cut
              </h3>

              <div className="flex-1 min-h-[140px]">
                {topBahanData.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-50">
                    <PieChartIcon className="w-8 h-8 t-muted mb-2" />
                    <p className="text-xs t-secondary text-center">Belum ada data bahan untuk direkap.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={topBahanData} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }} barSize={16}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                      <XAxis type="number" stroke="#64748b" fontSize={11} tickFormatter={(val) => val} />
                      <YAxis dataKey="name" type="category" width={100} stroke="#64748b" fontSize={11} tick={{ fill: '#e2e8f0' }} />
                      <Tooltip
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        contentStyle={{ backgroundColor: 'rgb(2 6 23)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px', color: '#f8fafc' }}
                        itemStyle={{ color: '#f8fafc' }}
                        formatter={(val) => [`${val} Lembar`, "Lembar Di-Cut"]}
                      />
                      <Bar dataKey="totalLembar" radius={[0, 4, 4, 0]}>
                        {topBahanData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Cutting Log Table - Full Width */}
            <div className="glass-card overflow-hidden flex flex-col md:col-span-2 lg:col-span-3 xl:col-span-4 min-h-[400px]">
              <div className="p-6 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-glass)' }}>
                <h3 className="font-bold t-primary flex items-center gap-2">
                  <Scissors className="w-5 h-5 text-blue-500" /> Detail Pergerakan Cutting
                </h3>
                <span className="text-xs t-muted font-mono">{cuttingLogs.length} entri</span>
              </div>

              <div className="flex-1 overflow-x-auto">
                {isLoading ? (
                  <div className="p-12 flex items-center justify-center">
                    <div className="w-8 h-8 border-t-2 border-r-2 border-blue-500 rounded-full animate-spin"></div>
                  </div>
                ) : cuttingLogs.length === 0 ? (
                  <div className="p-12 flex flex-col items-center justify-center text-center h-full border-2 border-dashed mx-2 my-2 rounded-2xl" style={{ borderColor: 'var(--border-glass)' }}>
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 border" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}>
                      <Scissors className="w-8 h-8 t-muted" />
                    </div>
                    <h3 className="text-lg font-medium t-primary mb-1">Belum Ada Data Cutting</h3>
                    <p className="t-secondary text-sm max-w-sm">Belum ada data stiker yang masuk antrian cutting pada filter ini.</p>
                  </div>
                ) : (
                  <>
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="text-xs font-semibold t-muted uppercase tracking-wider" style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border-glass)' }}>
                          <th className="px-6 py-4">Waktu</th>
                          <th className="px-6 py-4">Nama Order</th>
                          <th className="px-6 py-4">Bahan</th>
                          <th className="px-6 py-4">Operator</th>
                          <th className="px-6 py-4 text-center">Lembar Di-Cut</th>
                          <th className="px-6 py-4">Catatan</th>
                          {userRole === 'SPV' && <th className="px-6 py-4 text-center">Aksi (SPV)</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {cuttingLogs.slice(0, visibleCuttingCount).map((log, i) => {
                          return (
                            <tr key={log.id || i} className="hover:bg-blue-500/5 transition-colors" style={{ borderBottom: '1px solid var(--border-glass)' }}>
                              <td className="px-6 py-4">
                                <p className="text-sm font-medium t-secondary">{new Date(log.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</p>
                                <p className="text-xs t-muted font-mono mt-0.5">{new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
                              </td>
                              <td className="px-6 py-4">
                                <p className="text-sm font-semibold t-primary">
                                  {log.order_name}
                                </p>
                              </td>
                              <td className="px-6 py-4">
                                {log.item ? (
                                  <p className="text-sm font-medium text-brand-amber flex items-center gap-1.5">
                                    <Package className="w-3.5 h-3.5" /> {log.item.name}
                                  </p>
                                ) : (
                                  <p className="text-xs t-muted flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-600"></span> Tanpa Data Bahan</p>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <p className="text-sm font-medium t-secondary flex items-center gap-1.5">
                                  <User className="w-3.5 h-3.5 t-muted" /> {log.operator?.full_name || '-'}
                                </p>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className="text-lg font-mono font-bold text-accent-base">
                                  {log.qty_cut}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <p className="text-xs t-muted max-w-[250px] truncate">{log.notes || '-'}</p>
                              </td>
                              {userRole === 'SPV' && (
                                <td className="px-6 py-4 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      onClick={() => handleEditCutting(log)}
                                      className="p-1.5 rounded-lg text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-colors"
                                      title="Edit Log"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteCutting(log.id)}
                                      className="p-1.5 rounded-lg text-brand-red bg-brand-red/10 border border-brand-red/20 hover:bg-brand-red hover:text-white transition-colors"
                                      title="Hapus Log"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    
                    {/* Load More Button Cutting Logs */}
                    {visibleCuttingCount < cuttingLogs.length && (
                      <div className="flex justify-center pt-6 pb-4">
                          <button
                              onClick={() => setVisibleCuttingCount(prev => prev + 15)}
                              className="flex items-center gap-2 px-6 py-2.5 bg-surface border border-theme t-primary font-bold text-sm rounded-xl hover:border-blue-500/50 hover:text-blue-500 transition-all shadow-sm"
                          >
                              Tampilkan Lebih Banyak ({cuttingLogs.length - visibleCuttingCount} item lagi)
                          </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {/* ========== TAB 4: TRACKING KENDALA ========== */}
        {activeTab === 'kendala' && (
          <div className="glass-card overflow-hidden flex flex-col md:col-span-2 lg:col-span-3 xl:col-span-4 min-h-[400px]">
            <div className="p-6 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-glass)' }}>
              <h3 className="font-bold t-primary flex items-center gap-2 text-orange-500">
                <AlertTriangle className="w-5 h-5" /> Detail Laporan Kendala Produksi
              </h3>
              <span className="text-xs t-muted font-mono">
                {defectsLogs.length} data
              </span>
            </div>

            <div className="p-5 flex-1 w-full overflow-x-auto custom-scrollbar">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <div className="w-10 h-10 border-4 rounded-full animate-spin" style={{ borderColor: 'var(--border-glass)', borderTopColor: 'var(--text-primary)' }}></div>
                </div>
              ) : defectsLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 border" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}>
                    <AlertTriangle className="w-8 h-8 t-muted opacity-50" />
                  </div>
                  <h3 className="text-lg font-medium t-primary mb-1">Tidak Ada Laporan Kendala</h3>
                  <p className="t-secondary text-sm max-w-sm">Belum ada pelaporan kendala/cacat produksi pada filter ini.</p>
                </div>
              ) : (
                <>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-xs font-semibold t-muted uppercase tracking-wider" style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border-glass)' }}>
                        <th className="px-6 py-4">Waktu</th>
                        <th className="px-6 py-4">Nama Order</th>
                        <th className="px-6 py-4">Kategori & Pihak</th>
                        <th className="px-6 py-4 text-center">Qty Gagal</th>
                        <th className="px-6 py-4">Catatan</th>
                        {userRole === 'SPV' && <th className="px-6 py-4 text-center">Aksi (SPV)</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {defectsLogs.slice(0, visibleDefectsCount).map((log, i) => (
                        <tr key={log.id || i} className="hover:bg-orange-500/5 transition-colors gap-2" style={{ borderBottom: '1px solid var(--border-glass)' }}>
                          <td className="px-6 py-4">
                            <p className="text-sm font-medium t-secondary">{new Date(log.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</p>
                            <p className="text-xs t-muted font-mono mt-0.5">{new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
                            <p className="text-[10px] t-muted mt-1 uppercase">Oleh: {log.profiles?.full_name}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm font-semibold t-primary">
                              {log.order_name}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/10 text-orange-500 mb-1">
                              {log.error_category}
                            </div>
                            <div className="text-xs t-secondary">Via: <span className="font-semibold text-brand-red">{log.error_source}</span></div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-lg font-mono font-bold text-accent-base">
                              {log.quantity}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-xs t-muted max-w-[250px] truncate">{log.notes || '-'}</p>
                          </td>
                          {userRole === 'SPV' && (
                            <td className="px-6 py-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleEditDefect(log)}
                                  className="p-1.5 rounded-lg text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-colors"
                                  title="Edit Log"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteDefect(log.id)}
                                  className="p-1.5 rounded-lg text-brand-red bg-brand-red/10 border border-brand-red/20 hover:bg-brand-red hover:text-white transition-colors"
                                  title="Hapus Log"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {/* Load More Button Defects Logs */}
                  {visibleDefectsCount < defectsLogs.length && (
                    <div className="flex justify-center pt-6 pb-4">
                        <button
                            onClick={() => setVisibleDefectsCount(prev => prev + 15)}
                            className="flex items-center gap-2 px-6 py-2.5 bg-surface border border-theme t-primary font-bold text-sm rounded-xl hover:border-orange-500/50 hover:text-orange-500 transition-all shadow-sm"
                        >
                            Tampilkan Lebih Banyak ({defectsLogs.length - visibleDefectsCount} item lagi)
                        </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
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

            <form onSubmit={handleSaveDefectEdit} className="space-y-4">
              <p className="text-sm t-secondary mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                Mode Edit SPV. Anda dapat merevisi detail laporan kendala ini.
              </p>

              <div>
                <label className="block text-sm font-medium t-secondary mb-1">Nama Order / Project *</label>
                <input type="text" required className="w-full px-4 py-2.5 rounded-xl border"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }}
                  value={editingDefect.order_name}
                  onChange={(e) => setEditingDefect({ ...editingDefect, order_name: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium t-secondary mb-1">Pihak Terlapor *</label>
                  <select required className="w-full px-4 py-2.5 rounded-xl border"
                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }}
                    value={editingDefect.error_source}
                    onChange={(e) => setEditingDefect({ ...editingDefect, error_source: e.target.value })}>
                    <option value="" disabled>Pilih Pihak</option>
                    {sourcesOptions.map((opt, i) => (
                      <option key={`edit-src-${i}`} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium t-secondary mb-1">Jenis Kendala *</label>
                  <select required className="w-full px-4 py-2.5 rounded-xl border"
                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }}
                    value={editingDefect.error_category}
                    onChange={(e) => setEditingDefect({ ...editingDefect, error_category: e.target.value })}>
                    <option value="" disabled>Pilih Kendala</option>
                    {categoriesOptions.map((opt, i) => (
                      <option key={`edit-cat-${i}`} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium t-secondary mb-1">Jumlah/Estimasi Gagal *</label>
                <input type="number" step="0.01" min="0" required className="w-full px-4 py-2.5 rounded-xl border"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }}
                  value={editingDefect.quantity}
                  onChange={(e) => setEditingDefect({ ...editingDefect, quantity: e.target.value })} />
              </div>

              <div>
                <label className="block text-sm font-medium t-secondary mb-1">Keterangan / Kronologi Singkat</label>
                <textarea className="w-full px-4 py-2.5 rounded-xl border resize-none" rows="3"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }}
                  value={editingDefect.notes}
                  onChange={(e) => setEditingDefect({ ...editingDefect, notes: e.target.value })} />
              </div>

              <div className="flex gap-3 justify-end pt-4 mt-6" style={{ borderTop: '1px solid var(--border-glass)' }}>
                <button type="button" onClick={() => setEditingDefect(null)} className="px-4 py-2 text-sm font-medium rounded-xl t-secondary hover:bg-white/5 transition-colors" disabled={isSavingEdit}>
                  Batal
                </button>
                <button type="submit" disabled={isSavingEdit} className="px-5 py-2 text-sm font-bold text-white bg-blue-500 rounded-xl hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/25 flex items-center justify-center min-w-[120px]">
                  {isSavingEdit ? (
                    <div className="w-5 h-5 border-t-2 border-r-2 border-white rounded-full animate-spin"></div>
                  ) : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Cutting Log Modal (Khusus SPV) */}
      {editingCuttingLog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => !isSavingEdit && setEditingCuttingLog(null)}></div>
          <div className="glass-card w-full max-w-lg p-6 relative z-10 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold t-primary mb-6 flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-emerald-500" />
              Edit Log Cutting
            </h3>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <p className="text-sm t-secondary mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                Mode Edit SPV. Anda dapat merevisi detail laporan cutting ini.
              </p>

              <div>
                <label className="block text-sm font-medium t-secondary mb-1">Nama Order / Project *</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }}
                  value={editingCuttingLog.order_name}
                  onChange={(e) => setEditingCuttingLog({ ...editingCuttingLog, order_name: e.target.value })}
                  placeholder="Misal: Stiker Label Produk A"
                />
              </div>

              <div>
                <label className="block text-sm font-medium t-secondary mb-1">Bahan yang Digunakan</label>
                <select
                  className="w-full px-4 py-2.5 rounded-xl border focus:outline-none"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }}
                  value={editingCuttingLog.item_id}
                  onChange={(e) => setEditingCuttingLog({ ...editingCuttingLog, item_id: e.target.value })}
                >
                  <option value="">-- Pilih Bahan --</option>
                  {materialOptions.map(item => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium t-secondary mb-1">Lembar Di-Cut *</label>
                <input
                  type="number"
                  min="1"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }}
                  value={editingCuttingLog.qty_cut}
                  onChange={(e) => setEditingCuttingLog({ ...editingCuttingLog, qty_cut: parseInt(e.target.value) || '' })}
                  placeholder="Jumlah lembar"
                />
              </div>

              <div>
                <label className="block text-sm font-medium t-secondary mb-1">Catatan Tambahan</label>
                <textarea
                  className="w-full px-4 py-2.5 rounded-xl border resize-none"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }}
                  rows="2"
                  value={editingCuttingLog.notes}
                  onChange={(e) => setEditingCuttingLog({ ...editingCuttingLog, notes: e.target.value })}
                  placeholder="Misal: Ukuran potong khusus..."
                ></textarea>
              </div>

              <div className="flex gap-3 justify-end pt-4 mt-6" style={{ borderTop: '1px solid var(--border-glass)' }}>
                <button
                  type="button"
                  onClick={() => setEditingCuttingLog(null)}
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
