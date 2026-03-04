-- ==============================================================================================
-- UPDATE SCHEMA: Add Message Group Targets to app_settings
-- ==============================================================================================
-- Run this in Supabase SQL Editor

-- 1. Add Group WA Target Column to app_settings
ALTER TABLE public.app_settings 
ADD COLUMN IF NOT EXISTS spv_wa_group TEXT;
