import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type Supabase = ReturnType<typeof createClient>

const FONNTE_API_URL = "https://api.fonnte.com/send"

// ─── Rekap (format selaras WeeklyReportDashboard) ───────────────────────────

type ItemLite = { name?: string | null; category?: string | null; unit?: string | null }

function itemLabel(item: ItemLite | null | undefined): string {
  const n = item?.name
  if (n != null && String(n).trim() !== '') return String(n).trim()
  const c = item?.category
  if (c != null && String(c).trim() !== '') return String(c).trim()
  return 'Tanpa nama barang'
}

function unitLabel(item: ItemLite | null | undefined): string {
  const u = item?.unit
  return (u != null && String(u).trim() !== '') ? String(u).trim() : 'lbr'
}

interface ReportRow {
  type: string
  quantity: number | string | null
  item: ItemLite | null
}

interface CuttingRow {
  qty_cut: number | string | null
  item: ItemLite | null
}

function sumByItem(rows: ReportRow[], typeFilter: string) {
  const map = new Map<string, { sum: number; unit: string }>()
  for (const r of rows) {
    if (r.type !== typeFilter) continue
    const k = itemLabel(r.item)
    const prev = map.get(k) || { sum: 0, unit: 'lbr' }
    const q = Number(r.quantity) || 0
    prev.sum += q
    prev.unit = unitLabel(r.item)
    map.set(k, prev)
  }
  return [...map.entries()]
    .map(([name, { sum, unit }]) => ({ name, sum, unit }))
    .sort((a, b) => a.name.localeCompare(b.name, 'id'))
}

function sumCuttingByItem(rows: CuttingRow[]) {
  const map = new Map<string, { sum: number; unit: string }>()
  for (const r of rows) {
    const k = itemLabel(r.item)
    const prev = map.get(k) || { sum: 0, unit: 'lbr' }
    const q = Number(r.qty_cut) || 0
    prev.sum += q
    prev.unit = unitLabel(r.item)
    map.set(k, prev)
  }
  return [...map.entries()]
    .map(([name, { sum, unit }]) => ({ name, sum, unit }))
    .sort((a, b) => a.name.localeCompare(b.name, 'id'))
}

function formatReportText(
  usage: { name: string; sum: number; unit: string }[],
  cutting: { name: string; sum: number; unit: string }[],
  damage: { name: string; sum: number; unit: string }[],
  labelRange: string,
) {
  const lines: string[] = []
  lines.push(`*Rekap* (${labelRange})`)
  lines.push('')
  lines.push('Jumlah penggunaan bahan pada periode ini (per nama barang / jenis bahan):')
  if (usage.length === 0) lines.push('(tidak ada data)')
  else usage.forEach((r) => lines.push(`${r.name}: ${r.sum} ${r.unit}`))
  lines.push('')
  lines.push('Jumlah cuttingan pada periode ini (per nama barang / jenis bahan, mis. Stiker Vinyl, Chrome, Transparan):')
  if (cutting.length === 0) lines.push('(tidak ada data)')
  else cutting.forEach((r) => lines.push(`${r.name}: ${r.sum} ${r.unit}`))
  lines.push('')
  lines.push('Jumlah kerusakan pada periode ini (per nama barang / jenis bahan):')
  if (damage.length === 0) lines.push('(tidak ada data)')
  else damage.forEach((r) => lines.push(`${r.name}: ${r.sum} ${r.unit}`))
  return lines.join('\n')
}

