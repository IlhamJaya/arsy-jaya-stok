-- ==============================================================================================
-- UPDATE SCHEMA: Add WhatsApp Template for Defects & Trigger
-- ==============================================================================================

-- 1. Tambahkan Custom Template WA untuk trx_defects
ALTER TABLE public.app_settings 
ADD COLUMN IF NOT EXISTS wa_template_defect TEXT DEFAULT '⚠️ *LAPORAN KENDALA PRODUKSI* ⚠️

*Detail Laporan:*
• Orderan: {order}
• Kategori: {category}
• Terdakwa: {source}
• Qty Gagal: {qty}
• Catatan: "{notes}"
• Dilapor Oleh: {reporter}

Mohon segera ditindaklanjuti.
_Sistem Notifikasi Arsy Stok Pro_';

-- 2. Buat Webhook Trigger dari trx_defects ke fonnte-alert
CREATE OR REPLACE TRIGGER "after_defect_insert_alert"
AFTER INSERT ON "public"."trx_defects"
FOR EACH ROW
EXECUTE FUNCTION "supabase_functions"."http_request"(
  'http://host.docker.internal:54321/functions/v1/fonnte-alert',
  'POST',
  '{"Content-type":"application/json"}',
  '{}',
  '1000'
);
