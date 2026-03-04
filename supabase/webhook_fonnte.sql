-- ==============================================================================================
-- 6. WEBHOOK TRIGGER: SEND WA NOTIFICATION ON DAMAGE > 10
-- ==============================================================================================

-- Supabase menyediakan fitur pg_net (http module) untuk melakukan request ke luar
-- Pastikan ekstensi http sudah aktif (biasanya aktif by default di Supabase)
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Fungsi penanganan trigger yang mengirim request ke Edge Function kita
CREATE OR REPLACE FUNCTION public.trigger_fonnte_alert()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payload JSONB;
  v_request extensions.http_request;
  v_edge_function_url TEXT := 'https://<PROJECT_REF>.supabase.co/functions/v1/fonnte-alert';
  -- Ganti <PROJECT_REF> ini dengan referensi proyek Supabase Anda (misal: xxxxxyyyyyyzzzzz)
BEGIN
  -- Hanya picu request HTTP jika tipe laporan 'Damage' dan qty > 10 (filter ganda sebagai lapisan aman)
  IF NEW.type = 'Damage' AND NEW.quantity > 10 THEN
    
    -- Siapkan Payload berbentuk JSON persis seperti format Database Webhook Supabase
    v_payload := json_build_object(
      'type', 'INSERT',
      'table', 'trx_reports',
      'schema', 'public',
      'record', row_to_json(NEW)
    );

    -- Siapkan request menggunakan esktensi HTTP
    v_request.method := 'POST';
    v_request.uri := v_edge_function_url;
    v_request.content_type := 'application/json';
    v_request.content := v_payload::TEXT;

    -- Kirim request secara asynchronous agar tidak memblokir laju INSERT database (Fire and Forget)
    PERFORM extensions.http_post(
      v_request.uri,
      v_request.content,
      v_request.content_type
    );

  END IF;

  RETURN NEW;
END;
$$;

-- Mendaftarkan Fungsi ke Trigger saat Operator membuat laporan baru
DROP TRIGGER IF EXISTS after_report_insert_alert ON public.trx_reports;
CREATE TRIGGER after_report_insert_alert
  AFTER INSERT ON public.trx_reports
  FOR EACH ROW 
  EXECUTE PROCEDURE public.trigger_fonnte_alert();
