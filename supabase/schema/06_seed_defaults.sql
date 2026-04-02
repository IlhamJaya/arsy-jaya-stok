-- ==============================================================================================
-- 06: DATA DEFAULT (SEED)
-- ==============================================================================================
-- Jalankan TERAKHIR setelah semua file sebelumnya.

-- Insert default app_settings row
INSERT INTO public.app_settings (
  id,
  wa_template_damage,
  wa_template_usage,
  wa_template_stockin,
  wa_template_cutting,
  wa_template_defect,
  wa_template_restock_usage,
  wa_template_bot_stock
) VALUES (
  1,
  '🚨 *LAPORAN KERUSAKAN BARU* 🚨

*Detail Laporan:*
• Operator: {operator}
• Item: {item}
• Jumlah Rusak: {qty} {unit}
• Alasan: "{notes}"

Mohon segera cek dashboard untuk tindakan.
_Sistem Notifikasi Arsy Stok Pro_',

  '✅ *LAPORAN PEMAKAIAN* ✅

*Detail Laporan:*
• Operator: {operator}
• Item: {item}
• Jumlah Dipakai: {qty} {unit}

Stok telah dipotong otomatis sesuai laporan (submit langsung dari OP_CETAK).
_Sistem Notifikasi Arsy Stok Pro_',

  '📦 *STOK MASUK BARU* 📦

*Detail Penambahan:*
• Diinput Oleh: {operator}
• Item: {item}
• Jumlah Masuk: {qty} {unit}
• Stok Akhir: {final_stock} {unit}
• Catatan: "{notes}"

Stok fisik telah berhasil diperbarui.
_Sistem Notifikasi Arsy Stok Pro_',

  '✂️ *LOG CUTTING STIKER* ✂️

*Detail Pengerjaan:*
• Operator: {operator}
• Orderan: {order}
• Jumlah Di-Cut: {qty} lembar
• Catatan: "{notes}"

_Sistem Notifikasi Arsy Stok Pro_',

  '⚠️ *LAPORAN KENDALA PRODUKSI* ⚠️

*Detail Laporan:*
• Orderan: {order}
• Kategori: {category}
• Terdakwa: {source}
• Qty Gagal: {qty}
• Catatan: "{notes}"
• Dilapor Oleh: {reporter}

Mohon segera ditindaklanjuti.
_Sistem Notifikasi Arsy Stok Pro_',

  '📛 *PERINGATAN RESTOK* 📛

Bahan: *{item}*
Sisa stok setelah pemakaian: *{stock}* {unit}
Batas minimal: *{min_stock}* {unit}

Bahan ini *masih dalam zona kritis*. Mohon restok sebelum pemakaian berlanjut.

Operator: {operator}
Qty dipakai (laporan ini): {qty} {unit}
Waktu: {date} {time}',

  '📊 *LAPORAN SISA STOK ARSY JAYA* 📊

{stock_list}

_Diperbarui pada: {date} {time}_'
)
ON CONFLICT (id) DO NOTHING;

-- Notify PostgREST reload
NOTIFY pgrst, 'reload schema';

-- ==============================================================================================
-- SELESAI! Langkah selanjutnya:
-- 1. Buat user pertama (SPV) via Supabase Auth Dashboard
-- 2. Update role di tabel profiles menjadi 'SPV'
-- 3. Deploy Edge Functions: fonnte-alert (verify_jwt off) dan fonnte-bot
-- 4. Database Webhooks (disarankan): trx_reports, trx_stock_log, trx_defects; opsional trx_cutting_log jika tidak pakai trigger SQL
-- 5. Secret Supabase: FONNTE_API_TOKEN (bukan kolom Settings di app)
-- ==============================================================================================
