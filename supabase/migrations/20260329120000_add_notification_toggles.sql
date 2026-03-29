-- Menambahkan kolom toggle aktif/non-aktif untuk notifikasi WA dan bot
ALTER TABLE "public"."app_settings"
ADD COLUMN IF NOT EXISTS "is_active_usage" boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS "is_active_damage" boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS "is_active_stockin" boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS "is_active_cutting" boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS "is_active_defect" boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS "is_active_restock" boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS "is_active_bot" boolean DEFAULT true;
