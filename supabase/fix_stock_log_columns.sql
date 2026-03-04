-- ==============================================================================================
-- FIX: Tambah kolom yang hilang di trx_stock_log
-- ==============================================================================================
-- Tabel trx_stock_log sudah ada sebelumnya tapi TIDAK memiliki kolom `previous_stock` dan `notes`.
-- Script CREATE TABLE IF NOT EXISTS TIDAK mengubah tabel yang sudah ada.
-- Jalankan script ini SEKARANG untuk menambah kolom yang kurang.

ALTER TABLE public.trx_stock_log
ADD COLUMN IF NOT EXISTS previous_stock NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'UNKNOWN';

-- Jika kolom lama masih ada dan berbeda nama, rename mereka:
-- (Hanya jalankan jika tabel Anda masih menggunakan nama kolom lama)

-- Cek apakah kolom 'user_id' ada (dari audit_rpc lama), rename ke 'changed_by'
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trx_stock_log' AND column_name = 'user_id') THEN
    ALTER TABLE public.trx_stock_log RENAME COLUMN user_id TO changed_by;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trx_stock_log' AND column_name = 'quantity_change') THEN
    ALTER TABLE public.trx_stock_log RENAME COLUMN quantity_change TO change_amount;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trx_stock_log' AND column_name = 'new_stock') THEN
    ALTER TABLE public.trx_stock_log RENAME COLUMN new_stock TO final_stock;
  END IF;
END $$;

-- Buat index jika belum ada
CREATE INDEX IF NOT EXISTS idx_stock_log_item ON public.trx_stock_log(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_log_created ON public.trx_stock_log(created_at DESC);

-- Notify PostgREST
NOTIFY pgrst, 'reload schema';
