-- ==============================================================================================
-- UPDATE SCHEMA: Add Message Templates to app_settings
-- ==============================================================================================
-- Run this in Supabase SQL Editor

-- 1. Add Columns to app_settings
ALTER TABLE public.app_settings 
ADD COLUMN IF NOT EXISTS wa_template_damage TEXT,
ADD COLUMN IF NOT EXISTS wa_template_usage TEXT,
ADD COLUMN IF NOT EXISTS wa_template_stockin TEXT,
ADD COLUMN IF NOT EXISTS wa_template_cutting TEXT;

-- 2. Set Default Values if empty
UPDATE public.app_settings
SET 
  wa_template_damage = '🚨 *LAPORAN KERUSAKAN BARU* 🚨

*Detail Laporan:*
• Operator: {operator}
• Item: {item}
• Jumlah Rusak: {qty} {unit}
• Alasan: "{notes}"

Mohon segera cek dashboard untuk tindakan.
_Sistem Notifikasi Arsy Stok Pro_',

  wa_template_usage = '✅ *LAPORAN PEMAKAIAN* ✅

*Detail Laporan:*
• Operator: {operator}
• Item: {item}
• Jumlah Dipakai: {qty} {unit}

Menunggu Approval SPV di Dashboard.
_Sistem Notifikasi Arsy Stok Pro_',

  wa_template_stockin = '📦 *STOK MASUK BARU* 📦

*Detail Penambahan:*
• Diinput Oleh: {operator}
• Item: {item}
• Jumlah Masuk: {qty} {unit}
• Stok Akhir: {final_stock} {unit}
• Catatan: "{notes}"

Stok fisik telah berhasil diperbarui.
_Sistem Notifikasi Arsy Stok Pro_',

  wa_template_cutting = '✂️ *LOG CUTTING STIKER* ✂️

*Detail Pengerjaan:*
• Operator: {operator}
• Orderan: {order}
• Jumlah Di-Cut: {qty} lembar
• Catatan: "{notes}"

_Sistem Notifikasi Arsy Stok Pro_'
WHERE id = 1 AND wa_template_damage IS NULL;
