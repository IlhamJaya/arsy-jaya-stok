-- ==============================================================================================
-- FITUR BARU: Tracking Cutting Stiker
-- ==============================================================================================
-- Jalankan di Supabase SQL Editor

-- 1. Buat tabel cutting log
CREATE TABLE IF NOT EXISTS public.trx_cutting_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    order_name TEXT NOT NULL,
    qty_cut INTEGER NOT NULL CHECK (qty_cut > 0),
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Index untuk query harian
CREATE INDEX IF NOT EXISTS idx_cutting_log_operator ON trx_cutting_log(operator_id);
CREATE INDEX IF NOT EXISTS idx_cutting_log_date ON trx_cutting_log(created_at);

-- 3. Enable RLS
ALTER TABLE trx_cutting_log ENABLE ROW LEVEL SECURITY;

-- 4. Policy: OP_CUTTING bisa INSERT data sendiri
DROP POLICY IF EXISTS "OP_CUTTING can insert cutting log" ON trx_cutting_log;
CREATE POLICY "OP_CUTTING can insert cutting log"
ON trx_cutting_log FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = operator_id
    AND EXISTS (
        SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'OP_CUTTING'
    )
);

-- 5. Policy: Semua authenticated bisa SELECT (untuk Reports)
DROP POLICY IF EXISTS "All can read cutting log" ON trx_cutting_log;
CREATE POLICY "All can read cutting log"
ON trx_cutting_log FOR SELECT
TO authenticated
USING (true);

-- 6. Policy: OP_CUTTING bisa DELETE data sendiri (koreksi)
DROP POLICY IF EXISTS "OP_CUTTING can delete own cutting log" ON trx_cutting_log;
CREATE POLICY "OP_CUTTING can delete own cutting log"
ON trx_cutting_log FOR DELETE
TO authenticated
USING (
    auth.uid() = operator_id
    AND EXISTS (
        SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'OP_CUTTING'
    )
);
