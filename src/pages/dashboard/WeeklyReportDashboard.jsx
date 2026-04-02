import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PageHeader from '../../components/ui/PageHeader';
import { supabase } from '../../supabaseClient';
import { CalendarRange, ClipboardList, Loader2, Copy, Check } from 'lucide-react';
import {
  getRunningWeekBounds,
  dateToYmdWita,
  parseYmdWitaStart,
  parseYmdWitaEnd,
  formatWitaRangeLabel,
} from '../../utils/weekRange.js';

/** Label rekap: nama barang (jenis bahan), bukan hanya kategori — mis. Stiker Vinyl vs Stiker Chrome */
function itemLabel(row) {
  const it = row?.item;
  const n = it?.name;
  if (n != null && String(n).trim() !== '') return String(n).trim();
  const c = it?.category;
  if (c != null && String(c).trim() !== '') return String(c).trim();
  return 'Tanpa nama barang';
}

function unitLabel(row) {
  const u = row?.item?.unit;
  return (u != null && String(u).trim() !== '') ? String(u).trim() : 'lbr';
}

/** @param {{ quantity?: number, type?: string, item?: object }[]} rows */
function sumByItem(rows, typeFilter) {
  const map = new Map();
  for (const r of rows) {
    if (r.type !== typeFilter) continue;
    const k = itemLabel(r);
    const prev = map.get(k) || { sum: 0, unit: 'lbr' };
    const q = Number(r.quantity) || 0;
    prev.sum += q;
    prev.unit = unitLabel(r);
    map.set(k, prev);
  }
  return [...map.entries()]
    .map(([name, { sum, unit }]) => ({ name, sum, unit }))
    .sort((a, b) => a.name.localeCompare(b.name, 'id'));
}

/** @param {{ qty_cut?: number, item?: object }[]} rows */
function sumCuttingByItem(rows) {
  const map = new Map();
  for (const r of rows) {
    const k = itemLabel(r);
    const prev = map.get(k) || { sum: 0, unit: 'lbr' };
    const q = Number(r.qty_cut) || 0;
    prev.sum += q;
    prev.unit = unitLabel(r);
    map.set(k, prev);
  }
  return [...map.entries()]
    .map(([name, { sum, unit }]) => ({ name, sum, unit }))
    .sort((a, b) => a.name.localeCompare(b.name, 'id'));
}

function formatReportText(usage, cutting, damage, labelRange) {
  const lines = [];
  lines.push(`*Rekap* (${labelRange})`);
  lines.push('');
  lines.push('Jumlah penggunaan bahan pada periode ini (per nama barang / jenis bahan):');
  if (usage.length === 0) lines.push('(tidak ada data)');
  else usage.forEach((r) => lines.push(`${r.name}: ${r.sum} ${r.unit}`));
  lines.push('');
  lines.push('Jumlah cuttingan pada periode ini (per nama barang / jenis bahan, mis. Stiker Vinyl, Chrome, Transparan):');
  if (cutting.length === 0) lines.push('(tidak ada data)');
  else cutting.forEach((r) => lines.push(`${r.name}: ${r.sum} ${r.unit}`));
  lines.push('');
  lines.push('Jumlah kerusakan pada periode ini (per nama barang / jenis bahan):');
  if (damage.length === 0) lines.push('(tidak ada data)');
  else damage.forEach((r) => lines.push(`${r.name}: ${r.sum} ${r.unit}`));
  return lines.join('\n');
}

