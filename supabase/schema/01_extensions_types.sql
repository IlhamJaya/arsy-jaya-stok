-- ==============================================================================================
-- 01: EXTENSIONS & CUSTOM TYPES
-- ==============================================================================================
-- Jalankan PERTAMA sebelum file lain.

-- Extensions
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Enum: Role User
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('SPV', 'OP_CETAK', 'OP_CUTTING', 'SALES', 'HRD');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Enum: Tipe Laporan
DO $$ BEGIN
  CREATE TYPE public.report_type AS ENUM ('Usage', 'Damage');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
