-- =================================================================================================
-- UPDATE SCHEMA: Allow SPV Role to Edit Cutting Logs
-- =================================================================================================

-- 1. Hapus policy lama dengan nama yang sama (jika ada) untuk menghindari error duplikat
DROP POLICY IF EXISTS "SPV can update cutting log" ON public.trx_cutting_log;

-- 2. Buat policy baru yang HANYA membolehkan role 'SPV' untuk mengubah (UPDATE) log cutting
CREATE POLICY "SPV can update cutting log" 
ON public.trx_cutting_log 
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 
        FROM profiles 
        WHERE profiles.id = auth.uid() AND profiles.role = 'SPV'
    )
);
