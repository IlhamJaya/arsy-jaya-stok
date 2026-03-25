-- ==============================================================================================
-- UPDATE SCHEMA: FIX WA Trigger for Cutting Log
-- ==============================================================================================

-- 1. Hapus trigger & fungsi lama
DROP TRIGGER IF EXISTS "after_cutting_insert_alert" ON "public"."trx_cutting_log";
DROP FUNCTION IF EXISTS public.trigger_fonnte_alert_cutting();

-- 2. Ekstensi HTTP wajib diaktifkan
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- 3. Buat Fungsi Trigger Khusus untuk Cutting
CREATE OR REPLACE FUNCTION public.trigger_fonnte_alert_cutting()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payload JSONB;
  v_request extensions.http_request;
  v_edge_function_url TEXT := 'https://osyfdkwqsssyjvrxtrht.supabase.co/functions/v1/fonnte-alert';
  v_anon_key TEXT := 'sb_publishable_QoHiV2fsn3TFY6AGNjd27Q_0O5tNJtz';
BEGIN
  -- Bangun JSON Payload persis seperti format Webhook standar
  v_payload := json_build_object(
    'type', 'INSERT',
    'table', 'trx_cutting_log',
    'schema', 'public',
    'record', row_to_json(NEW)
  );

  -- Siapkan request HTTP POST
  v_request.method := 'POST';
  v_request.uri := v_edge_function_url;
  v_request.content_type := 'application/json';
  v_request.content := v_payload::TEXT;

  -- Kirim request dengan header Authorization
  PERFORM extensions.http_post(
    v_request.uri,
    v_request.content,
    v_request.content_type
  );

  RETURN NEW;
END;
$$;

-- 4. Pasang Fungsi di Trigger Tabel
CREATE TRIGGER after_cutting_insert_alert
  AFTER INSERT ON public.trx_cutting_log
  FOR EACH ROW 
  EXECUTE PROCEDURE public.trigger_fonnte_alert_cutting();
