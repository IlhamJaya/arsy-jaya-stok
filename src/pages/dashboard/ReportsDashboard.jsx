
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import {
  FileText, Calendar, Filter, Download,
  BarChart3, PieChart as PieChartIcon, CheckCircle2, Factory, User, Package, AlertTriangle,
  ArrowUpCircle, ArrowDownCircle, Settings2, History, Scissors
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

import * as XLSX from 'xlsx';

// Custom Colors for Charts
const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const SOURCE_LABELS = {
  REPORT_USAGE: { label: 'Pemakaian', color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20', icon: ArrowDownCircle },
  REPORT_DAMAGE: { label: 'Kerusakan', color: 'text-brand-red', bg: 'bg-brand-red/10 border-brand-red/20', icon: AlertTriangle },
  STOCK_IN: { label: 'Stok Masuk', color: 'text-brand-green', bg: 'bg-brand-green/10 border-brand-green/20', icon: ArrowUpCircle },
  AUDIT: { label: 'Audit Opname', color: 'text-brand-amber', bg: 'bg-brand-amber/10 border-brand-amber/20', icon: Settings2 }
};

export default function ReportsDashboard() {
  const [activeTab, setActiveTab] = useState('produksi'); // 'produksi' | 'stok'
  const [reports, setReports] = useState([]);
  const [stockLogs, setStockLogs] = useState([]);
  const [cuttingLogs, setCuttingLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [dateRange, setDateRange] = useState('month');
  const [selectedType, setSelectedType] = useState('ALL');

  // Analytics View Type
  const [chartType, setChartType] = useState('operator');

  const getTimeFilter = useCallback(() => {
    const now = new Date();
    if (dateRange === 'today') {
      return new Date(now.setHours(0, 0, 0, 0)).toISOString();
    } else if (dateRange === 'week') {
      now.setDate(now.getDate() - 7);
      return now.toISOString();
    } else if (dateRange === 'month') {
      now.setMonth(now.getMonth() - 1);
      return now.toISOString();
    }
    return null;
  }, [dateRange]);

  // === TAB 1: Fetch Approved Reports from trx_reports ===
  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const timeFilter = getTimeFilter();
      let query = supabase
        .from('trx_reports')
        .select(`
            id, type, quantity, notes, status, created_at,
            item:mst_items(name, unit, stock),
            operator:profiles!trx_reports_operator_id_fkey(full_name, role)
        `)
        .eq('status', 'Approved')
        .order('created_at', { ascending: false });

      if (timeFilter) {
        query = query.gte('created_at', timeFilter);
      }

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
      const timeFilter = getTimeFilter();
      let query = supabase
        .from('trx_stock_log')
        .select(`
            id, change_amount, previous_stock, final_stock, source, notes, created_at,
            item:mst_items(name, unit)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (timeFilter) {
        query = query.gte('created_at', timeFilter);
      }

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
      const timeFilter = getTimeFilter();
      let query = supabase
        .from('trx_cutting_log')
        .select(`
            id, order_name, qty_cut, notes, created_at,
            operator:profiles!trx_cutting_log_operator_id_fkey(full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(200);

      if (timeFilter) {
        query = query.gte('created_at', timeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      setCuttingLogs(data || []);
    } catch (err) {
      console.error("Error fetching cutting logs:", err);
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
    }
  }, [activeTab, fetchReports, fetchStockLogs, fetchCuttingLogs]);

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
        "Lembar Di-Cut": l.qty_cut,
        "Operator": l.operator?.full_name || '-',
        "Catatan": l.notes || '-'
      })));
    }
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `ArsyStok_${sheetName}_${Date.now()}.xlsx`);
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
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all border ${activeTab === 'produksi' ? 'bg-brand-green/10 text-brand-green border-brand-green/20 shadow-sm' : 't-muted border-transparent hover:bg-brand-green/5'}`}
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
      </div>

      {/* BENTO GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">

        {/* Filters & Actions - Full Width */}
        <div className="glass-card p-5 flex flex-col md:flex-row gap-4 items-center justify-between md:col-span-2 lg:col-span-full xl:col-span-full">
          <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
            <div className="flex items-center gap-3 p-2 rounded-xl border" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}>
              <Calendar className="w-5 h-5 text-brand-amber ml-2" />
              <select value={dateRange} onChange={(e) => setDateRange(e.target.value)}
                className="bg-transparent border-none t-primary text-sm font-medium focus:outline-none focus:ring-0 cursor-pointer appearance-none pr-6"
              >
                <option value="today" style={{ background: 'var(--select-bg)' }}>Hari Ini</option>
                <option value="week" style={{ background: 'var(--select-bg)' }}>7 Hari Terakhir</option>
                <option value="month" style={{ background: 'var(--select-bg)' }}>30 Hari Terakhir</option>
                <option value="all" style={{ background: 'var(--select-bg)' }}>Semua Waktu</option>
              </select>
            </div>

            <div className="flex items-center gap-3 p-2 rounded-xl border" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}>
              <Filter className="w-5 h-5 text-brand-green ml-2" />
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
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-green/10 text-brand-green font-medium border border-brand-green/20 rounded-xl hover:bg-brand-green hover:text-slate-900 transition-colors">
              <Download className="w-4 h-4" /> Excel
            </button>

          </div>
        </div>

        {/* ========== TAB 1: PRODUKSI ========== */}
        {activeTab === 'produksi' && (
          <>
            {/* 1x1 Card: Total Terpakai */}
            <div className="glass-card p-6 flex flex-col justify-between group cursor-default relative overflow-hidden">
              <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-brand-green/5 rounded-full blur-2xl pointer-events-none transition-all group-hover:bg-brand-green/10"></div>
              <div className="flex items-start justify-between mb-4 relative z-10">
                <div className="p-3 bg-brand-green/10 rounded-2xl text-brand-green border border-brand-green/20 group-hover:bg-brand-green/20 transition-colors">
                  <Package className="w-6 h-6" />
                </div>
              </div>
              <div className="relative z-10">
                <h3 className="t-secondary text-sm font-medium mb-1 uppercase tracking-wider">Total Item Dipakai</h3>
                <div className="text-4xl font-mono font-bold t-primary group-hover:text-brand-green transition-colors">{totalUsed}</div>
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
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${chartType === 'operator' ? 'bg-brand-green/20 t-primary shadow-sm' : 't-muted hover:t-secondary'}`}
                  >Operator</button>
                  <button onClick={() => setChartType('item')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${chartType === 'item' ? 'bg-brand-green/20 t-primary shadow-sm' : 't-muted hover:t-secondary'}`}
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
                  <BarChart3 className="w-5 h-5 text-brand-green" /> Detail Riwayat Laporan (Approved)
                </h3>
                <span className="text-xs t-muted font-mono">
                  {reports.length} data
                </span>
              </div>

              <div className="flex-1 overflow-x-auto">
                {isLoading ? (
                  <div className="p-12 flex items-center justify-center">
                    <div className="w-8 h-8 border-t-2 border-r-2 border-brand-green rounded-full animate-spin"></div>
                  </div>
                ) : reports.length === 0 ? (
                  <div className="p-12 flex flex-col items-center justify-center text-center h-full border-2 border-dashed mx-2 my-2 rounded-2xl" style={{ borderColor: 'var(--border-glass)' }}>
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 border" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}>
                      <FileText className="w-8 h-8 t-muted" />
                    </div>
                    <h3 className="text-lg font-medium t-primary mb-1">Tidak Ada Data</h3>
                    <p className="t-secondary text-sm max-w-sm">Belum ada laporan produksi yang disetujui pada filter ini.</p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-xs font-semibold t-muted uppercase tracking-wider" style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border-glass)' }}>
                        <th className="px-6 py-4">Waktu Laporan</th>
                        <th className="px-6 py-4">Operator / Item</th>
                        <th className="px-6 py-4 text-center">Terpakai</th>
                        <th className="px-6 py-4 text-center">Rusak</th>
                        <th className="px-6 py-4 text-right">Stok Akhir</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.map((r, i) => (
                        <tr key={r.id || i} className="hover:bg-brand-green/5 transition-colors group" style={{ borderBottom: '1px solid var(--border-glass)' }}>
                          <td className="px-6 py-4">
                            <p className="text-sm font-medium t-secondary">{r.date.split(',')[0]}</p>
                            <p className="text-xs t-muted font-mono mt-0.5">{r.date.split(',')[1]}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm font-semibold t-primary flex items-center gap-1.5"><User className="w-3.5 h-3.5 t-muted" /> {r.operatorName} <span className="text-[10px] border px-1.5 py-0.5 rounded-md font-mono ml-2 tracking-widest t-muted" style={{ borderColor: 'var(--border-glass)', background: 'var(--bg-input)' }}>{r.type}</span></p>
                            <p className="text-xs text-brand-green mt-1 flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> {r.itemName}</p>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-lg font-mono font-bold t-primary group-hover:text-brand-green transition-colors">{r.qtyUsed}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {r.qtyDamage > 0 ? (
                              <span className="text-lg font-mono font-bold text-brand-red bg-brand-red/10 border border-brand-red/20 px-3 py-1 rounded-lg shadow-sm">{r.qtyDamage}</span>
                            ) : (
                              <span className="text-xs t-muted">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {r.finalStock != null ? (
                              <div className="flex items-center justify-end gap-2">
                                <CheckCircle2 className="w-4 h-4 text-brand-green/70" />
                                <span className="text-lg font-bold t-primary font-mono">{r.finalStock}</span>
                              </div>
                            ) : (
                              <span className="text-xs t-muted italic">No Data</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
              <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-brand-green/5 rounded-full blur-2xl pointer-events-none transition-all group-hover:bg-brand-green/10"></div>
              <div className="flex items-start justify-between mb-4 relative z-10">
                <div className="p-3 bg-brand-green/10 rounded-2xl text-brand-green border border-brand-green/20 group-hover:bg-brand-green/20 transition-colors">
                  <ArrowUpCircle className="w-6 h-6" />
                </div>
              </div>
              <div className="relative z-10">
                <h3 className="t-secondary text-sm font-medium mb-1 uppercase tracking-wider">Total Stok Masuk</h3>
                <div className="text-4xl font-mono font-bold t-primary group-hover:text-brand-green transition-colors">+{stockLogStats.totalIn}</div>
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
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-xs font-semibold t-muted uppercase tracking-wider" style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border-glass)' }}>
                        <th className="px-6 py-4">Waktu</th>
                        <th className="px-6 py-4">Item</th>
                        <th className="px-6 py-4">Tipe</th>
                        <th className="px-6 py-4 text-center">Perubahan</th>
                        <th className="px-6 py-4 text-center">Stok Awal</th>
                        <th className="px-6 py-4 text-center">Stok Akhir</th>
                        <th className="px-6 py-4">Catatan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockLogs.map((log, i) => {
                        const sourceInfo = SOURCE_LABELS[log.source] || { label: log.source, color: 't-muted', bg: 'bg-slate-500/10 border-slate-500/20', icon: FileText };
                        const SourceIcon = sourceInfo.icon;
                        return (
                          <tr key={log.id || i} className="hover:bg-brand-amber/5 transition-colors" style={{ borderBottom: '1px solid var(--border-glass)' }}>
                            <td className="px-6 py-4">
                              <p className="text-sm font-medium t-secondary">{new Date(log.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</p>
                              <p className="text-xs t-muted font-mono mt-0.5">{new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-sm font-semibold t-primary flex items-center gap-1.5">
                                <Package className="w-3.5 h-3.5 t-muted" /> {log.item?.name || '-'}
                              </p>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border ${sourceInfo.bg} ${sourceInfo.color}`}>
                                <SourceIcon className="w-3.5 h-3.5" /> {sourceInfo.label}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`text-lg font-mono font-bold ${log.change_amount > 0 ? 'text-brand-green' : 'text-brand-red'}`}>
                                {log.change_amount > 0 ? `+${log.change_amount}` : log.change_amount}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="text-sm font-mono t-secondary">{log.previous_stock}</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="text-sm font-mono font-bold t-primary">{log.final_stock}</span>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-xs t-muted max-w-[200px] truncate">{log.notes || '-'}</p>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
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
              <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-brand-green/5 rounded-full blur-2xl pointer-events-none transition-all group-hover:bg-brand-green/10"></div>
              <div className="flex items-start justify-between mb-4 relative z-10">
                <div className="p-3 bg-brand-green/10 rounded-2xl text-brand-green border border-brand-green/20 group-hover:bg-brand-green/20 transition-colors">
                  <Scissors className="w-6 h-6" />
                </div>
              </div>
              <div className="relative z-10">
                <h3 className="t-secondary text-sm font-medium mb-1 uppercase tracking-wider">Total Lembar Di-Cut</h3>
                <div className="text-4xl font-mono font-bold t-primary group-hover:text-brand-green transition-colors">{cuttingLogStats.totalCut}</div>
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
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-xs font-semibold t-muted uppercase tracking-wider" style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border-glass)' }}>
                        <th className="px-6 py-4">Waktu</th>
                        <th className="px-6 py-4">Nama Order</th>
                        <th className="px-6 py-4">Operator</th>
                        <th className="px-6 py-4 text-center">Lembar Di-Cut</th>
                        <th className="px-6 py-4">Catatan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cuttingLogs.map((log, i) => {
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
                              <p className="text-sm font-medium t-secondary flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 t-muted" /> {log.operator?.full_name || '-'}
                              </p>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="text-lg font-mono font-bold text-brand-green">
                                {log.qty_cut}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-xs t-muted max-w-[250px] truncate">{log.notes || '-'}</p>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
