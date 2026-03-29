import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const FONNTE_API_URL = "https://api.fonnte.com/send"

serve(async (req) => {
  try {
    // Parse webhook request from Fonnte (usually application/json)
    const bodyText = await req.text()
    console.log("Raw payload received from Fonnte:", bodyText)

    let payload;
    try {
      payload = JSON.parse(bodyText);
    } catch (e) {
      // Fonnte might send x-www-form-urlencoded depending on settings
      const params = new URLSearchParams(bodyText);
      payload = Object.fromEntries(params);
    }

    // Validate sender and message
    const messageText = (payload.message || payload.text || "").toString().trim().toLowerCase();

    // Fonnte sends Private Chats via `sender`, and Group Chats via `sender` + webhook might contain `group` or a group-formatted `sender` id (ending with @g.us).
    // Let's grab the actual target to reply to. If it's a group, the reply target should be the `sender` which actually contains the Group ID (e.g. 123456789-12345@g.us)
    const replyTarget = payload.sender || payload.from;

    if (!messageText || !replyTarget) {
      return new Response(JSON.stringify({ success: false, reason: "Missing message or sender" }), { headers: { "Content-Type": "application/json" }, status: 200 })
    }

    // ==========================================
    // COMMAND ROUTER
    // ==========================================
    if (messageText.includes("laporkan sisa stok")) {

      // Connect to Supabase
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

      if (!supabaseUrl || !supabaseKey) {
        console.error("Missing critical environment variables.");
        return new Response("Server error", { status: 500 });
      }

      const supabase = createClient(supabaseUrl, supabaseKey)

      // Fetch settings for template
      const { data: settings } = await supabase.from('app_settings').select('wa_template_bot_stock, fonnte_api_token').eq('id', 1).single();

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

      // Enqueue reply back via Fonnte
      console.log("Sending reply to: " + replyTarget);
      const fonntePayload = new FormData();
      fonntePayload.append("target", replyTarget);
      fonntePayload.append("message", replyText);

      const fonnteResponse = await fetch(FONNTE_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': fonnteToken
        },
        body: fonntePayload
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
