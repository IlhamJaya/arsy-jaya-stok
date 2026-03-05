-- ==============================================================================================
-- UPDATE SCHEMA: Restrict Cutting Log Deletion to SPV Only
-- ==============================================================================================

-- 1. Hapus policy lama yang membolehkan OP_CUTTING menghapus log cutting mereka sendiri
DROP POLICY IF EXISTS "OP_CUTTING can delete own cutting log" ON public.trx_cutting_log;

-- 2. Buat policy baru yang HANYA membolehkan SPV untuk menghapus log cutting apa pun
CREATE POLICY "SPV can delete cutting log" 
ON public.trx_cutting_log 
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 
        FROM profiles 
        WHERE profiles.id = auth.uid() AND profiles.role = 'SPV'
    )
);
