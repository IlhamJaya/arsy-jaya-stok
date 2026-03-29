-- Menambahkan field untuk menyimpan API token Fonnte ke pengaturan aplikasi
ALTER TABLE "public"."app_settings" 
ADD COLUMN IF NOT EXISTS "fonnte_api_token" text;
