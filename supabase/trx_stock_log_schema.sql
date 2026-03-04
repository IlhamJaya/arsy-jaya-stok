-- ==============================================================================================
-- CANONICAL SCHEMA: trx_stock_log
-- ==============================================================================================
-- Tabel ini mencatat SEMUA perubahan stok yang telah final.
-- Semua RPC (approve, audit, stok_masuk) HARUS menggunakan kolom-kolom ini secara konsisten.

-- Drop table jika sudah ada (hati-hati: ini menghapus data log lama!)
-- Jika tabel sudah ada dan berisi data, gunakan ALTER TABLE saja.
-- Uncomment baris di bawah HANYA jika tabel belum pernah dibuat atau Anda ingin reset:
-- DROP TABLE IF EXISTS public.trx_stock_log;

CREATE TABLE IF NOT EXISTS public.trx_stock_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.mst_items(id) ON DELETE CASCADE,
  report_id UUID REFERENCES public.trx_reports(id) ON DELETE SET NULL, -- nullable: audit/stock_in tidak punya report
  changed_by UUID NOT NULL,                                            -- user yang melakukan aksi
  change_amount NUMERIC NOT NULL,                                      -- positif = masuk, negatif = keluar
  previous_stock NUMERIC NOT NULL,                                     -- stok SEBELUM perubahan
  final_stock NUMERIC NOT NULL,                                        -- stok SESUDAH perubahan
  source TEXT NOT NULL,                                                 -- 'REPORT_USAGE','REPORT_DAMAGE','STOCK_IN','AUDIT'
  notes TEXT,                                                           -- catatan opsional
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index untuk query performa
CREATE INDEX IF NOT EXISTS idx_stock_log_item ON public.trx_stock_log(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_log_created ON public.trx_stock_log(created_at DESC);

-- RLS: Semua authenticated user bisa membaca log (transparansi)
ALTER TABLE public.trx_stock_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read stock log"
ON public.trx_stock_log FOR SELECT
TO authenticated
USING (true);

-- Hanya SECURITY DEFINER functions (RPCs) yang boleh INSERT
-- Tidak perlu policy INSERT untuk user biasa karena RPCs menggunakan SECURITY DEFINER
CREATE POLICY "Only system RPCs can insert stock log"
ON public.trx_stock_log FOR INSERT
TO authenticated
WITH CHECK (false); -- Blocked for direct inserts; RPCs bypass RLS via SECURITY DEFINER

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
