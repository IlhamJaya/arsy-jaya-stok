-- ==============================================================================================
-- FIX: Izinkan Role SALES untuk INSERT ke tabel trx_reports
-- ==============================================================================================
-- Jalankan di Supabase SQL Editor

-- Hapus policy lama yang membatasi insert
DROP POLICY IF EXISTS "Operators can insert reports" ON trx_reports;
DROP POLICY IF EXISTS "Users can insert own reports" ON trx_reports;
DROP POLICY IF EXISTS "Allow insert for operators" ON trx_reports;

-- Buat policy baru: OP_CETAK, OP_CUTTING, dan SALES bisa insert
CREATE POLICY "Allow insert reports"
ON trx_reports FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('OP_CETAK', 'OP_CUTTING', 'SALES')
  )
);

-- Pastikan SELECT policy juga ada
DROP POLICY IF EXISTS "All authenticated can read reports" ON trx_reports;
CREATE POLICY "All authenticated can read reports"
ON trx_reports FOR SELECT
TO authenticated
USING (true);
