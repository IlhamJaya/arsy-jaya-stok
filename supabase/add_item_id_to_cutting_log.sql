-- ==========================================================
-- MIGRASI: Tambah kolom item_id pada trx_cutting_log
-- Jalankan di Supabase > SQL Editor
-- ==========================================================

-- Tambah kolom item_id (nullable, agar data lama tidak error)
ALTER TABLE public.trx_cutting_log
ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES public.mst_items(id) ON DELETE SET NULL;

-- Index untuk query berdasarkan bahan
CREATE INDEX IF NOT EXISTS idx_cutting_log_item ON public.trx_cutting_log(item_id);