export default function WeeklyReportDashboard({ embedded = false }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [reports, setReports] = useState([]);
  const [cuttings, setCuttings] = useState([]);
  const [copied, setCopied] = useState(false);

  const initialYmd = useMemo(() => {
    const b = getRunningWeekBounds();
    return { start: dateToYmdWita(b.weekStart), end: dateToYmdWita(b.weekEnd) };
  }, []);

  const [draftStart, setDraftStart] = useState(initialYmd.start);
  const [draftEnd, setDraftEnd] = useState(initialYmd.end);
  const [appliedStart, setAppliedStart] = useState(initialYmd.start);
  const [appliedEnd, setAppliedEnd] = useState(initialYmd.end);

  const period = useMemo(() => {
    const s = parseYmdWitaStart(appliedStart);
    const e = parseYmdWitaEnd(appliedEnd);
    if (!s || !e) return null;
    if (s.getTime() > e.getTime()) return null;
    return {
      weekStart: s,
      weekEnd: e,
      labelRange: formatWitaRangeLabel(s, e),
    };
  }, [appliedStart, appliedEnd]);

  const labelRange = period?.labelRange ?? '';

  const handleApplyRange = () => {
    if (!draftStart?.trim() || !draftEnd?.trim()) {
      setErr('Pilih tanggal mulai dan tanggal akhir.');
      return;
    }
    const s = parseYmdWitaStart(draftStart);
    const e = parseYmdWitaEnd(draftEnd);
    if (!s || !e) {
      setErr('Format tanggal tidak valid.');
      return;
    }
    if (s.getTime() > e.getTime()) {
      setErr('Tanggal mulai tidak boleh setelah tanggal akhir.');
      return;
    }
    setErr(null);
    setAppliedStart(draftStart.trim());
    setAppliedEnd(draftEnd.trim());
  };

  const handleResetRunningWeek = () => {
    const b = getRunningWeekBounds();
    const s = dateToYmdWita(b.weekStart);
    const e = dateToYmdWita(b.weekEnd);
    setDraftStart(s);
    setDraftEnd(e);
    setAppliedStart(s);
    setAppliedEnd(e);
    setErr(null);
  };

  const load = useCallback(async () => {
    if (!period) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const startIso = period.weekStart.toISOString();
      const endIso = period.weekEnd.toISOString();

      const [repRes, cutRes] = await Promise.all([
        supabase
          .from('trx_reports')
          .select('quantity, type, created_at, item:mst_items(name, category, unit)')
          .gte('created_at', startIso)
          .lte('created_at', endIso)
          .in('type', ['Usage', 'Damage']),
        supabase
          .from('trx_cutting_log')
          .select('qty_cut, created_at, item:mst_items(name, category, unit)')
          .not('item_id', 'is', null)
          .gte('created_at', startIso)
          .lte('created_at', endIso),
      ]);

      if (repRes.error) throw repRes.error;
      if (cutRes.error) throw cutRes.error;

      setReports(repRes.data || []);
      setCuttings(cutRes.data || []);
    } catch (e) {
      console.error(e);
      setErr(e.message || 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const usageRows = useMemo(() => sumByItem(reports, 'Usage'), [reports]);
  const damageRows = useMemo(() => sumByItem(reports, 'Damage'), [reports]);
  const cuttingRows = useMemo(() => sumCuttingByItem(cuttings), [cuttings]);

  const plainText = useMemo(
    () => formatReportText(usageRows, cuttingRows, damageRows, labelRange),
    [usageRows, cuttingRows, damageRows, labelRange],
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErr('Browser tidak mengizinkan salin teks');
    }
  };

  const Section = ({ title, hint, rows }) => (
    <div className="glass-card p-6 md:p-8 border border-theme/40 shadow-md shadow-black/5">
      <div className="mb-4">
        <h3 className="text-lg font-bold t-primary mb-1 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-accent-base shrink-0" />
          {title}
        </h3>
        {hint ? <p className="text-xs t-muted">{hint}</p> : null}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm t-muted">Belum ada data pada periode ini.</p>
      ) : (
        <ul className="space-y-2 font-mono text-sm">
          {rows.map((r) => (
            <li key={r.name} className="flex justify-between gap-4 border-b border-theme/50 pb-2 last:border-0">
              <span className="t-primary">{r.name}</span>
              <span className="text-accent-base font-semibold whitespace-nowrap">
                {r.sum.toLocaleString('id-ID')} {r.unit}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const copyButton = (
    <button
      type="button"
      onClick={handleCopy}
      disabled={loading}
      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm border border-theme bg-[var(--bg-panel)] t-primary hover:bg-accent-base/10 transition-colors disabled:opacity-50 shadow-sm shrink-0"
    >
      {copied ? <Check className="w-4 h-4 text-accent-base" /> : <Copy className="w-4 h-4" />}
      {copied ? 'Tersalin' : 'Salin teks laporan'}
    </button>
  );

  return (
    <div className="w-full max-w-5xl mx-auto animate-in fade-in py-2 pb-10">
      {embedded ? (
        <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-400/90 mb-1">Agregat periode</p>
            <h2 className="text-xl font-bold t-primary">Rekap mingguan</h2>
            <p className="text-sm t-secondary mt-2">
              Ringkasan per <strong>nama barang</strong> (WITA). Rentang tanggal di bawah; salin teks untuk WhatsApp.
            </p>
            {labelRange ? (
              <p className="text-xs t-muted mt-3 flex items-center gap-2 flex-wrap">
                <CalendarRange className="w-3.5 h-3.5 shrink-0" />
                <span>Aktif: {labelRange}</span>
              </p>
            ) : null}
          </div>
          {copyButton}
        </div>
      ) : (
        <PageHeader
          eyebrow="Agregat periode"
          title="Rekap Mingguan"
          icon={CalendarRange}
          actions={copyButton}
        >
          <p>
            Pengelompokan menurut <strong>nama barang</strong> di master (<code>mst_items.name</code>) — setiap jenis bahan
            (mis. Stiker Vinyl, Stiker Chrome, Stiker Transparan) tampil terpisah, bukan digabung lewat kategori &quot;Stiker&quot; saja.
            Pilih rentang tanggal (zona waktu WITA); awal default mengikuti <strong>minggu berjalan</strong> (Senin–hari ini).
          </p>
          {labelRange ? (
            <p className="text-xs t-muted mt-3 flex items-center gap-2 flex-wrap">
              <CalendarRange className="w-3.5 h-3.5 shrink-0" />
              <span>Aktif: {labelRange}</span>
            </p>
          ) : null}
        </PageHeader>
      )}

      <div className="glass-card p-4 sm:p-5 mb-8 border border-theme/40 shadow-lg shadow-black/5">
        <p className="text-sm font-semibold t-primary mb-3">Rentang periode</p>
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3 sm:gap-4">
          <label className="flex flex-col gap-1.5 min-w-0 flex-1 sm:max-w-[200px]">
            <span className="text-[11px] uppercase tracking-wide t-muted font-medium">Dari tanggal</span>
            <input
              type="date"
              value={draftStart}
              onChange={(e) => setDraftStart(e.target.value)}
              className="rounded-xl border border-theme bg-[var(--bg-input)] px-3 py-2 text-sm t-primary focus:outline-none focus:ring-2 focus:ring-accent-base/40"
            />
          </label>
          <label className="flex flex-col gap-1.5 min-w-0 flex-1 sm:max-w-[200px]">
            <span className="text-[11px] uppercase tracking-wide t-muted font-medium">Sampai tanggal</span>
            <input
              type="date"
              value={draftEnd}
              min={draftStart || undefined}
              onChange={(e) => setDraftEnd(e.target.value)}
              className="rounded-xl border border-theme bg-[var(--bg-input)] px-3 py-2 text-sm t-primary focus:outline-none focus:ring-2 focus:ring-accent-base/40"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleApplyRange}
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl font-semibold text-sm bg-accent-base/15 text-accent-base border border-accent-base/30 hover:bg-accent-base/25 transition-colors"
            >
              Terapkan
            </button>
            <button
              type="button"
              onClick={handleResetRunningWeek}
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl font-medium text-sm border border-theme t-secondary hover:bg-accent-base/10 transition-colors"
              title="Kembalikan ke Senin–hari ini (WITA)"
            >
              Minggu berjalan
            </button>
          </div>
        </div>
        <p className="text-[11px] t-muted mt-3">
          Batas waktu query: mulai pukul 00:00 hari pertama sampai 23:59:59 hari terakhir (WITA).
        </p>
      </div>

      {err && (
        <div className="mb-6 p-4 rounded-xl bg-brand-red/10 border border-brand-red/20 text-brand-red text-sm">
          {err}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24 gap-3 t-muted">
          <Loader2 className="w-8 h-8 animate-spin text-accent-base" />
          <span>Memuat data…</span>
        </div>
      ) : (
        <div className="space-y-6">
          <Section
            title="Jumlah penggunaan bahan pada periode ini"
            hint="Dipecah per nama barang (jenis bahan) di master."
            rows={usageRows}
          />
          <Section
            title="Jumlah cuttingan pada periode ini"
            hint="Per jenis bahan yang dipilih saat input cutting — contoh: Stiker Vinyl, Stiker Chrome, Stiker Transparan (mengikuti nama di master barang)."
            rows={cuttingRows}
          />
          <Section
            title="Jumlah kerusakan pada periode ini"
            hint="Dipecah per nama barang (jenis bahan) di master."
            rows={damageRows}
          />
        </div>
      )}
    </div>
  );
}
