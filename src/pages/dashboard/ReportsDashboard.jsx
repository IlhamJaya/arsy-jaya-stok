
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import {
  FileText, Calendar, Filter, Download,
  BarChart3, PieChart as PieChartIcon, CheckCircle2, User, Package, AlertTriangle,
  ArrowUpCircle, ArrowDownCircle, Settings2, History, Scissors, Trash2, Edit2, Layers, TrendingUp,
  Database, FileWarning
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
  PieChart, Pie
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

function transformReportRow(d) {
  return {
    id: d.id,
    date: new Date(d.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }),
    rawDate: new Date(d.created_at),
    operatorRole: d.operator?.role?.replace('OP_', '') || 'Unknown',
    itemName: d.item?.name || 'Unknown Item',
    itemUnit: d.item?.unit || '-',
    operatorName: d.operator?.full_name || 'Unknown Operator',
    qtyUsed: d.type === 'Usage' ? d.quantity : 0,
    qtyDamage: d.type === 'Damage' ? d.quantity : 0,
    reason: d.notes,
    finalStock: d.item?.stock
  };
}

export default function ReportsDashboard({ userRole }) {
  const [activeTab, setActiveTab] = useState('pemakaian'); // pemakaian | kerusakan | stok | cutting | kendala
  const [materialOptions, setMaterialOptions] = useState([]);
  const [usageReports, setUsageReports] = useState([]);
  const [damageReports, setDamageReports] = useState([]);
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

  useEffect(() => {
    const loadItems = async () => {
      const { data } = await supabase.from('mst_items').select('id, name').order('name');
      setMaterialOptions(data || []);
    };
    loadItems();
  }, []);

  // State untuk Edit Cutting Log (Khusus SPV)
  const [editingCuttingLog, setEditingCuttingLog] = useState(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [cuttingLogs, setCuttingLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExportingPack, setIsExportingPack] = useState(false);

  // State untuk Edit/Hapus Laporan Pemakaian (Khusus SPV)
  const [editingUsageReport, setEditingUsageReport] = useState(null);
  const [isSavingUsageEdit, setIsSavingUsageEdit] = useState(false);

  // UI: custom toast + confirm modal (hindari window.alert/confirm)
  const [toastMessage, setToastMessage] = useState(null); // { text, isError }
  const [confirmDeleteUsageReport, setConfirmDeleteUsageReport] = useState(null); // { id } | null

  const showToast = (message, isError = false) => {
    setToastMessage({ text: message, isError });
    setTimeout(() => setToastMessage(null), 3000);
  };

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
    } else if (dateRange === 'all') {
      return { start: null, end: null };
    }
    return { start: null, end: null };
  }, [dateRange, customStart, customEnd, selectedMonth]);

  const fetchUsageReports = useCallback(async () => {
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
        .eq('type', 'Usage')
        .order('created_at', { ascending: false });

      if (start) query = query.gte('created_at', start);
      if (end) query = query.lte('created_at', end);

      const { data, error } = await query;
      if (error) throw error;
      let transformed = (data || []).map(transformReportRow);
      if (selectedType !== 'ALL') {
        transformed = transformed.filter(
          (r) => r.operatorRole.toUpperCase() === selectedType.toUpperCase()
        );
      }
      setUsageReports(transformed);
    } catch (err) {
      console.error('Error fetching usage reports:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedType, getTimeFilter]);

  const fetchDamageReports = useCallback(async () => {
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
        .eq('type', 'Damage')
        .order('created_at', { ascending: false });

      if (start) query = query.gte('created_at', start);
      if (end) query = query.lte('created_at', end);

      const { data, error } = await query;
      if (error) throw error;
      let transformed = (data || []).map(transformReportRow);
      if (selectedType !== 'ALL') {
        transformed = transformed.filter(
          (r) => r.operatorRole.toUpperCase() === selectedType.toUpperCase()
        );
      }
      setDamageReports(transformed);
    } catch (err) {
      console.error('Error fetching damage reports:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedType, getTimeFilter]);

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
        .limit(800);

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
  }, [selectedType, getTimeFilter]);

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
        .limit(600);

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
      `).order('created_at', { ascending: false }).limit(800);

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
    if (activeTab === 'pemakaian') {
      fetchUsageReports();
    } else if (activeTab === 'kerusakan') {
      fetchDamageReports();
    } else if (activeTab === 'stok') {
      fetchStockLogs();
    } else if (activeTab === 'cutting') {
      fetchCuttingLogs();
    } else if (activeTab === 'kendala') {
      fetchDefectsLogs();
    }
  }, [activeTab, fetchUsageReports, fetchDamageReports, fetchStockLogs, fetchCuttingLogs, fetchDefectsLogs]);

  const damageAnalyticsData = useMemo(() => {
    const grouped = {};
    damageReports.forEach((r) => {
      const key = chartType === 'operator' ? r.operatorName : r.itemName;
      if (!grouped[key]) grouped[key] = { name: key, totalKerusakan: 0 };
      grouped[key].totalKerusakan += r.qtyDamage;
    });
    return Object.values(grouped)
      .sort((a, b) => b.totalKerusakan - a.totalKerusakan)
      .slice(0, 8);
  }, [damageReports, chartType]);

  const usageByItem = useMemo(() => {
    const g = {};
    usageReports.forEach((r) => {
      g[r.itemName] = (g[r.itemName] || 0) + r.qtyUsed;
    });
    return Object.entries(g)
      .map(([name, totalPemakaian]) => ({ name, totalPemakaian }))
      .sort((a, b) => b.totalPemakaian - a.totalPemakaian)
      .slice(0, 8);
  }, [usageReports]);

  const usageByOperator = useMemo(() => {
    const g = {};
    usageReports.forEach((r) => {
      g[r.operatorName] = (g[r.operatorName] || 0) + r.qtyUsed;
    });
    return Object.entries(g)
      .map(([name, totalPemakaian]) => ({ name, totalPemakaian }))
      .sort((a, b) => b.totalPemakaian - a.totalPemakaian)
      .slice(0, 8);
  }, [usageReports]);

  const usageChartBars = useMemo(() => {
    const src = chartType === 'operator' ? usageByOperator : usageByItem;
    return src.map((r) => ({ name: r.name, total: r.totalPemakaian }));
  }, [chartType, usageByOperator, usageByItem]);

  const totalDamage = useMemo(
    () => damageReports.reduce((acc, curr) => acc + curr.qtyDamage, 0),
    [damageReports]
  );
  const totalUsed = useMemo(
    () => usageReports.reduce((acc, curr) => acc + curr.qtyUsed, 0),
    [usageReports]
  );

  const defectCategoryChart = useMemo(() => {
    const g = {};
    defectsLogs.forEach((d) => {
      const k = d.error_category || 'Lainnya';
      g[k] = (g[k] || 0) + Number(d.quantity || 0);
    });
    return Object.entries(g)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [defectsLogs]);

  const defectTotals = useMemo(
    () => ({
      qty: defectsLogs.reduce((a, d) => a + Number(d.quantity || 0), 0),
      rows: defectsLogs.length,
    }),
    [defectsLogs]
  );

  const stockMovementBySource = useMemo(() => {
    const c = { STOCK_IN: 0, REPORT_USAGE: 0, REPORT_DAMAGE: 0, AUDIT: 0 };
    stockLogs.forEach((l) => {
      if (c[l.source] !== undefined) c[l.source]++;
    });
    return [
      { name: 'Stok masuk', key: 'STOCK_IN', count: c.STOCK_IN, fill: '#06b6d4' },
      { name: 'Keluar (pakai)', key: 'REPORT_USAGE', count: c.REPORT_USAGE, fill: '#3b82f6' },
      { name: 'Keluar (rusak)', key: 'REPORT_DAMAGE', count: c.REPORT_DAMAGE, fill: '#ef4444' },
      { name: 'Audit', key: 'AUDIT', count: c.AUDIT, fill: '#f59e0b' },
    ];
  }, [stockLogs]);

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



  const getExportSlug = () => {
    if (dateRange === 'today') return 'hari_ini';
    if (dateRange === 'week') return '7_hari';
    if (dateRange === 'month') return '30_hari';
    if (dateRange === 'bulan') return `bulan_${selectedMonth}`;
    if (dateRange === 'custom' && customStart && customEnd) return `${customStart}_${customEnd}`;
    if (dateRange === 'custom' && customStart) return `dari_${customStart}`;
    if (dateRange === 'all') return 'semua_waktu';
    return 'export';
  };

  const getPeriodDescription = () => {
    const fmt = (d) =>
      d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    const now = new Date();
    if (dateRange === 'today') return fmt(now);
    if (dateRange === 'week') {
      const s = new Date();
      s.setDate(s.getDate() - 7);
      return `${fmt(s)} – ${fmt(now)}`;
    }
    if (dateRange === 'month') {
      const s = new Date();
      s.setDate(s.getDate() - 30);
      return `${fmt(s)} – ${fmt(now)}`;
    }
    if (dateRange === 'bulan' && selectedMonth) {
      const [y, m] = selectedMonth.split('-').map(Number);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0);
      return `${fmt(start)} – ${fmt(end)}`;
    }
    if (dateRange === 'custom') {
      if (customStart && customEnd) return `${fmt(new Date(customStart))} – ${fmt(new Date(customEnd))}`;
      if (customStart) return `Mulai ${fmt(new Date(customStart))}`;
      return 'Rentang custom (lengkapi tanggal)';
    }
    if (dateRange === 'all') return 'Semua data tersedia';
    return '-';
  };

  const safeSheetName = (name) => name.replace(/[:\\/?*[\]]/g, '').slice(0, 31);

  const handleExportExcel = () => {
    const slug = getExportSlug();
    const ts = Date.now();
    const workbook = XLSX.utils.book_new();

    if (activeTab === 'pemakaian') {
      const ws = XLSX.utils.json_to_sheet(
        usageReports.map((r) => ({
          Tanggal: r.date,
          Operator: r.operatorName,
          Peran_operator: r.operatorRole,
          Item: r.itemName,
          Satuan: r.itemUnit,
          Qty_pemakaian: r.qtyUsed,
          Catatan: r.reason || '-',
          Stok_akhir_sistem: r.finalStock,
        }))
      );
      XLSX.utils.book_append_sheet(workbook, ws, safeSheetName('Pemakaian'));
      XLSX.writeFile(workbook, `ArsyStok_Pemakaian_${slug}_${ts}.xlsx`);
      return;
    }

    if (activeTab === 'kerusakan') {
      const ws = XLSX.utils.json_to_sheet(
        damageReports.map((r) => ({
          Tanggal: r.date,
          Operator: r.operatorName,
          Peran_operator: r.operatorRole,
          Item: r.itemName,
          Satuan: r.itemUnit,
          Qty_kerusakan: r.qtyDamage,
          Catatan: r.reason || '-',
          Stok_akhir_sistem: r.finalStock,
        }))
      );
      XLSX.utils.book_append_sheet(workbook, ws, safeSheetName('Kerusakan'));
      XLSX.writeFile(workbook, `ArsyStok_Kerusakan_${slug}_${ts}.xlsx`);
      return;
    }

    if (activeTab === 'stok') {
      const ws = XLSX.utils.json_to_sheet(
        stockLogs.map((l) => ({
          Tanggal: new Date(l.created_at).toLocaleString('id-ID'),
          Item: l.item?.name || '-',
          Proses: SOURCE_LABELS[l.source]?.label || l.source,
          Perubahan: l.change_amount,
          Stok_awal: l.previous_stock,
          Stok_akhir: l.final_stock,
          Catatan: l.notes || '-',
        }))
      );
      XLSX.utils.book_append_sheet(workbook, ws, safeSheetName('Pergerakan_stok'));
      XLSX.writeFile(workbook, `ArsyStok_PergerakanStok_${slug}_${ts}.xlsx`);
      return;
    }

    if (activeTab === 'cutting') {
      const ws = XLSX.utils.json_to_sheet(
        cuttingLogs.map((l) => ({
          Tanggal: new Date(l.created_at).toLocaleString('id-ID'),
          Order: l.order_name,
          Bahan: l.item?.name || '-',
          Lembar_di_cut: l.qty_cut,
          Operator: l.operator?.full_name || '-',
          Catatan: l.notes || '-',
        }))
      );
      XLSX.utils.book_append_sheet(workbook, ws, safeSheetName('Cutting'));
      XLSX.writeFile(workbook, `ArsyStok_Cutting_${slug}_${ts}.xlsx`);
      return;
    }

    if (activeTab === 'kendala') {
      const ws = XLSX.utils.json_to_sheet(
        defectsLogs.map((d) => ({
          Tanggal: new Date(d.created_at).toLocaleString('id-ID'),
          Order: d.order_name,
          Pihak_sumber: d.error_source,
          Kategori: d.error_category,
          Qty_gagal: d.quantity,
          Pelapor: d.profiles?.full_name || '-',
          Status: d.status || '-',
          Catatan: d.notes || '-',
        }))
      );
      XLSX.utils.book_append_sheet(workbook, ws, safeSheetName('Kendala'));
      XLSX.writeFile(workbook, `ArsyStok_Kendala_${slug}_${ts}.xlsx`);
      return;
    }
  };

  const handleExportFullPackage = async () => {
    setIsExportingPack(true);
    try {
      const { start, end } = getTimeFilter();
      const applyRange = (q) => {
        if (start) q = q.gte('created_at', start);
        if (end) q = q.lte('created_at', end);
        return q;
      };

      let qU = supabase
        .from('trx_reports')
        .select(
          `id, type, quantity, notes, created_at, item:mst_items(name, unit, stock), operator:profiles!trx_reports_operator_id_fkey(full_name, role)`
        )
        .eq('status', 'Approved')
        .eq('type', 'Usage')
        .order('created_at', { ascending: false })
        .limit(8000);
      qU = applyRange(qU);

      let qD = supabase
        .from('trx_reports')
        .select(
          `id, type, quantity, notes, created_at, item:mst_items(name, unit, stock), operator:profiles!trx_reports_operator_id_fkey(full_name, role)`
        )
        .eq('status', 'Approved')
        .eq('type', 'Damage')
        .order('created_at', { ascending: false })
        .limit(8000);
      qD = applyRange(qD);

      let qS = supabase
        .from('trx_stock_log')
        .select(
          `id, change_amount, previous_stock, final_stock, source, notes, created_at, item:mst_items(name, unit)`
        )
        .order('created_at', { ascending: false })
        .limit(8000);
      qS = applyRange(qS);

      let qC = supabase
        .from('trx_cutting_log')
        .select('id, order_name, qty_cut, notes, created_at, operator_id, item_id')
        .order('created_at', { ascending: false })
        .limit(8000);
      qC = applyRange(qC);

      let qK = supabase
        .from('trx_defects')
        .select(
          `id, order_name, error_source, error_category, quantity, notes, created_at, status, profiles!trx_defects_reporter_id_fkey(full_name)`
        )
        .order('created_at', { ascending: false })
        .limit(8000);
      qK = applyRange(qK);

      const [
        { data: dataU, error: eU },
        { data: dataD, error: eD },
        { data: dataS, error: eS },
        { data: logsC, error: eC },
        { data: dataK, error: eK },
      ] = await Promise.all([qU, qD, qS, qC, qK]);

      if (eU) throw eU;
      if (eD) throw eD;
      if (eS) throw eS;
      if (eC) throw eC;
      if (eK) throw eK;

      let enrichedCut = [];
      if (logsC && logsC.length > 0) {
        const operatorIds = [...new Set(logsC.map((l) => l.operator_id))];
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', operatorIds);
        const profileMap = {};
        (profiles || []).forEach((p) => {
          profileMap[p.id] = p.full_name;
        });
        const itemIds = [...new Set(logsC.map((l) => l.item_id).filter(Boolean))];
        let itemMap = {};
        if (itemIds.length > 0) {
          const { data: items } = await supabase.from('mst_items').select('id, name').in('id', itemIds);
          (items || []).forEach((it) => {
            itemMap[it.id] = it.name;
          });
        }
        enrichedCut = logsC.map((l) => ({
          ...l,
          operator_name: profileMap[l.operator_id] || '-',
          bahan: l.item_id ? itemMap[l.item_id] || '-' : '-',
        }));
      }

      const rowsU = (dataU || []).map(transformReportRow);
      const rowsD = (dataD || []).map(transformReportRow);
      const totalU = rowsU.reduce((a, r) => a + r.qtyUsed, 0);
      const totalD = rowsD.reduce((a, r) => a + r.qtyDamage, 0);
      const slug = getExportSlug();
      const ts = Date.now();
      const wb = XLSX.utils.book_new();

      const summaryRows = [
        { Keterangan: 'Periode', Nilai: getPeriodDescription() },
        { Keterangan: 'Baris pemakaian', Nilai: rowsU.length },
        { Keterangan: 'Total qty pemakaian', Nilai: totalU },
        { Keterangan: 'Baris kerusakan', Nilai: rowsD.length },
        { Keterangan: 'Total qty kerusakan', Nilai: totalD },
        { Keterangan: 'Baris pergerakan stok', Nilai: (dataS || []).length },
        { Keterangan: 'Baris cutting', Nilai: enrichedCut.length },
        { Keterangan: 'Baris kendala', Nilai: (dataK || []).length },
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), safeSheetName('Ringkasan'));

      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          rowsU.map((r) => ({
            Tanggal: r.date,
            Operator: r.operatorName,
            Peran: r.operatorRole,
            Item: r.itemName,
            Satuan: r.itemUnit,
            Qty_pemakaian: r.qtyUsed,
            Catatan: r.reason || '-',
            Stok_akhir: r.finalStock,
          }))
        ),
        safeSheetName('Pemakaian')
      );

      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          rowsD.map((r) => ({
            Tanggal: r.date,
            Operator: r.operatorName,
            Peran: r.operatorRole,
            Item: r.itemName,
            Satuan: r.itemUnit,
            Qty_kerusakan: r.qtyDamage,
            Catatan: r.reason || '-',
            Stok_akhir: r.finalStock,
          }))
        ),
        safeSheetName('Kerusakan')
      );

      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          (dataS || []).map((l) => ({
            Tanggal: new Date(l.created_at).toLocaleString('id-ID'),
            Item: l.item?.name || '-',
            Proses: SOURCE_LABELS[l.source]?.label || l.source,
            Perubahan: l.change_amount,
            Stok_awal: l.previous_stock,
            Stok_akhir: l.final_stock,
            Catatan: l.notes || '-',
          }))
        ),
        safeSheetName('Pergerakan_stok')
      );

      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          enrichedCut.map((l) => ({
            Tanggal: new Date(l.created_at).toLocaleString('id-ID'),
            Order: l.order_name,
            Bahan: l.bahan,
            Lembar_di_cut: l.qty_cut,
            Operator: l.operator_name,
            Catatan: l.notes || '-',
          }))
        ),
        safeSheetName('Cutting')
      );

      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          (dataK || []).map((d) => ({
            Tanggal: new Date(d.created_at).toLocaleString('id-ID'),
            Order: d.order_name,
            Pihak: d.error_source,
            Kategori: d.error_category,
            Qty_gagal: d.quantity,
            Pelapor: d.profiles?.full_name || '-',
            Status: d.status || '-',
            Catatan: d.notes || '-',
          }))
        ),
        safeSheetName('Kendala')
      );

      XLSX.writeFile(wb, `ArsyStok_PaketSemuaProses_${slug}_${ts}.xlsx`);
    } catch (err) {
      console.error('Export paket:', err);
      alert(`Gagal mengekspor paket: ${err.message}`);
    } finally {
      setIsExportingPack(false);
    }
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

  // Handlers untuk Edit/Hapus Laporan Pemakaian (Khusus SPV)
  const handleEditUsageReport = (report) => {
    setEditingUsageReport({
      id: report.id,
      itemName: report.itemName,
      itemUnit: report.itemUnit,
      qtyUsed: report.qtyUsed,
      operatorName: report.operatorName,
      operatorRole: report.operatorRole,
      date: report.date,
      notes: report.reason || '',
    });
  };

  const handleDeleteUsageReport = (id) => {
    if (userRole !== 'SPV') return;
    setConfirmDeleteUsageReport({ id });
  };

  const handleSaveUsageReportEdit = async (e) => {
    e.preventDefault();
    if (!editingUsageReport) return;

    setIsSavingUsageEdit(true);
    try {
      const { error } = await supabase.rpc('spv_update_trx_report_notes', {
        p_report_id: editingUsageReport.id,
        p_notes: editingUsageReport.notes || null,
      });
      if (error) throw error;

      showToast('Berhasil: Laporan pemakaian diperbarui!');
      setEditingUsageReport(null);
      await fetchUsageReports();
    } catch (err) {
      console.error('Error saving usage report edit:', err);
      showToast(`Gagal menyimpan perubahan: ${err.message}`, true);
    } finally {
      setIsSavingUsageEdit(false);
    }
  };

  const confirmDeleteUsage = async () => {
    if (!confirmDeleteUsageReport) return;
    const id = confirmDeleteUsageReport.id;
    setConfirmDeleteUsageReport(null);

    setIsLoading(true);
    try {
      const { error } = await supabase.rpc('spv_delete_trx_report_and_restore_stock', {
        p_report_id: id,
      });
      if (error) throw error;

      await fetchUsageReports();
      showToast('Berhasil: Laporan pemakaian dihapus dan stok direstore.');
    } catch (err) {
      console.error('Error deleting usage report:', err);
      showToast(`Gagal menghapus laporan pemakaian: ${err.message}`, true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full animate-in fade-in py-2">
      {toastMessage && (
        <div
          className={`fixed top-6 right-6 z-[120] px-6 py-4 rounded-xl flex items-center gap-3 shadow-lg border animate-in slide-in-from-top-5 duration-300 ${
            toastMessage.isError
              ? 'bg-brand-red/10 border-brand-red/20 text-brand-red'
              : 'bg-accent-base/10 border-accent-base/20 text-accent-base'
          }`}
        >
          {toastMessage.isError ? (
            <AlertTriangle className="w-5 h-5 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          )}
          <p className="font-semibold text-sm">{toastMessage.text}</p>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight t-primary mb-2 flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-brand-amber" />
            Analisis & ekspor laporan
          </h2>
          <p className="t-secondary max-w-2xl">
            Satu halaman per <strong className="t-primary font-semibold">jenis proses</strong>: pemakaian material, kerusakan, pergerakan stok (masuk/keluar/audit), cutting, dan kendala QC.
            Pilih periode, baca ringkasan dan grafik, lalu unduh Excel per tab atau paket multi-sheet.
          </p>
        </div>
      </div>

      {/* Proses — satu tab = satu laporan */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          type="button"
          onClick={() => { setActiveTab('pemakaian'); setSelectedType('ALL'); }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all border ${activeTab === 'pemakaian' ? 'bg-sky-500/10 text-sky-400 border-sky-500/25 shadow-sm' : 't-muted border-transparent hover:bg-sky-500/5'}`}
        >
          <ArrowDownCircle className="w-4 h-4 shrink-0" /> Pemakaian
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('kerusakan'); setSelectedType('ALL'); }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all border ${activeTab === 'kerusakan' ? 'bg-brand-red/10 text-brand-red border-brand-red/25 shadow-sm' : 't-muted border-transparent hover:bg-brand-red/5'}`}
        >
          <AlertTriangle className="w-4 h-4 shrink-0" /> Kerusakan
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('stok'); setSelectedType('ALL'); }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all border ${activeTab === 'stok' ? 'bg-brand-amber/10 text-brand-amber border-brand-amber/20 shadow-sm' : 't-muted border-transparent hover:bg-brand-amber/5'}`}
        >
          <Database className="w-4 h-4 shrink-0" /> Pergerakan stok
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('cutting'); setSelectedType('ALL'); }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all border ${activeTab === 'cutting' ? 'bg-violet-500/10 text-violet-400 border-violet-500/25 shadow-sm' : 't-muted border-transparent hover:bg-violet-500/5'}`}
        >
          <Scissors className="w-4 h-4 shrink-0" /> Cutting
        </button>
        {userRole !== 'OP_CETAK' && (
          <button
            type="button"
            onClick={() => { setActiveTab('kendala'); setSelectedType('ALL'); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all border ${activeTab === 'kendala' ? 'bg-orange-500/10 text-orange-500 border-orange-500/25 shadow-sm' : 't-muted border-transparent hover:bg-orange-500/5'}`}
          >
            <FileWarning className="w-4 h-4 shrink-0" /> Kendala QC
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
                  if (dateRange === 'all') return '📅 Semua waktu (bisa berat)';
                  return '📅 Semua data yang tersedia';
                })()}
              </p>
            </div>

            <div className="hidden lg:flex flex-col justify-end min-w-[200px] max-w-sm">
              <p className="text-[10px] font-semibold t-muted uppercase tracking-wider mb-1">Proses aktif</p>
              <p className="text-xs t-secondary leading-snug">
                {activeTab === 'pemakaian' && 'Laporan tipe Usage (sudah disetujui). Filter peran = divisi operator.'}
                {activeTab === 'kerusakan' && 'Laporan tipe Damage. Cocok untuk analisis reject & waste per item/operator.'}
                {activeTab === 'stok' && 'Log sistem: stok masuk, keluar dari laporan, dan koreksi audit.'}
                {activeTab === 'cutting' && 'Order cutting & lembar terpotong per operator.'}
                {activeTab === 'kendala' && 'QC: sumber error, kategori, dan estimasi qty gagal.'}
              </p>
            </div>

            <div className="flex items-center gap-3 p-2 rounded-xl border" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}>
              <Filter className="w-5 h-5 text-accent-base ml-2 shrink-0" />
              <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)}
                className="bg-transparent border-none t-primary text-sm font-medium focus:outline-none focus:ring-0 cursor-pointer appearance-none pr-6 min-w-[8rem]"
                disabled={activeTab === 'cutting' || activeTab === 'kendala'}
              >
                {(activeTab === 'pemakaian' || activeTab === 'kerusakan') ? (
                  <>
                    <option value="ALL" style={{ background: 'var(--select-bg)' }}>Semua operator</option>
                    <option value="CETAK" style={{ background: 'var(--select-bg)' }}>Cetak</option>
                    <option value="CUTTING" style={{ background: 'var(--select-bg)' }}>Cutting</option>
                  </>
                ) : activeTab === 'stok' ? (
                  <>
                    <option value="ALL" style={{ background: 'var(--select-bg)' }}>Semua pergerakan</option>
                    <option value="MASUK" style={{ background: 'var(--select-bg)' }}>Stok masuk</option>
                    <option value="KELUAR" style={{ background: 'var(--select-bg)' }}>Stok keluar (laporan)</option>
                    <option value="AUDIT" style={{ background: 'var(--select-bg)' }}>Audit / opname</option>
                  </>
                ) : (
                  <option value="ALL" style={{ background: 'var(--select-bg)' }}>—</option>
                )}
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
            <button type="button" onClick={handleExportExcel}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-accent-base/10 text-accent-base font-medium border border-accent-base/20 rounded-xl hover:bg-accent-base hover:t-on-accent transition-colors text-sm">
              <Download className="w-4 h-4 shrink-0" /> Excel (tab ini)
            </button>
            <button type="button" onClick={handleExportFullPackage} disabled={isExportingPack}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-amber/10 text-brand-amber font-medium border border-brand-amber/25 rounded-xl hover:bg-brand-amber/20 transition-colors text-sm disabled:opacity-50">
              {isExportingPack ? (
                <span className="w-4 h-4 border-2 border-brand-amber border-t-transparent rounded-full animate-spin shrink-0" />
              ) : (
                <Layers className="w-4 h-4 shrink-0" />
              )}
              Paket semua proses
            </button>
          </div>
        </div>

        {/* ========== PEMAKAIAN (trx_reports type Usage) ========== */}
        {activeTab === 'pemakaian' && (
          <>
            <div className="glass-card p-6 flex flex-col justify-between group cursor-default relative overflow-hidden">
              <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-sky-500/5 rounded-full blur-2xl pointer-events-none transition-all group-hover:bg-sky-500/10" />
              <div className="flex items-start justify-between mb-4 relative z-10">
                <div className="p-3 bg-sky-500/10 rounded-2xl text-sky-400 border border-sky-500/20 group-hover:bg-sky-500/20 transition-colors">
                  <TrendingUp className="w-6 h-6" />
                </div>
              </div>
              <div className="relative z-10">
                <h3 className="t-secondary text-sm font-medium mb-1 uppercase tracking-wider">Total qty pemakaian</h3>
                <div className="text-4xl font-mono font-bold t-primary group-hover:text-sky-400 transition-colors">{totalUsed}</div>
                <p className="text-[11px] t-muted mt-2">Penjumlahan quantity laporan pemakaian (approved).</p>
              </div>
            </div>

            <div className="glass-card p-6 flex flex-col justify-between group cursor-default relative overflow-hidden">
              <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-accent-base/5 rounded-full blur-2xl pointer-events-none transition-all group-hover:bg-accent-base/10" />
              <div className="flex items-start justify-between mb-4 relative z-10">
                <div className="p-3 bg-accent-base/10 rounded-2xl text-accent-base border border-accent-base/20">
                  <FileText className="w-6 h-6" />
                </div>
              </div>
              <div className="relative z-10">
                <h3 className="t-secondary text-sm font-medium mb-1 uppercase tracking-wider">Jumlah entri</h3>
                <div className="text-4xl font-mono font-bold t-primary">{usageReports.length}</div>
                <p className="text-[11px] t-muted mt-2">Baris laporan pada filter ini.</p>
              </div>
            </div>

            <div className="glass-card p-6 flex flex-col justify-between group cursor-default relative overflow-hidden">
              <div className="flex items-start justify-between mb-4 relative z-10">
                <div className="p-3 bg-input rounded-2xl border border-theme">
                  <Package className="w-6 h-6 t-secondary" />
                </div>
              </div>
              <div className="relative z-10">
                <h3 className="t-secondary text-sm font-medium mb-1 uppercase tracking-wider">Rata-rata / entri</h3>
                <div className="text-4xl font-mono font-bold t-primary">
                  {usageReports.length > 0 ? (totalUsed / usageReports.length).toFixed(2) : '—'}
                </div>
                <p className="text-[11px] t-muted mt-2">Membantu melihat intensitas per transaksi.</p>
              </div>
            </div>

            <div className="glass-card p-6 flex flex-col md:col-span-2 lg:col-span-2 xl:col-span-2 min-h-[300px]">
              <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <h3 className="font-bold t-primary flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-sky-400" /> Top pemakaian
                </h3>
                <div className="flex rounded-xl p-1 border" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}>
                  <button type="button" onClick={() => setChartType('operator')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${chartType === 'operator' ? 'bg-sky-500/20 t-primary shadow-sm' : 't-muted hover:t-secondary'}`}
                  >Operator</button>
                  <button type="button" onClick={() => setChartType('item')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${chartType === 'item' ? 'bg-sky-500/20 t-primary shadow-sm' : 't-muted hover:t-secondary'}`}
                  >Item</button>
                </div>
              </div>
              <div className="flex-1 w-full min-h-[200px]">
                {isLoading ? (
                  <div className="h-[200px] rounded-xl animate-pulse" style={{ background: 'var(--bg-input)' }} />
                ) : usageChartBars.length === 0 ? (
                  <div className="text-center py-12">
                    <BarChart3 className="w-10 h-10 t-muted mx-auto mb-3 opacity-50" />
                    <p className="t-secondary text-sm">Belum ada data pemakaian pada periode ini.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={usageChartBars} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }} barSize={14}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.06)" />
                      <XAxis type="number" stroke="#64748b" fontSize={11} />
                      <YAxis dataKey="name" type="category" width={110} stroke="#64748b" fontSize={11} tick={{ fill: 'var(--text-secondary)' }} />
                      <Tooltip
                        cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                        contentStyle={{ backgroundColor: 'var(--bg-body)', border: '1px solid var(--border-glass)', borderRadius: '12px', fontSize: '12px' }}
                        formatter={(v) => [`${v} qty`, 'Pemakaian']}
                      />
                      <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                        {usageChartBars.map((_, index) => (
                          <Cell key={`u-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="glass-card overflow-hidden flex flex-col md:col-span-2 lg:col-span-3 xl:col-span-4 min-h-[400px]">
              <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2" style={{ borderBottom: '1px solid var(--border-glass)' }}>
                <h3 className="font-bold t-primary flex items-center gap-2">
                  <ArrowDownCircle className="w-5 h-5 text-sky-400" /> Detail laporan pemakaian
                </h3>
                <span className="text-xs t-muted font-mono">{usageReports.length} baris</span>
              </div>
              <div className="flex-1 overflow-x-auto">
                {isLoading ? (
                  <div className="p-12 flex items-center justify-center">
                    <div className="w-8 h-8 border-t-2 border-r-2 border-sky-400 rounded-full animate-spin" />
                  </div>
                ) : usageReports.length === 0 ? (
                  <div className="p-12 flex flex-col items-center justify-center text-center border-2 border-dashed mx-2 my-2 rounded-2xl" style={{ borderColor: 'var(--border-glass)' }}>
                    <FileText className="w-8 h-8 t-muted mb-3" />
                    <p className="t-secondary text-sm">Tidak ada laporan pemakaian untuk filter ini.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 pb-2 px-1">
                    {usageReports.slice(0, visibleReportsCount).map((r, i) => (
                      <div key={r.id || i} className="group flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-surface border border-theme hover:border-sky-500/30 transition-all">
                        <div className="flex items-center gap-4 md:w-1/3">
                          <div className="w-12 h-12 rounded-2xl bg-input border border-theme flex flex-col items-center justify-center shrink-0">
                            <span className="text-xs font-bold t-primary">{r.date.split(',')[0].split(' ')[0]}</span>
                            <span className="text-[10px] font-mono t-muted">{r.date.split(',')[0].split(' ')[1]?.substring(0, 3)}</span>
                          </div>
                          <div>
                            <p className="text-sm font-bold t-primary flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 t-muted" /> {r.operatorName}
                            </p>
                            <span className="text-[10px] font-mono t-muted uppercase mt-1 inline-block">{r.operatorRole}</span>
                            <p className="text-[10px] font-mono t-muted mt-0.5">{r.date.split(',')[1]}</p>
                          </div>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-sky-400 flex items-center gap-1.5 mb-1">
                            <Package className="w-4 h-4" /> {r.itemName}
                          </p>
                          {r.reason ? (
                            <p className="text-[11px] t-secondary line-clamp-2">{r.reason}</p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-6 justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-theme">
                          <div className="text-center">
                            <p className="text-[9px] uppercase font-bold t-muted mb-1">Qty</p>
                            <span className="text-xl font-mono font-bold text-sky-400">{r.qtyUsed}</span>
                            <span className="text-xs t-muted ml-1">{r.itemUnit}</span>
                          </div>
                          <div className="text-right min-w-[72px]">
                            <p className="text-[9px] uppercase font-bold t-muted mb-1">Stok akhir</p>
                            <span className="text-lg font-mono font-bold t-primary">{r.finalStock != null ? r.finalStock : '—'}</span>
                          </div>
                        </div>
                        {userRole === 'SPV' && (
                          <div className="flex justify-end gap-2 mt-3">
                            <button
                              type="button"
                              onClick={() => handleEditUsageReport(r)}
                              className="p-1.5 rounded-lg text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-colors"
                              title="Edit Laporan Pemakaian"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteUsageReport(r.id)}
                              className="p-1.5 rounded-lg text-brand-red bg-brand-red/10 border border-brand-red/20 hover:bg-brand-red hover:text-white transition-colors"
                              title="Hapus Laporan Pemakaian"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    {visibleReportsCount < usageReports.length && (
                      <div className="flex justify-center pt-6 pb-2">
                        <button type="button" onClick={() => setVisibleReportsCount((p) => p + 15)} className="px-6 py-2.5 bg-surface border border-theme t-primary font-bold text-sm rounded-xl hover:border-sky-500/50 hover:text-sky-400 transition-all">
                          Tampilkan lebih banyak ({usageReports.length - visibleReportsCount})
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ========== KERUSAKAN (trx_reports type Damage) ========== */}
        {activeTab === 'kerusakan' && (
          <>
            <div className="glass-card p-6 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-brand-red/5 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-start justify-between mb-4 relative z-10">
                <div className="p-3 bg-brand-red/10 rounded-2xl text-brand-red border border-brand-red/20">
                  <AlertTriangle className="w-6 h-6" />
                </div>
              </div>
              <div className="relative z-10">
                <h3 className="t-secondary text-sm font-medium mb-1 uppercase tracking-wider">Total qty kerusakan</h3>
                <div className="text-4xl font-mono font-bold t-primary text-brand-red">{totalDamage}</div>
                <p className="text-[11px] t-muted mt-2">Material yang dilaporkan rusak (approved).</p>
              </div>
            </div>

            <div className="glass-card p-6 flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-start justify-between mb-4 relative z-10">
                <div className="p-3 bg-brand-amber/10 rounded-2xl text-brand-amber border border-brand-amber/20">
                  <FileText className="w-6 h-6" />
                </div>
              </div>
              <div className="relative z-10">
                <h3 className="t-secondary text-sm font-medium mb-1 uppercase tracking-wider">Jumlah laporan</h3>
                <div className="text-4xl font-mono font-bold t-primary">{damageReports.length}</div>
                <p className="text-[11px] t-muted mt-2">Frekuensi kejadian kerusakan.</p>
              </div>
            </div>

            <div className="glass-card p-6 flex flex-col md:col-span-2 lg:col-span-2 xl:col-span-2 min-h-[300px]">
              <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <h3 className="font-bold t-primary flex items-center gap-2">
                  <PieChartIcon className="w-5 h-5 text-brand-red" /> Distribusi kerusakan
                </h3>
                <div className="flex rounded-xl p-1 border" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}>
                  <button type="button" onClick={() => setChartType('operator')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${chartType === 'operator' ? 'bg-brand-red/15 t-primary shadow-sm' : 't-muted hover:t-secondary'}`}
                  >Operator</button>
                  <button type="button" onClick={() => setChartType('item')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${chartType === 'item' ? 'bg-brand-red/15 t-primary shadow-sm' : 't-muted hover:t-secondary'}`}
                  >Item</button>
                </div>
              </div>
              <div className="flex-1 w-full flex items-center justify-center min-h-[200px]">
                {isLoading ? (
                  <div className="w-48 h-48 rounded-full border-4 animate-pulse" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }} />
                ) : damageAnalyticsData.length === 0 ? (
                  <div className="text-center">
                    <PieChartIcon className="w-10 h-10 t-muted mx-auto mb-3 opacity-50" />
                    <p className="t-secondary text-sm">Belum ada data kerusakan pada periode ini.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={damageAnalyticsData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="totalKerusakan" nameKey="name" stroke="none">
                        {damageAnalyticsData.map((entry, index) => (
                          <Cell key={`d-${index}`} fill={COLORS[index % COLORS.length]} />
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

            <div className="glass-card overflow-hidden flex flex-col md:col-span-2 lg:col-span-3 xl:col-span-4 min-h-[400px]">
              <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2" style={{ borderBottom: '1px solid var(--border-glass)' }}>
                <h3 className="font-bold t-primary flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-brand-red" /> Detail laporan kerusakan
                </h3>
                <span className="text-xs t-muted font-mono">{damageReports.length} baris</span>
              </div>
              <div className="flex-1 overflow-x-auto">
                {isLoading ? (
                  <div className="p-12 flex justify-center">
                    <div className="w-8 h-8 border-t-2 border-r-2 border-brand-red rounded-full animate-spin" />
                  </div>
                ) : damageReports.length === 0 ? (
                  <div className="p-12 text-center border-2 border-dashed mx-2 my-2 rounded-2xl" style={{ borderColor: 'var(--border-glass)' }}>
                    <p className="t-secondary text-sm">Tidak ada laporan kerusakan untuk filter ini.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 pb-2 px-1">
                    {damageReports.slice(0, visibleReportsCount).map((r, i) => (
                      <div key={r.id || i} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-surface border border-theme hover:border-brand-red/25 transition-all">
                        <div className="flex items-center gap-4 md:w-1/3">
                          <div className="w-12 h-12 rounded-2xl bg-brand-red/10 border border-brand-red/20 flex flex-col items-center justify-center shrink-0">
                            <span className="text-xs font-bold t-primary">{r.date.split(',')[0].split(' ')[0]}</span>
                            <span className="text-[10px] font-mono t-muted">{r.date.split(',')[0].split(' ')[1]?.substring(0, 3)}</span>
                          </div>
                          <div>
                            <p className="text-sm font-bold t-primary flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 t-muted" /> {r.operatorName}
                            </p>
                            <span className="text-[10px] font-mono text-brand-amber uppercase mt-1 inline-block">{r.operatorRole}</span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-brand-red flex items-center gap-1.5 mb-1">
                            <Package className="w-4 h-4" /> {r.itemName}
                          </p>
                          {r.reason ? (
                            <p className="text-[11px] t-secondary italic line-clamp-3">{r.reason}</p>
                          ) : (
                            <p className="text-[11px] t-muted">Tanpa catatan</p>
                          )}
                        </div>
                        <div className="flex items-center gap-6 justify-between md:justify-end">
                          <div className="text-center">
                            <p className="text-[9px] uppercase font-bold text-brand-red mb-1">Qty rusak</p>
                            <span className="text-2xl font-mono font-bold text-brand-red">{r.qtyDamage}</span>
                            <span className="text-xs t-muted ml-1">{r.itemUnit}</span>
                          </div>
                          <div className="text-right min-w-[72px]">
                            <p className="text-[9px] uppercase font-bold t-muted mb-1">Stok akhir</p>
                            <span className="text-lg font-mono t-primary">{r.finalStock != null ? r.finalStock : '—'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {visibleReportsCount < damageReports.length && (
                      <div className="flex justify-center pt-6 pb-2">
                        <button type="button" onClick={() => setVisibleReportsCount((p) => p + 15)} className="px-6 py-2.5 bg-surface border border-theme t-primary font-bold text-sm rounded-xl hover:border-brand-red/40 hover:text-brand-red transition-all">
                          Tampilkan lebih banyak ({damageReports.length - visibleReportsCount})
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
                <p className="text-[11px] t-muted mt-2">Satu baris per sesi koreksi stok.</p>
              </div>
            </div>

            <div className="glass-card p-6 md:col-span-2 lg:col-span-3 xl:col-span-3 flex flex-col min-h-[260px]">
              <h3 className="text-md font-bold t-primary mb-1 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-brand-amber" /> Frekuensi per jenis proses
              </h3>
              <p className="text-[11px] t-muted mb-4">Jumlah entri di log stok per kategori sumber (bukan total qty).</p>
              <div className="flex-1 min-h-[180px]">
                {isLoading ? (
                  <div className="h-full rounded-xl animate-pulse" style={{ background: 'var(--bg-input)' }} />
                ) : stockMovementBySource.every((x) => x.count === 0) ? (
                  <p className="t-secondary text-sm py-8 text-center">Tidak ada data untuk grafik.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={stockMovementBySource} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={10} tick={{ fill: 'var(--text-muted)' }} interval={0} angle={-12} textAnchor="end" height={56} />
                      <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'var(--bg-body)', border: '1px solid var(--border-glass)', borderRadius: '12px', fontSize: '12px' }}
                        formatter={(v) => [`${v} entri`, 'Jumlah']}
                      />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {stockMovementBySource.map((entry, index) => (
                          <Cell key={`s-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Stock Log Table - Full Width */}
            <div className="glass-card overflow-hidden flex flex-col md:col-span-2 lg:col-span-3 xl:col-span-4 min-h-[400px]">
              <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2" style={{ borderBottom: '1px solid var(--border-glass)' }}>
                <h3 className="font-bold t-primary flex items-center gap-2">
                  <History className="w-5 h-5 text-brand-amber" /> Detail pergerakan stok
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

        {/* ========== KENDALA QC (trx_defects) ========== */}
        {activeTab === 'kendala' && (
          <>
            <div className="glass-card p-6 flex flex-col justify-between relative overflow-hidden">
              <div className="p-3 bg-orange-500/10 rounded-2xl text-orange-500 border border-orange-500/20 w-fit mb-4">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="t-secondary text-sm font-medium mb-1 uppercase tracking-wider">Total qty gagal (laporan)</h3>
                <div className="text-4xl font-mono font-bold text-orange-500">{defectTotals.qty}</div>
                <p className="text-[11px] t-muted mt-2">Penjumlahan field quantity per baris.</p>
              </div>
            </div>
            <div className="glass-card p-6 flex flex-col justify-between">
              <div className="p-3 bg-input rounded-2xl border border-theme w-fit mb-4">
                <FileText className="w-6 h-6 t-secondary" />
              </div>
              <div>
                <h3 className="t-secondary text-sm font-medium mb-1 uppercase tracking-wider">Jumlah laporan</h3>
                <div className="text-4xl font-mono font-bold t-primary">{defectTotals.rows}</div>
                <p className="text-[11px] t-muted mt-2">Frekuensi pelaporan kendala.</p>
              </div>
            </div>
            <div className="glass-card p-6 md:col-span-2 lg:col-span-2 xl:col-span-2 min-h-[280px] flex flex-col">
              <h3 className="font-bold t-primary mb-1 flex items-center gap-2">
                <PieChartIcon className="w-5 h-5 text-orange-500" /> Qty gagal per kategori
              </h3>
              <p className="text-[11px] t-muted mb-4">Membantu melihat jenis masalah yang paling memberatkan.</p>
              <div className="flex-1 min-h-[200px] flex items-center justify-center">
                {isLoading ? (
                  <div className="w-40 h-40 rounded-full border-4 animate-pulse" style={{ borderColor: 'var(--border-glass)' }} />
                ) : defectCategoryChart.length === 0 ? (
                  <p className="t-secondary text-sm text-center px-4">Belum ada data kendala pada periode ini.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={defectCategoryChart}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={4}
                        dataKey="value"
                        nameKey="name"
                        stroke="none"
                      >
                        {defectCategoryChart.map((entry, index) => (
                          <Cell key={`def-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: 'var(--bg-body)', border: '1px solid var(--border-glass)', borderRadius: '12px' }}
                        formatter={(v) => [`${v} qty`, '']}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="glass-card overflow-hidden flex flex-col md:col-span-2 lg:col-span-3 xl:col-span-4 min-h-[400px]">
            <div className="p-6 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-glass)' }}>
              <h3 className="font-bold t-primary flex items-center gap-2 text-orange-500">
                <FileWarning className="w-5 h-5" /> Tabel laporan kendala
              </h3>
              <span className="text-xs t-muted font-mono">
                {defectsLogs.length} baris
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
          </>
        )}
      </div>

      {/* Confirm Delete Usage Modal (Khusus SPV) */}
      {confirmDeleteUsageReport && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
            onClick={() => !isLoading && setConfirmDeleteUsageReport(null)}
          ></div>

          <div
            className="glass-card w-full max-w-lg p-6 relative z-10 animate-in zoom-in-95 duration-200"
            style={{ border: '1px solid var(--border-glass)' }}
          >
            <h3 className="text-xl font-bold t-primary mb-2 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-brand-red" />
              Konfirmasi Hapus Pemakaian
            </h3>
            <p className="t-secondary text-sm mb-6">
              Tindakan ini akan <span className="t-primary font-semibold">mengembalikan stok</span> sesuai qty laporan pemakaian, lalu menghapus baris laporan.
            </p>

            <div className="flex gap-3 justify-end pt-4" style={{ borderTop: '1px solid var(--border-glass)' }}>
              <button
                type="button"
                onClick={() => setConfirmDeleteUsageReport(null)}
                className="px-4 py-2 text-sm font-medium rounded-xl t-secondary hover:bg-white/5 transition-colors"
                disabled={isLoading}
              >
                Batal
              </button>

              <button
                type="button"
                onClick={() => confirmDeleteUsage()}
                className="px-5 py-2 text-sm font-bold text-white bg-brand-red rounded-xl hover:bg-brand-red/90 transition-colors shadow-lg shadow-brand-red/20 flex items-center justify-center min-w-[150px]"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-t-2 border-r-2 border-white rounded-full animate-spin" />
                ) : (
                  'Hapus Pemakaian'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Usage Modal (Khusus SPV) */}
      {editingUsageReport && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
            onClick={() => !isSavingUsageEdit && setEditingUsageReport(null)}
          ></div>
          <div
            className="glass-card w-full max-w-lg p-6 relative z-10 animate-in zoom-in-95 duration-200"
            style={{ border: '1px solid var(--border-glass)' }}
          >
            <h3 className="text-xl font-bold t-primary mb-6 flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-sky-400" />
              Edit Laporan Pemakaian
            </h3>

            <form onSubmit={handleSaveUsageReportEdit} className="space-y-4">
              <div className="text-sm t-secondary p-3 bg-sky-500/10 border border-sky-500/20 rounded-xl">
                Qty: <span className="font-bold t-primary">{editingUsageReport.qtyUsed}</span> {editingUsageReport.itemUnit} • Item:{' '}
                <span className="font-bold t-primary">{editingUsageReport.itemName}</span>
              </div>

              <div>
                <label className="block text-sm font-medium t-secondary mb-1">Catatan / Alasan</label>
                <textarea
                  className="w-full px-4 py-2.5 rounded-xl border resize-none"
                  style={{
                    background: 'var(--bg-input)',
                    borderColor: 'var(--border-glass)',
                    color: 'var(--text-primary)',
                  }}
                  rows={5}
                  value={editingUsageReport.notes}
                  onChange={(e) =>
                    setEditingUsageReport({ ...editingUsageReport, notes: e.target.value })
                  }
                  placeholder="Tulis catatan pemakaian..."
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 mt-6" style={{ borderTop: '1px solid var(--border-glass)' }}>
                <button
                  type="button"
                  onClick={() => setEditingUsageReport(null)}
                  className="px-4 py-2 text-sm font-medium rounded-xl t-secondary hover:bg-white/5 transition-colors"
                  disabled={isSavingUsageEdit}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingUsageEdit}
                  className="px-5 py-2 text-sm font-bold text-white bg-blue-500 rounded-xl hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/25 flex items-center justify-center min-w-[140px]"
                >
                  {isSavingUsageEdit ? (
                    <div className="w-5 h-5 border-t-2 border-r-2 border-white rounded-full animate-spin"></div>
                  ) : (
                    'Simpan Perubahan'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
