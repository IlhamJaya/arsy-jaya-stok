-- Add wa_template_bot_stock to app_settings
ALTER TABLE "public"."app_settings" 
ADD COLUMN IF NOT EXISTS "wa_template_bot_stock" text;
