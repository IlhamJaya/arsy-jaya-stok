-- Update mst_items table to include all missing columns
ALTER TABLE public.mst_items
ADD COLUMN IF NOT EXISTS brand TEXT,
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS min_stock INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0;

-- Notify Supabase PostgREST to reload the schema cache so the changes take effect immediately
NOTIFY pgrst, 'reload schema';
