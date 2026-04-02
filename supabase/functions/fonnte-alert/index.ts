import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const FONNTE_API_URL = "https://api.fonnte.com/send"

serve(async (req) => {
    try {
        const payload = await req.json()
        console.log('[fonnte-alert] Incoming:', payload.table, payload.type, payload.record?.source || payload.record?.type || '-')

        // We only process INSERT events
        if (payload.type !== 'INSERT') {
            return new Response(JSON.stringify({ success: true, message: "Not an INSERT event. Ignored." }), { headers: { "Content-Type": "application/json" }, status: 200 })
        }

        const table = payload.table
        const record = payload.record

        // Connect to Supabase
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        if (!supabaseUrl || !supabaseKey) {
            throw new Error("Missing critical environment variables.")
        }

        const supabase = createClient(supabaseUrl, supabaseKey)

        // ==========================================
        // DEDUPLICATION LOGIC
        // ==========================================
        const eventKey = `${table}:${record.id}:${payload.type}`
        
        // 1. Cleanup old events first (keep it light, delete events older than 1 minute)
        await supabase.from('processed_events').delete().lt('created_at', new Date(Date.now() - 60000).toISOString())

        // 2. Try to insert current event (PK event_key = idempotency)
        const { error: eventError } = await supabase
            .from('processed_events')
            .insert({ event_key: eventKey })
            .select()
            .single()

        if (eventError) {
            const errMsg = eventError.message ?? ''
            const isDuplicate =
                eventError.code === '23505' ||
                errMsg.includes('duplicate key') ||
                errMsg.includes('unique constraint')
            if (isDuplicate) {
                console.log(`[fonnte-alert] Duplicate event detected for ${eventKey}. Skipping.`)
                return new Response(JSON.stringify({
                    success: true,
                    message: "Duplicate event detected and ignored.",
                    key: eventKey,
                }), { headers: { "Content-Type": "application/json" }, status: 200 })
            }
            console.error('[fonnte-alert] processed_events insert failed:', eventError)
            throw new Error(`processed_events insert failed: ${errMsg}`)
        }

        console.log(`[fonnte-alert] Processing new event: ${eventKey}`)

        // Fetch Global Settings (Phone & Templates)
        // select('*') agar tidak error jika kolom template baru belum dimigrasikan
        const { data: settingsData, error: settingsError } = await supabase
            .from('app_settings')
            .select('*')
            .eq('id', 1)
            .single()

        if (settingsError) throw new Error('Error fetching app settings')

        // Fallback Fonnte API Token: prioritize DB, then ENV
        const fonnteToken = settingsData.fonnte_api_token || Deno.env.get('FONNTE_API_TOKEN')
        if (!fonnteToken) {
            throw new Error("Missing Fonnte API Token.")
        }

        // Combine targets (comma separated for Fonnte API)
        const targets = [];
        if (settingsData.spv_wa_number) targets.push(settingsData.spv_wa_number);
        if (settingsData.spv_wa_group) targets.push(settingsData.spv_wa_group);

        const waTargets = targets.join(',');
        const waThreshold = settingsData.wa_threshold || 10

        let message = ""
        /** true jika pesan yang dikirim = peringatan restok (dari trx_stock_log REPORT_USAGE) */
        let sentRestockAlert = false

        // Helper function to replace template variables
        const formatMessage = (templateText: string, data: any) => {
            if (!templateText) return "";
            const now = new Date();
            const jakartaDate = new Intl.DateTimeFormat('id-ID', {
                timeZone: 'Asia/Makassar',
                day: '2-digit', month: '2-digit', year: 'numeric'
            }).format(now);
            const jakartaTime = new Intl.DateTimeFormat('id-ID', {
                timeZone: 'Asia/Makassar',
                hour: '2-digit', minute: '2-digit', hour12: false
            }).format(now) + ' WITA';

            return templateText
                .replace(/{operator}/g, data.operator || 'Unknown')
                .replace(/{item}/g, data.item || 'Unknown')
                .replace(/{qty}/g, String(data.qty ?? '0'))
                .replace(/{unit}/g, data.unit || 'pcs')
                .replace(/{notes}/g, data.notes || '-')
                .replace(/{final_stock}/g, String(data.final_stock ?? '0'))
                .replace(/{stock}/g, String(data.stock ?? '0'))
                .replace(/{min_stock}/g, String(data.min_stock ?? '0'))
                .replace(/{order}/g, data.order || '-')
                .replace(/{category}/g, data.category || '-')
                .replace(/{source}/g, data.source || '-')
                .replace(/{reporter}/g, data.reporter || 'System')
                .replace(/{date}/g, jakartaDate)
                .replace(/{time}/g, jakartaTime);
        }

        const sendFonnte = async (msg: string) => {
            const response = await fetch(FONNTE_API_URL, {
                method: 'POST',
                headers: { 'Authorization': fonnteToken },
                body: new URLSearchParams({ target: waTargets, message: msg, countryCode: '62' }),
            })
            const body = await response.json()
            if (!response.ok) {
                console.error('[fonnte-alert] Fonnte API error:', response.status, JSON.stringify(body))
            } else {
                console.log('[fonnte-alert] Fonnte API success:', response.status)
            }
            return { http_status: response.status, ok: response.ok, body }
        }

        // ==========================================
        // ROUTING BERDASARKAN TABEL
        // ==========================================

        if (table === 'trx_reports') {
            // Laporan Pemakaian atau Kerusakan (Dari OP_CETAK / OP_CUTTING)
            // Enum / JSON webhook kadang kirim type dengan casing berbeda
            const reportTypeRaw = (record.type ?? '').toString().trim()
            const reportType = reportTypeRaw.toLowerCase()
            const isDamage = reportType === 'damage'
            const isUsage = reportType === 'usage'

            if (!isDamage && !isUsage) {
                return new Response(
                    JSON.stringify({
                        success: true,
                        message: `trx_reports row ignored: unknown type "${reportTypeRaw}" (expected Usage or Damage).`,
                    }),
                    { headers: { 'Content-Type': 'application/json' }, status: 200 },
                )
            }

            // Filter: Hanya kirim Damage jika >= threshold. Pemakaian selalu kirim.
            if (isDamage && record.quantity < waThreshold) {
                return new Response(JSON.stringify({ success: true, message: `Damage quantity (${record.quantity}) < threshold (${waThreshold}). Ignored.` }), { headers: { "Content-Type": "application/json" }, status: 200 })
            }

            // Peringatan restok dipindah ke trx_stock_log (REPORT_USAGE) agar pakai final_stock yang selalu benar
            const { data: itemData } = await supabase.from('mst_items').select('name, unit').eq('id', record.item_id).single()
            const { data: opData } = await supabase.from('profiles').select('full_name').eq('id', record.operator_id).single()

            const templateData = {
                operator: opData?.full_name,
                item: itemData?.name,
                qty: record.quantity,
                unit: itemData?.unit,
                notes: record.notes
            }

            if (isDamage) {
                if (settingsData.is_active_damage !== false) {
                    message = formatMessage(settingsData.wa_template_damage || `🚨 Laporan Kerusakan: {qty} {unit} {item} oleh {operator}. Alasan: {notes}`, templateData);
                }
            } else if (isUsage) {
                if (settingsData.is_active_usage !== false) {
                    message = formatMessage(settingsData.wa_template_usage || `✅ Laporan Pemakaian: {qty} {unit} {item} oleh {operator}.`, templateData);
                }
            }
        }

        else if (table === 'trx_stock_log') {
            const src = (record.source ?? '').toString().trim().toLowerCase()

            // --- Pemakaian tercatat di log: WA restok pakai final_stock (tepat setelah RPC) ---
            if (src === 'report_usage' || src === 'report_damage') {
                const finalStock = Number(record.final_stock)
                const qtyUsed = Math.abs(Number(record.change_amount ?? 0))

                const { data: itemData } = await supabase
                    .from('mst_items')
                    .select('name, unit, min_stock')
                    .eq('id', record.item_id)
                    .single()
                const { data: opData } = await supabase.from('profiles').select('full_name').eq('id', record.changed_by).single()

                const minStock = Number(itemData?.min_stock ?? 0)
                console.log(`[fonnte-alert] Restok check: item=${itemData?.name}, final_stock=${finalStock}, min_stock=${minStock}, source=${src}`)
                if (!(minStock > 0)) {
                    console.log('[fonnte-alert] Skipped: min_stock not set (0 or empty)')
                    return new Response(
                        JSON.stringify({
                            success: true,
                            message: `Restock WA skipped: min_stock on item is 0 or empty — set Min. Stok di Inventory agar zona kritis & WA restok jalan. (source: ${record.source})`,
                        }),
                        { headers: { 'Content-Type': 'application/json' }, status: 200 },
                    )
                }
                if (!Number.isFinite(finalStock) || finalStock > minStock) {
                    console.log(`[fonnte-alert] Skipped: final_stock (${finalStock}) > min_stock (${minStock}), stok masih aman`)
                    return new Response(
                        JSON.stringify({
                            success: true,
                            message: `Restock WA skipped: final_stock ${finalStock} above min_stock ${minStock}.`,
                        }),
                        { headers: { 'Content-Type': 'application/json' }, status: 200 },
                    )
                }

                const restockData = {
                    operator: opData?.full_name || 'Operator',
                    item: itemData?.name,
                    qty: qtyUsed,
                    unit: itemData?.unit,
                    notes: record.notes,
                    stock: finalStock,
                    min_stock: minStock,
                    final_stock: finalStock,
                }
                const defaultRestock = `📛 *PERINGATAN RESTOK* 📛

Bahan: *{item}*
Sisa stok setelah pemakaian: *{stock}* {unit}
Batas minimal: *{min_stock}* {unit}

Bahan ini *masih dalam zona kritis*. Mohon restok sebelum pemakaian berlanjut.

Operator: {operator}
Qty dipakai (laporan ini): {qty} {unit}
Waktu: {date} {time}`
                const restockTpl = (settingsData as Record<string, string | undefined>).wa_template_restock_usage
                
                if (settingsData.is_active_restock !== false) {
                    message = formatMessage(restockTpl || defaultRestock, restockData)
                    sentRestockAlert = true
                } else {
                    console.log(`[fonnte-alert] Restock WA skipped: is_active_restock is false`)
                }
            } else if (src === 'stock_in') {
                const { data: itemData } = await supabase.from('mst_items').select('name, unit').eq('id', record.item_id).single()
                const { data: opData } = await supabase.from('profiles').select('full_name').eq('id', record.changed_by).single()

                const templateData = {
                    operator: opData?.full_name || 'System / Admin',
                    item: itemData?.name,
                    qty: record.change_amount,
                    unit: itemData?.unit,
                    final_stock: record.final_stock,
                    notes: record.notes
                }

                if (settingsData.is_active_stockin !== false) {
                    message = formatMessage(settingsData.wa_template_stockin || `📦 Stok Masuk: {qty} {unit} {item} oleh {operator}. Stok Akhir: {final_stock} {unit}. Catatan: {notes}`, templateData);
                }
            } else {
                return new Response(JSON.stringify({ success: true, message: `trx_stock_log ignored (source: ${record.source}).` }), { headers: { "Content-Type": "application/json" }, status: 200 })
            }
        }

        else if (table === 'trx_cutting_log') {
            // Tracking Cutting (Dari OP_CUTTING)

            // Fetch relations
            const { data: opData } = await supabase.from('profiles').select('full_name').eq('id', record.operator_id).single()
            let itemName = 'Unknown';
            if (record.item_id) {
                const { data: itemData } = await supabase.from('mst_items').select('name').eq('id', record.item_id).single()
                if (itemData) itemName = itemData.name;
            }

            const templateData = {
                operator: opData?.full_name || 'OP Cutting',
                order: record.order_name,
                qty: record.qty_cut,
                item: itemName,
                notes: record.notes
            }

            if (settingsData.is_active_cutting !== false) {
                message = formatMessage(settingsData.wa_template_cutting || `✂️ Log Cutting: {qty} lembar {item} untuk order {order} oleh {operator}. Catatan: {notes}`, templateData);
            }
        }

        else if (table === 'trx_defects') {
            // Laporan Kendala QC (Defects)

            // Fetch relations
            const { data: opData } = await supabase.from('profiles').select('full_name').eq('id', record.reporter_id).single()

            const templateData = {
                reporter: opData?.full_name || 'Unknown',
                order: record.order_name,
                category: record.error_category,
                source: record.error_source,
                qty: record.quantity,
                notes: record.notes || '-'
            }

            if (settingsData.is_active_defect !== false) {
                message = formatMessage(settingsData.wa_template_defect || `⚠️ *LAPORAN KENDALA PRODUKSI* ⚠️\nOrder: {order}\nKategori: {category}\nTerdakwa: {source}\nQty Gagal: {qty}\nCatatan: {notes}\nPelapor: {reporter}`, templateData);
            }
        }

        else {
            return new Response(JSON.stringify({ success: true, message: `Table ${table} not monitored. Ignored.` }), { headers: { "Content-Type": "application/json" }, status: 200 })
        }

        // ==========================================
        // EXECUTE SEND TO FONNTE
        // ==========================================

        if (message && waTargets) {
            const fonnteResponses: unknown[] = [await sendFonnte(message)]

            return new Response(
                JSON.stringify({
                    success: true,
                    sent_to: waTargets,
                    event: `${table} / ${record.type || record.source || 'insert'}`,
                    restock_sent: sentRestockAlert,
                    fonnte_responses: fonnteResponses,
                }),
                { headers: { "Content-Type": "application/json" }, status: 200 },
            )
        }

        return new Response(JSON.stringify({ success: false, message: "Failed to construct message or missing Wa Target Number." }), {
            headers: { "Content-Type": "application/json" },
            status: 400,
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { "Content-Type": "application/json" },
            status: 500,
        })
    }
})
