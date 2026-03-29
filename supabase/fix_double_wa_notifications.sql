-- ==============================================================================================
-- FIX: Deduplication for WhatsApp Notifications
-- ==============================================================================================
-- Tabel ini digunakan oleh Edge Function 'fonnte-alert' untuk memastikan 
-- tidak ada pesan ganda untuk kejadian yang sama dalam waktu singkat.

-- 1. Buat tabel pelacak event
CREATE TABLE IF NOT EXISTS public.processed_events (
    event_key TEXT PRIMARY KEY, -- Format: "table:id:type"
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Index untuk pembersihan berkala
CREATE INDEX IF NOT EXISTS idx_processed_events_created ON public.processed_events(created_at);

-- 3. Policy: Hanya service role (Edge Function) yang bisa akses
ALTER TABLE public.processed_events ENABLE ROW LEVEL SECURITY;
-- Karena Edge Function menggunakan SERVICE_ROLE_KEY, ia akan bypass RLS secara default,
-- tapi kita tetap set agar aman jika diakses via client anon.
CREATE POLICY "Service Role only" ON public.processed_events 
FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. (Opsional) Fungsi pembersihan otomatis jika tabel terlalu besar
-- Biasanya bisa dijalankan manual atau via cron job Supabase (.edge-cron)
CREATE OR REPLACE FUNCTION public.cleanup_processed_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.processed_events WHERE created_at < now() - interval '10 minutes';
END;
$$;