const MONTH_MAP: Record<string, number> = {
  januari: 1, january: 1,
  februari: 2, february: 2,
  maret: 3, march: 3,
  april: 4,
  mei: 5, may: 5,
  juni: 6, june: 6,
  juli: 7, july: 7,
  agustus: 8, august: 8,
  september: 9, sept: 9,
  oktober: 10, october: 10,
  november: 11,
  desember: 12, december: 12,
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

/** Senin 00:00 — hari ini 23:59:59.999 WITA (sama seperti getRunningWeekBounds di app) */
function getRunningWeekBounds(reference = new Date()) {
  const TZ = 'Asia/Makassar'
  const cal = reference.toLocaleString('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const [Y, M, D] = cal.split('-').map(Number)
  const todayMidnight = new Date(`${Y}-${pad2(M)}-${pad2(D)}T00:00:00+08:00`)

  const weekdayShort = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
  }).format(reference)
  const idx = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekdayShort)
  const daysBack = idx === -1 ? 0 : idx === 0 ? 6 : idx - 1
  const weekStart = new Date(todayMidnight.getTime() - daysBack * 86400000)
  const weekEnd = new Date(`${Y}-${pad2(M)}-${pad2(D)}T23:59:59.999+08:00`)

  const fmtLong = new Intl.DateTimeFormat('id-ID', {
    timeZone: TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const labelRange = `${fmtLong.format(weekStart)} — ${fmtLong.format(weekEnd)}`
  return { weekStart, weekEnd, labelRange }
}

/** Hari pertama & terakhir kalender (bulan 1–12), WITA */
function getCalendarMonthBoundsWita(year: number, month1to12: number) {
  const start = new Date(`${year}-${pad2(month1to12)}-01T00:00:00+08:00`)
  const lastDay = new Date(year, month1to12, 0).getDate()
  const end = new Date(`${year}-${pad2(month1to12)}-${pad2(lastDay)}T23:59:59.999+08:00`)
  const fmtLong = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Makassar',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const labelRange = `${fmtLong.format(start)} — ${fmtLong.format(end)}`
  return { start, end, labelRange }
}

async function fetchRekapData(supabase: Supabase, startIso: string, endIso: string) {
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
  ])
  if (repRes.error) throw repRes.error
  if (cutRes.error) throw cutRes.error
  const reports = (repRes.data || []) as ReportRow[]
  const cuttings = (cutRes.data || []) as CuttingRow[]
  return { reports, cuttings }
}

async function buildRekapMessage(
  supabase: Supabase,
  rangeStart: Date,
  rangeEnd: Date,
  labelRange: string,
): Promise<string> {
  const startIso = rangeStart.toISOString()
  const endIso = rangeEnd.toISOString()
  const { reports, cuttings } = await fetchRekapData(supabase, startIso, endIso)
  const usageRows = sumByItem(reports, 'Usage')
  const damageRows = sumByItem(reports, 'Damage')
  const cuttingRows = sumCuttingByItem(cuttings)
  return formatReportText(usageRows, cuttingRows, damageRows, labelRange)
}

async function sendViaFonnte(token: string, replyTarget: string, message: string) {
  const fonnteResponse = await fetch(FONNTE_API_URL, {
    method: 'POST',
    headers: { Authorization: token },
    body: new URLSearchParams({
      target: replyTarget,
      message,
      countryCode: '62',
    }),
  })
  if (!fonnteResponse.ok) {
    console.error('[fonnte-bot] Fonnte send failed', await fonnteResponse.text())
  }
  return fonnteResponse.ok
}

