-- =================================================================================================
-- UPDATE SCHEMA: Allow SPV Role to Edit Issue Reports (Defects)
-- =================================================================================================

-- 1. Hapus policy lama dengan nama yang sama (jika ada) untuk menghindari error duplikat
DROP POLICY IF EXISTS "SPV can update defects log" ON public.trx_defects;

-- 2. Buat policy baru yang HANYA membolehkan role 'SPV' untuk mengubah (UPDATE) log kendala
CREATE POLICY "SPV can update defects log" 
ON public.trx_defects 
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 
        FROM profiles 
        WHERE profiles.id = auth.uid() AND profiles.role = 'SPV'
    )
);
