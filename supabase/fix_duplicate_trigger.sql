-- ==============================================================================================
-- FIX: Hapus duplicate trigger yang menyebabkan pesan WhatsApp terkirim berulang
-- ==============================================================================================
-- Jalankan ini di SQL Editor Supabase untuk menghapus trigger duplikat.

-- Hapus SQL trigger manual (jika ada)
DROP TRIGGER IF EXISTS trx_reports_fonnte_trigger ON trx_reports;

-- Hapus fungsi trigger manual (jika ada)
DROP FUNCTION IF EXISTS notify_fonnte_alert();

-- Cek trigger yang tersisa (harus hanya tersisa 1 dari Database Webhook)
SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid = 'trx_reports'::regclass;
