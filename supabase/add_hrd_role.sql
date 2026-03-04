-- ==============================================================================================
-- 9. ADD HRD ROLE Enum
-- ==============================================================================================
-- Menambahkan role HRD ke enum app_role 

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'HRD';

-- Note: Jika error terjadi saat menambahkan enum "ALTER TYPE cannot run inside a transaction block",
-- maka eksekusi secara terpisah dari query blok lain.

