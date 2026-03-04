-- ==============================================================================================
-- UPDATE SCHEMA: Modul Laporan Kendala (Defects Track Record)
-- ==============================================================================================

-- 1. Tambahkan Custom Dropdown Setting ke app_settings
ALTER TABLE public.app_settings 
ADD COLUMN IF NOT EXISTS defect_sources JSONB DEFAULT '["Admin", "Desainer", "Operator Cutting", "Operator Cetak", "Rekanan", "Lainnya"]'::jsonb,
ADD COLUMN IF NOT EXISTS defect_categories JSONB DEFAULT '["Hasil Cetak Jelek", "Salah Bahan", "Salah Desain", "Gagal Mesin", "Human Error", "Jumlah Berlebih", "Lainnya"]'::jsonb;

-- 2. Buat tabel Laporan Kendala (trx_defects)
CREATE TABLE IF NOT EXISTS public.trx_defects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  reporter_id uuid not null references public.profiles(id),
  order_name text not null,
  error_source text not null,
  error_category text not null,
  quantity numeric not null,
  notes text,
  status text default 'Terlapor' -- Untuk marking misal 'Terlapor', 'Investigasi', 'Selesai'
);

-- 3. Setup RLS (Row Level Security) untuk trx_defects
ALTER TABLE public.trx_defects ENABLE ROW LEVEL SECURITY;

-- Semua user (Authenticated) bisa melihat data defect
CREATE POLICY "Semua user bisa melihat laporan kendala"
ON public.trx_defects FOR SELECT
TO authenticated
USING (true);

-- Semua user (Authenticated) bisa membuat laporan kendala baru (insert)
CREATE POLICY "Semua user bisa membuat laporan kendala baru"
ON public.trx_defects FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = reporter_id);

-- Hanya SPV yang bisa mengubah atau menghapus laporan kendala (jika diperlukan)
CREATE POLICY "Hanya SPV yang bisa mengubah laporan kendala"
ON public.trx_defects FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'SPV'
  )
);

CREATE POLICY "Hanya SPV yang bisa menghapus laporan kendala"
ON public.trx_defects FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'SPV'
  )
);