serve(async (req) => {
  try {
    const bodyText = await req.text()
    console.log('Raw payload received from Fonnte:', bodyText)

    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(bodyText) as Record<string, unknown>
    } catch {
      const params = new URLSearchParams(bodyText)
      payload = Object.fromEntries(params) as Record<string, unknown>
    }

    const rawMsg =
      payload.message ??
      payload.text ??
      payload.msg ??
      (typeof payload.body === 'string' ? payload.body : null) ??
      (payload.data && typeof payload.data === 'object' && payload.data !== null
        ? (payload.data as Record<string, unknown>).message ?? (payload.data as Record<string, unknown>).text
        : null)

    const messageText = rawMsg?.toString().trim().toLowerCase().normalize('NFKC') ?? ''

    const replyTarget = (payload.sender ?? payload.from ?? payload.chatId ?? payload.chat_id)?.toString().trim()

    if (!replyTarget) {
      console.warn('[fonnte-bot] Missing reply target. Keys:', Object.keys(payload))
      return new Response(JSON.stringify({ success: false, reason: 'Missing sender/from' }), { headers: { 'Content-Type': 'application/json' }, status: 200 })
    }

    if (!messageText) {
      console.warn('[fonnte-bot] Empty message. Keys:', Object.keys(payload))
      return new Response(JSON.stringify({ success: false, reason: 'Missing message text' }), { headers: { 'Content-Type': 'application/json' }, status: 200 })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    // ─── Rekap minggu ini ───
    const isRekapMingguIni = /^rekap\s+minggu\s+ini\s*$/.test(messageText)

    // ─── Rekap <bulan> <tahun>  contoh: rekap april 2026 ───
    const rekapMonthMatch = messageText.match(/^rekap\s+([a-z]+)\s+(\d{4})\s*$/)

    const isStockReportCommand =
      messageText.includes('laporkan sisa stok') ||
      (messageText.includes('laporkan') && messageText.includes('sisa stok'))

    const needsBot =
      isRekapMingguIni || (rekapMonthMatch !== null) || isStockReportCommand

    if (!needsBot) {
      return new Response(JSON.stringify({ success: true, ignored: true }), { headers: { 'Content-Type': 'application/json' }, status: 200 })
    }

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
      return new Response('Server error', { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: settings } = await supabase
      .from('app_settings')
      .select('wa_template_bot_stock, fonnte_api_token, is_active_bot')
      .eq('id', 1)
      .single()

    if (settings?.is_active_bot === false) {
      console.log('[fonnte-bot] Bot disabled in app_settings')
      return new Response(JSON.stringify({ success: true, message: 'Fitur bot sedang dinonaktifkan.' }), { headers: { 'Content-Type': 'application/json' }, status: 200 })
    }

    const fonnteToken = settings?.fonnte_api_token || Deno.env.get('FONNTE_API_TOKEN')
    if (!fonnteToken) {
      console.error('Missing Fonnte API Token')
      return new Response('Server error', { status: 500 })
    }

    // ─── Router: rekap (prioritas di atas stok bila pesan cocok) ───
    if (isRekapMingguIni) {
      const { weekStart, weekEnd, labelRange } = getRunningWeekBounds()
      const text = await buildRekapMessage(supabase, weekStart, weekEnd, labelRange)
      await sendViaFonnte(fonnteToken, replyTarget, text)
      return new Response(JSON.stringify({ success: true, message: 'Rekap minggu ini sent' }), { headers: { 'Content-Type': 'application/json' }, status: 200 })
    }

    if (rekapMonthMatch) {
      const monthWord = rekapMonthMatch[1]
      const yearNum = parseInt(rekapMonthMatch[2], 10)
      const monthNum = MONTH_MAP[monthWord]
      if (!monthNum || !Number.isFinite(yearNum) || yearNum < 2000 || yearNum > 2100) {
        const hint =
          'Format rekap bulan: *Rekap April 2026* (nama bulan + tahun).\nContoh bulan: januari, april, september.'
        await sendViaFonnte(fonnteToken, replyTarget, hint)
        return new Response(JSON.stringify({ success: true, message: 'Invalid month/year hint sent' }), { headers: { 'Content-Type': 'application/json' }, status: 200 })
      }
      const { start, end, labelRange } = getCalendarMonthBoundsWita(yearNum, monthNum)
      const text = await buildRekapMessage(supabase, start, end, labelRange)
      await sendViaFonnte(fonnteToken, replyTarget, text)
      return new Response(JSON.stringify({ success: true, message: 'Rekap bulan sent' }), { headers: { 'Content-Type': 'application/json' }, status: 200 })
    }

    if (isStockReportCommand) {
      console.log('Fetching stock from mst_items...')
      const { data: items, error } = await supabase
        .from('mst_items')
        .select('name, stock, unit')
        .order('name', { ascending: true })

      if (error) {
        throw new Error('Failed to fetch stock: ' + error.message)
      }

      const templateText = settings?.wa_template_bot_stock ||
        `📊 *LAPORAN SISA STOK ARSY JAYA* 📊\n\n{stock_list}\n\n_Diperbarui pada: {date} {time}_`

      let stockListText = ''
      if (!items || items.length === 0) {
        stockListText = 'Belum ada data barang di sistem.'
      } else {
        items.forEach((item, index) => {
          stockListText += `${index + 1}. *${item.name}*: ${item.stock} ${item.unit}\n`
        })
      }

      const now = new Date()
      const jakartaDate = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Makassar',
        day: '2-digit', month: '2-digit', year: 'numeric',
      }).format(now)
      const jakartaTime = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Makassar',
        hour: '2-digit', minute: '2-digit', hour12: false,
      }).format(now) + ' WITA'

      const replyText = templateText
        .replace('{stock_list}', stockListText.trim())
        .replace('{date}', jakartaDate)
        .replace('{time}', jakartaTime)

      console.log('Sending stock reply to: ' + replyTarget)
      await sendViaFonnte(fonnteToken, replyTarget, replyText)
      return new Response(JSON.stringify({ success: true, message: 'Stock report sent' }), { headers: { 'Content-Type': 'application/json' }, status: 200 })
    }

    return new Response(JSON.stringify({ success: true, ignored: true }), { headers: { 'Content-Type': 'application/json' }, status: 200 })
  } catch (error) {
    const err = error as Error
    console.error('Edge Function Error:', err.message)
    return new Response(
      JSON.stringify({ error: err.message }),
      { headers: { 'Content-Type': 'application/json' }, status: 400 },
    )
  }
})
