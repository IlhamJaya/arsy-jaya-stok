-- ==============================================================================================
-- 02: PEMBUATAN TABEL (CREATE TABLE)
-- ==============================================================================================
-- Jalankan SETELAH 01_extensions_types.sql

-- ────────────────────────────────────────
-- profiles — User Profiles
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role public.app_role DEFAULT 'OP_CETAK',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ────────────────────────────────────────
-- mst_items — Master Data Barang
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mst_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT,
  brand TEXT,
  category TEXT,
  unit TEXT NOT NULL DEFAULT 'Lembar',
  stock NUMERIC NOT NULL DEFAULT 0,
  min_stock NUMERIC NOT NULL DEFAULT 0,
  width NUMERIC,
  price_per_roll NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ────────────────────────────────────────
-- mst_suppliers — Partner / Supplier (halaman Partner & Supplier)
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mst_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_number TEXT,
  wa_template TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_name ON public.mst_suppliers(name);

-- ────────────────────────────────────────
-- app_settings — Pengaturan Aplikasi (Single Row, id=1)
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  
  -- Branding (dipakai Zustand fetchBranding — sidebar)
  app_title TEXT DEFAULT 'ARSY JAYA',
  app_subtitle TEXT DEFAULT 'Stock & Tracking Sistem',
  app_logo_svg TEXT,
  
  -- WhatsApp Config
  wa_threshold INTEGER NOT NULL DEFAULT 10,
  spv_wa_number TEXT NOT NULL DEFAULT '',
  spv_wa_group TEXT,
  -- Opsional: tidak dipakai frontend/fonnte-alert saat ini (token Fonnte di Supabase Secrets)
  fonnte_api_token TEXT,

  -- Toggle notifikasi: ada di DB; belum dibaca React atau fonnte-alert (semua alert aktif jika webhook terpasang)
  is_active_usage BOOLEAN DEFAULT true,
  is_active_damage BOOLEAN DEFAULT true,
  is_active_stockin BOOLEAN DEFAULT true,
  is_active_cutting BOOLEAN DEFAULT true,
  is_active_defect BOOLEAN DEFAULT true,
  is_active_restock BOOLEAN DEFAULT true,
  is_active_bot BOOLEAN DEFAULT true,
  
  -- WA Message Templates
  wa_template_damage TEXT,
  wa_template_usage TEXT,
  wa_template_stockin TEXT,
  wa_template_cutting TEXT,
  wa_template_defect TEXT,
  -- Default seed ada; fonnte-alert saat ini tidak mengirim WA restok dari trx_stock_log (hanya stock_in)
  wa_template_restock_usage TEXT,
  -- Untuk fonnte-bot / pengayaan; bot membangun pesan di kode, tidak wajib kolom ini
  wa_template_bot_stock TEXT,

  -- QC Defect Dropdowns
  defect_sources JSONB DEFAULT '["Admin", "Desainer", "Operator Cutting", "Operator Cetak", "Rekanan", "Lainnya"]'::jsonb,
  defect_categories JSONB DEFAULT '["Hasil Cetak Jelek", "Salah Bahan", "Salah Desain", "Gagal Mesin", "Human Error", "Jumlah Berlebih", "Lainnya"]'::jsonb,

  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_id_check CHECK (id = 1);

-- ────────────────────────────────────────
-- trx_reports — Laporan Pemakaian / Kerusakan
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trx_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.mst_items(id) ON DELETE CASCADE,
  operator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.report_type NOT NULL,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  notes TEXT,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_item ON public.trx_reports(item_id);
CREATE INDEX IF NOT EXISTS idx_reports_operator ON public.trx_reports(operator_id);
CREATE INDEX IF NOT EXISTS idx_reports_created ON public.trx_reports(created_at DESC);

-- ────────────────────────────────────────
-- trx_stock_log — History Perubahan Stok
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trx_stock_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.mst_items(id) ON DELETE CASCADE,
  report_id UUID REFERENCES public.trx_reports(id) ON DELETE SET NULL,
  changed_by UUID NOT NULL,
  change_amount NUMERIC NOT NULL,
  previous_stock NUMERIC NOT NULL,
  final_stock NUMERIC NOT NULL,
  -- Nilai dari RPC: REPORT_USAGE, REPORT_DAMAGE, STOCK_IN, AUDIT (fonnte-alert: WA stok hanya STOCK_IN)
  source TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_log_item ON public.trx_stock_log(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_log_created ON public.trx_stock_log(created_at DESC);

-- ────────────────────────────────────────
-- trx_cutting_log — Tracking Cutting Stiker
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trx_cutting_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_name TEXT NOT NULL,
  qty_cut INTEGER NOT NULL CHECK (qty_cut > 0),
  notes TEXT DEFAULT '',
  item_id UUID REFERENCES public.mst_items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cutting_log_operator ON public.trx_cutting_log(operator_id);
CREATE INDEX IF NOT EXISTS idx_cutting_log_date ON public.trx_cutting_log(created_at);
CREATE INDEX IF NOT EXISTS idx_cutting_log_item ON public.trx_cutting_log(item_id);

-- ────────────────────────────────────────
-- trx_defects — Laporan Kendala / QC
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trx_defects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id),
  order_name TEXT NOT NULL,
  error_source TEXT NOT NULL,
  error_category TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'Terlapor'
);

-- ────────────────────────────────────────
-- processed_events — Deduplikasi Notifikasi WA
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.processed_events (
  event_key TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processed_events_created ON public.processed_events(created_at);
