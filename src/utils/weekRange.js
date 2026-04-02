/**
 * Rentang "minggu berjalan": Senin 00:00:00 — hari ini 23:59:59.999 (Asia/Makassar / WITA).
 */
const TZ = 'Asia/Makassar';

function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * @returns {{ weekStart: Date, weekEnd: Date, labelRange: string, todayLabel: string }}
 */
export function getRunningWeekBounds(reference = new Date()) {
  const cal = reference.toLocaleString('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [Y, M, D] = cal.split('-').map(Number);
  const todayMidnight = new Date(`${Y}-${pad2(M)}-${pad2(D)}T00:00:00+08:00`);

  const weekdayShort = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
  }).format(reference);
  const idx = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekdayShort);
  const daysBack = idx === -1 ? 0 : idx === 0 ? 6 : idx - 1;
  const weekStart = new Date(todayMidnight.getTime() - daysBack * 86400000);
  const weekEnd = new Date(`${Y}-${pad2(M)}-${pad2(D)}T23:59:59.999+08:00`);

  const fmtLong = new Intl.DateTimeFormat('id-ID', {
    timeZone: TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const startLabel = fmtLong.format(weekStart);
  const endLabel = fmtLong.format(weekEnd);

  return {
    weekStart,
    weekEnd,
    labelRange: `${startLabel} — ${endLabel}`,
    todayLabel: endLabel,
  };
}

/**
 * Tanggal lokal WITA sebagai YYYY-MM-DD (untuk input type="date").
 * @param {Date} d
 */
export function dateToYmdWita(d) {
  return d.toLocaleString('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/** Awal hari (00:00:00.000) untuk YYYY-MM-DD di WITA */
export function parseYmdWitaStart(ymd) {
  if (!ymd || typeof ymd !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00+08:00`);
}

/** Akhir hari (23:59:59.999) untuk YYYY-MM-DD di WITA */
export function parseYmdWitaEnd(ymd) {
  if (!ymd || typeof ymd !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  return new Date(`${m[1]}-${m[2]}-${m[3]}T23:59:59.999+08:00`);
}

const fmtLongWita = new Intl.DateTimeFormat('id-ID', {
  timeZone: TZ,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/**
 * Label rentang untuk rekap (dua tanggal, WITA).
 * @param {Date} start
 * @param {Date} end
 */
export function formatWitaRangeLabel(start, end) {
  return `${fmtLongWita.format(start)} — ${fmtLongWita.format(end)}`;
}
