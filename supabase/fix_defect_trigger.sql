-- ==============================================================================================
-- FIX: Perbaiki trigger trx_defects agar URL-nya SAMA dengan 3 trigger lain yang berhasil.
-- Trigger lama menggunakan URL lokal Docker (tidak bekerja di production).
-- ==============================================================================================

-- 1. Hapus trigger lama yang salah (URL Docker lokal)
DROP TRIGGER IF EXISTS "after_defect_insert_alert" ON "public"."trx_defects";

-- 2. Buat ulang trigger dengan URL yang SAMA persis seperti 3 webhook lainnya
CREATE OR REPLACE TRIGGER "after_defect_insert_alert"
AFTER INSERT ON "public"."trx_defects"
FOR EACH ROW
EXECUTE FUNCTION "supabase_functions"."http_request"(
  'https://osyfdkwqsssyjvrxtrht.supabase.co/functions/v1/fonnte-alert',
  'POST',
  '{"Content-type":"application/json"}',
  '{}',
  '5000'
);
