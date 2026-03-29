-- =============================================================================
-- Fonnte: panggil fonnte-alert untuk PEMMAKAIAN (Usage), bukan hanya Damage
-- =============================================================================
-- Penyebab notifikasi restok / pemakaian tidak jalan:
-- Trigger atau Database Webhook di trx_reports sering hanya di-set untuk tipe
-- Kerusakan (Damage). Edge function fonnte-alert sudah menangani:
--   - Damage: kirim hanya jika qty >= wa_threshold (di dalam function)
--   - Usage: selalu kirim template pemakaian + opsional pesan restok jika kritis
-- Jadi HTTP ke fonnte-alert harus dipicu untuk INSERT Usage DAN Damage (qty > 0).
--
-- Jika proyek kamu memakai SUPABASE DATABASE WEBHOOK (http_request) seperti di
-- dashboard "Webhook Kerusakan Stok": buka Database → Webhooks, edit webhook
-- tersebut, dan HAPUS filter yang membatasi hanya type=Damage — atau ganti
-- supaya semua INSERT ke trx_reports memicu webhook (biarkan fonnte-alert
-- yang memfilter Damage di bawah threshold).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trigger_fonnte_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payload JSONB;
  v_edge_function_url TEXT := 'https://osyfdkwqsssyjvrxtrht.supabase.co/functions/v1/fonnte-alert';
BEGIN
  -- Ganti URL di atas dengan https://<PROJECT_REF>.supabase.co/functions/v1/fonnte-alert
  -- jika project berbeda.

  IF NEW.quantity IS NULL OR NEW.quantity <= 0 THEN
    RETURN NEW;
  END IF;

  IF NEW.type::text NOT IN ('Usage', 'Damage') THEN
    RETURN NEW;
  END IF;

  v_payload := json_build_object(
    'type', 'INSERT',
    'table', 'trx_reports',
    'schema', 'public',
    'record', row_to_json(NEW)
  );

  PERFORM extensions.http_post(
    v_edge_function_url,
    v_payload::text,
    'application/json'
  );

  RETURN NEW;
END;
$$;

-- Catatan: banyak proyek memakai *Database Webhook* (http_request) di dashboard,
-- BUKAN trigger ini. Kalau webhook "Kerusakan Stok" masih aktif untuk trx_reports,
-- edit webhook-nya agar INSERT Usage juga memicu (atau nonaktifkan webhook lalu
-- pasang trigger AFTER INSERT yang memanggil fungsi di atas).
--
-- Contoh pasang trigger manual (hindari duplikat dengan webhook yang sama target):
-- DROP TRIGGER IF EXISTS after_report_insert_alert ON public.trx_reports;
-- CREATE TRIGGER after_report_insert_alert
--   AFTER INSERT ON public.trx_reports
--   FOR EACH ROW
--   EXECUTE FUNCTION public.trigger_fonnte_alert();
