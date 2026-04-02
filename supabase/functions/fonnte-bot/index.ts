import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const FONNTE_API_URL = "https://api.fonnte.com/send"

serve(async (req) => {
  try {
    // Parse webhook request from Fonnte (usually application/json)
    const bodyText = await req.text()
    console.log("Raw payload received from Fonnte:", bodyText)

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(bodyText) as Record<string, unknown>;
    } catch (e) {
      // Fonnte might send x-www-form-urlencoded depending on settings
      const params = new URLSearchParams(bodyText);
      payload = Object.fromEntries(params) as Record<string, unknown>;
    }

    // Teks pesan: beberapa versi payload Fonnte memakai key berbeda
    const rawMsg =
      payload.message ??
      payload.text ??
      payload.msg ??
      (typeof payload.body === "string" ? payload.body : null) ??
      (payload.data && typeof payload.data === "object" && payload.data !== null
        ? (payload.data as Record<string, unknown>).message ?? (payload.data as Record<string, unknown>).text
        : null);

    const messageText = rawMsg?.toString().trim().toLowerCase().normalize("NFKC") ?? "";

    // Target balasan: private / grup (@g.us)
    const replyTarget = (payload.sender ?? payload.from ?? payload.chatId ?? payload.chat_id)?.toString().trim();

    if (!replyTarget) {
      console.warn("[fonnte-bot] Missing reply target. Keys:", Object.keys(payload));
      return new Response(JSON.stringify({ success: false, reason: "Missing sender/from" }), { headers: { "Content-Type": "application/json" }, status: 200 });
    }

    if (!messageText) {
      console.warn("[fonnte-bot] Empty message. Keys:", Object.keys(payload));
      return new Response(JSON.stringify({ success: false, reason: "Missing message text" }), { headers: { "Content-Type": "application/json" }, status: 200 });
    }

    // Perintah: "laporkan sisa stok" / "laporkan sisa stok bahan" / variasi (tanpa tergantung urutan ketat)
    const isStockReportCommand =
      messageText.includes("laporkan sisa stok") ||
      (messageText.includes("laporkan") && messageText.includes("sisa stok"));

    // ==========================================
    // COMMAND ROUTER
    // ==========================================
    if (isStockReportCommand) {

      // Connect to Supabase
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

      if (!supabaseUrl || !supabaseKey) {
        console.error("Missing critical environment variables.");
        return new Response("Server error", { status: 500 });
      }

      const supabase = createClient(supabaseUrl, supabaseKey)

      // Fetch settings for template
      const { data: settings } = await supabase.from('app_settings').select('wa_template_bot_stock, fonnte_api_token, is_active_bot').eq('id', 1).single();

      if (settings?.is_active_bot === false) {
        console.log("Bot reply is disabled in app_settings.");
        return new Response(JSON.stringify({ success: true, message: "Fitur bot laporan stok sedang dinonaktifkan." }), { headers: { 'Content-Type': 'application/json' }, status: 200 });
      }

      const fonnteToken = settings?.fonnte_api_token || Deno.env.get('FONNTE_API_TOKEN');
      if (!fonnteToken) {
        console.error("Missing Fonnte API Token.");
        return new Response("Server error", { status: 500 });
      }

      console.log("Fetching stock from mst_items...");
      // Query current stock levels
      const { data: items, error } = await supabase
        .from('mst_items')
        .select('name, stock, unit')
        .order('name', { ascending: true });

      if (error) {
        throw new Error("Failed to fetch stock: " + error.message);
      }

      const templateText = settings?.wa_template_bot_stock || `📊 *LAPORAN SISA STOK ARSY JAYA* 📊\n\n{stock_list}\n\n_Diperbarui pada: {date} {time}_`;

      // Build formatting string for {stock_list}
      let stockListText = "";
      if (!items || items.length === 0) {
        stockListText = "Belum ada data barang di sistem.";
      } else {
        items.forEach((item, index) => {
          stockListText += `${index + 1}. *${item.name}*: ${item.stock} ${item.unit}\n`;
        });
      }

      const now = new Date();
      const jakartaDate = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Makassar',
        day: '2-digit', month: '2-digit', year: 'numeric'
      }).format(now);
      const jakartaTime = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Makassar',
        hour: '2-digit', minute: '2-digit', hour12: false
      }).format(now) + ' WITA';

      const replyText = templateText
        .replace('{stock_list}', stockListText.trim())
        .replace('{date}', jakartaDate)
        .replace('{time}', jakartaTime);

      // Kirim balasan — sama seperti fonnte-alert (URLSearchParams + countryCode)
      console.log("Sending reply to: " + replyTarget);
      const fonnteResponse = await fetch(FONNTE_API_URL, {
        method: "POST",
        headers: { Authorization: fonnteToken },
        body: new URLSearchParams({
          target: replyTarget,
          message: replyText,
          countryCode: "62",
        }),
      });

      if (!fonnteResponse.ok) {
        console.error("Failed to send reply via Fonnte", await fonnteResponse.text());
      } else {
        console.log("Reply sent successfully.");
      }

      return new Response(JSON.stringify({ success: true, message: "Stock report sent" }), { headers: { "Content-Type": "application/json" }, status: 200 })
    }

    // Ignore unknown commands quietly
    return new Response(JSON.stringify({ success: true, ignored: true }), { headers: { "Content-Type": "application/json" }, status: 200 })

  } catch (error) {
    console.error("Edge Function Error:", error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { "Content-Type": "application/json" }, status: 400 }
    )
  }
})
