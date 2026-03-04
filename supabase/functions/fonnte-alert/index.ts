import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const FONNTE_API_URL = "https://api.fonnte.com/send"

serve(async (req) => {
    try {
        const payload = await req.json()

        // We only process INSERT events
        if (payload.type !== 'INSERT') {
            return new Response(JSON.stringify({ success: true, message: "Not an INSERT event. Ignored." }), { headers: { "Content-Type": "application/json" }, status: 200 })
        }

        const table = payload.table
        const record = payload.record

        // Connect to Supabase
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        const fonnteToken = Deno.env.get('FONNTE_API_TOKEN')

        if (!supabaseUrl || !supabaseKey || !fonnteToken) {
            throw new Error("Missing critical environment variables.")
        }

        const supabase = createClient(supabaseUrl, supabaseKey)

        // Fetch Global Settings (Phone & Templates)
        const { data: settingsData, error: settingsError } = await supabase
            .from('app_settings')
            .select(`
                wa_threshold, 
                spv_wa_number,
                spv_wa_group,
                wa_template_damage,
                wa_template_usage,
                wa_template_stockin,
                wa_template_cutting,
                wa_template_defect
            `)
            .eq('id', 1)
            .single()

        if (settingsError) throw new Error('Error fetching app settings')

        // Combine targets (comma separated for Fonnte API)
        const targets = [];
        if (settingsData.spv_wa_number) targets.push(settingsData.spv_wa_number);
        if (settingsData.spv_wa_group) targets.push(settingsData.spv_wa_group);

        const waTargets = targets.join(',');
        const waThreshold = settingsData.wa_threshold || 10

        let message = ""

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
                .replace(/{qty}/g, data.qty || '0')
                .replace(/{unit}/g, data.unit || 'pcs')
                .replace(/{notes}/g, data.notes || '-')
                .replace(/{final_stock}/g, data.final_stock || '0')
                .replace(/{order}/g, data.order || '-')
                .replace(/{category}/g, data.category || '-')
                .replace(/{source}/g, data.source || '-')
                .replace(/{reporter}/g, data.reporter || 'System')
                .replace(/{date}/g, jakartaDate)
                .replace(/{time}/g, jakartaTime);
        }

        // ==========================================
        // ROUTING BERDASARKAN TABEL
        // ==========================================

        if (table === 'trx_reports') {
            // Laporan Pemakaian atau Kerusakan (Dari OP_CETAK / OP_CUTTING)

            // Filter: Hanya kirim Damage jika >= threshold. Pemakaian selalu kirim.
            if (record.type === 'Damage' && record.quantity < waThreshold) {
                return new Response(JSON.stringify({ success: true, message: `Damage quantity (${record.quantity}) < threshold (${waThreshold}). Ignored.` }), { headers: { "Content-Type": "application/json" }, status: 200 })
            }

            // Fetch relations
            const { data: itemData } = await supabase.from('mst_items').select('name, unit').eq('id', record.item_id).single()
            const { data: opData } = await supabase.from('profiles').select('full_name').eq('id', record.operator_id).single()

            const templateData = {
                operator: opData?.full_name,
                item: itemData?.name,
                qty: record.quantity,
                unit: itemData?.unit,
                notes: record.notes
            }

            if (record.type === 'Damage') {
                message = formatMessage(settingsData.wa_template_damage || `🚨 Laporan Kerusakan: {qty} {unit} {item} oleh {operator}. Alasan: {notes}`, templateData);
            } else if (record.type === 'Usage') {
                message = formatMessage(settingsData.wa_template_usage || `✅ Laporan Pemakaian: {qty} {unit} {item} oleh {operator}.`, templateData);
            }
        }

        else if (table === 'trx_stock_log') {
            // Stok Masuk Baru (Dari SPV / SALES)

            // Alert ONLY for 'stock_in'. Database might store it as 'STOCK_IN' or 'stock_in'
            if (!record.source || record.source.toLowerCase() !== 'stock_in') {
                return new Response(JSON.stringify({ success: true, message: `Not a stock_in event (source: ${record.source}). Ignored.` }), { headers: { "Content-Type": "application/json" }, status: 200 })
            }

            // Fetch relations
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

            message = formatMessage(settingsData.wa_template_stockin || `📦 Stok Masuk: {qty} {unit} {item} oleh {operator}. Stok Akhir: {final_stock} {unit}. Catatan: {notes}`, templateData);
        }

        else if (table === 'trx_cutting_log') {
            // Tracking Cutting (Dari OP_CUTTING)

            // Fetch relations
            const { data: opData } = await supabase.from('profiles').select('full_name').eq('id', record.operator_id).single()

            const templateData = {
                operator: opData?.full_name || 'OP Cutting',
                order: record.order_name,
                qty: record.qty_cut,
                notes: record.notes
            }

            message = formatMessage(settingsData.wa_template_cutting || `✂️ Log Cutting: {qty} lembar untuk order {order} oleh {operator}. Catatan: {notes}`, templateData);
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

            message = formatMessage(settingsData.wa_template_defect || `⚠️ *LAPORAN KENDALA PRODUKSI* ⚠️\nOrder: {order}\nKategori: {category}\nTerdakwa: {source}\nQty Gagal: {qty}\nCatatan: {notes}\nPelapor: {reporter}`, templateData);
        }

        else {
            return new Response(JSON.stringify({ success: true, message: `Table ${table} not monitored. Ignored.` }), { headers: { "Content-Type": "application/json" }, status: 200 })
        }

        // ==========================================
        // EXECUTE SEND TO FONNTE
        // ==========================================

        if (message && waTargets) {
            const response = await fetch(FONNTE_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': fonnteToken,
                },
                body: new URLSearchParams({
                    target: waTargets,
                    message: message,
                    countryCode: '62'
                })
            })

            const result = await response.json()

            return new Response(JSON.stringify({ success: true, sent_to: waTargets, event: `${table} / ${record.type || record.source || 'insert'}`, fonnte_response: result }), {
                headers: { "Content-Type": "application/json" },
                status: 200,
            })
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
