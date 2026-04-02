-- ==============================================================================================
-- 05: FONNTE / WHATSAPP TRIGGERS & NOTIFICATIONS
-- ==============================================================================================
-- Jalankan SETELAH 04_rpc_functions.sql
--
-- Edge function fonnte-alert: trx_reports (Usage/Damage), trx_stock_log (hanya STOCK_IN), cutting, defects.
-- Jangan dobel: jika pakai Database Webhook untuk tabel yang sama, biarkan trigger SQL tetap comment / nonaktif.
--
-- PENTING: Ganti <PROJECT_REF> dengan ID project Supabase Anda.
-- Contoh: osyfdkwqsssyjvrxtrht

-- ────────────────────────────────────────
-- Trigger Function: trx_reports → fonnte-alert (Usage & Damage)
-- ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_fonnte_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payload JSONB;
  v_edge_function_url TEXT := 'https://<PROJECT_REF>.supabase.co/functions/v1/fonnte-alert';
BEGIN
  IF NEW.quantity IS NULL OR NEW.quantity <= 0 THEN RETURN NEW; END IF;
  IF NEW.type::text NOT IN ('Usage', 'Damage') THEN RETURN NEW; END IF;

  v_payload := json_build_object(
    'type', 'INSERT', 'table', 'trx_reports', 'schema', 'public', 'record', row_to_json(NEW)
  );

  PERFORM extensions.http_post(v_edge_function_url, v_payload::text, 'application/json');
  RETURN NEW;
END;
$$;

-- CATATAN: Pilih SALAH SATU cara untuk trx_reports:
-- Cara 1: SQL Trigger (uncomment di bawah ini)
-- Cara 2: Database Webhook di Supabase Dashboard (recommended)
-- JANGAN gunakan keduanya sekaligus (akan menyebabkan pesan ganda)!

-- DROP TRIGGER IF EXISTS after_report_insert_alert ON public.trx_reports;
-- CREATE TRIGGER after_report_insert_alert
--   AFTER INSERT ON public.trx_reports
--   FOR EACH ROW
--   EXECUTE FUNCTION public.trigger_fonnte_alert();

-- ────────────────────────────────────────
-- Trigger Function: trx_cutting_log → fonnte-alert
-- ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_fonnte_alert_cutting()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payload JSONB;
  v_edge_function_url TEXT := 'https://<PROJECT_REF>.supabase.co/functions/v1/fonnte-alert';
BEGIN
  v_payload := json_build_object(
    'type', 'INSERT', 'table', 'trx_cutting_log', 'schema', 'public', 'record', row_to_json(NEW)
  );

  PERFORM extensions.http_post(v_edge_function_url, v_payload::text, 'application/json');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS after_cutting_insert_alert ON public.trx_cutting_log;
CREATE TRIGGER after_cutting_insert_alert
  AFTER INSERT ON public.trx_cutting_log
  FOR EACH ROW
  EXECUTE PROCEDURE public.trigger_fonnte_alert_cutting();

-- ────────────────────────────────────────
-- Trigger: trx_defects → fonnte-alert (via Supabase Dashboard Webhook)
-- ────────────────────────────────────────
-- Buat via Supabase Dashboard > Database > Webhooks:
--   Table: trx_defects
--   Events: INSERT
--   URL: https://<PROJECT_REF>.supabase.co/functions/v1/fonnte-alert
--   Method: POST
--
-- Atau uncomment di bawah jika mau via SQL (pastikan supabase_functions.http_request tersedia):
-- DROP TRIGGER IF EXISTS "after_defect_insert_alert" ON public.trx_defects;
-- CREATE TRIGGER "after_defect_insert_alert"
--   AFTER INSERT ON public.trx_defects
--   FOR EACH ROW
--   EXECUTE FUNCTION "supabase_functions"."http_request"(
--     'https://<PROJECT_REF>.supabase.co/functions/v1/fonnte-alert',
--     'POST', '{"Content-type":"application/json"}', '{}', '5000'
--   );
