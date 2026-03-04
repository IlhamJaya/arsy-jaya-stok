-- Fungsi penanganan trigger yang mengirim request HTTP ke Edge Function Fonnte
CREATE OR REPLACE FUNCTION public.trigger_fonnte_alert()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payload JSONB;
  v_request extensions.http_request;
  -- The URL must be the actual Supabase project URL
  v_edge_function_url TEXT := 'https://osyfdkwqsssyjvrxtrht.supabase.co/functions/v1/fonnte-alert';
BEGIN
  -- Hanya picu request HTTP jika tipe laporan 'Damage' dan qty > 0 
  -- (Diubah dari 10 ke 0 di sini agar Edge Function bisa mengecek threshold secara dinamis lewat DB)
  IF NEW.type = 'Damage' AND NEW.quantity > 0 THEN
    
    v_payload := json_build_object(
      'type', 'INSERT',
      'table', 'trx_reports',
      'schema', 'public',
      'record', row_to_json(NEW)
    );

    v_request.method := 'POST';
    v_request.uri := v_edge_function_url;
    v_request.content_type := 'application/json';
    v_request.content := v_payload::TEXT;

    -- Kirim request
    PERFORM extensions.http_post(
      v_request.uri,
      v_request.content,
      v_request.content_type
    );

  END IF;

  RETURN NEW;
END;
$$;
