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
    const senderNumber = payload.sender || payload.from;

    if (!messageText || !senderNumber) {
      return new Response(JSON.stringify({ success: false, reason: "Missing message or sender" }), { headers: { "Content-Type": "application/json" }, status: 200 })
    }

    // ==========================================
    // COMMAND ROUTER
    // ==========================================
    if (messageText.includes("laporkan sisa stok")) {

      // Connect to Supabase
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      const fonnteToken = Deno.env.get('FONNTE_API_TOKEN')

      if (!supabaseUrl || !supabaseKey || !fonnteToken) {
        console.error("Missing critical environment variables.");
        return new Response("Server error", { status: 500 });
      }

      const supabase = createClient(supabaseUrl, supabaseKey)

      console.log("Fetching stock from mst_items...");
      // Query current stock levels
      const { data: items, error } = await supabase
        .from('mst_items')
        .select('name, stock, unit')
        .order('name', { ascending: true });

      if (error) {
        throw new Error("Failed to fetch stock: " + error.message);
      }

      // Build formatting string
      let replyText = "📊 *LAPORAN SISA STOK ARSY JAYA* 📊\n\n";
      if (!items || items.length === 0) {
        replyText += "Belum ada data barang di sistem.";
      } else {
        items.forEach((item, index) => {
          replyText += `${index + 1}. *${item.name}*: ${item.stock} ${item.unit}\n`;
        });
      }

      const now = new Date();
      const jakartaTime = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Makassar',
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      }).format(now) + ' WITA';

      replyText += `\n_Diperbarui pada: ${jakartaTime}_`;

      // Enqueue reply back via Fonnte
      console.log("Sending reply to: " + senderNumber);
      const fonntePayload = new FormData();
      fonntePayload.append("target", senderNumber);
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
