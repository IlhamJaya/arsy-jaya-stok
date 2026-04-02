-- ==============================================================================================
-- 03: HAK AKSES & POLICIES (RLS)
-- ==============================================================================================
-- Jalankan SETELAH 02_tables.sql

-- ═══ profiles ═══
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all profiles"
ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- ═══ mst_items ═══
ALTER TABLE public.mst_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can read items"
ON public.mst_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "SPV can manage items"
ON public.mst_items FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'SPV'));

-- ═══ mst_suppliers (Partner & Supplier: SPV+HRD baca; hanya SPV tulis) ═══
ALTER TABLE public.mst_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SPV and HRD can read suppliers"
ON public.mst_suppliers FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('SPV', 'HRD')
  )
);

CREATE POLICY "SPV can manage suppliers"
ON public.mst_suppliers FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'SPV'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'SPV'));

-- ═══ app_settings ═══
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Semua user autentikasi bisa membaca app_settings"
ON public.app_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Hanya SPV yang bisa mengubah app_settings"
ON public.app_settings FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'SPV'));

-- ═══ trx_reports ═══
ALTER TABLE public.trx_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can read reports"
ON public.trx_reports FOR SELECT TO authenticated USING (true);

-- Laporan pemakaian/kerusakan hanya dibuat lewat RPC (submit_report_direct, SECURITY DEFINER).
-- Frontend tidak melakukan INSERT langsung ke trx_reports.
DROP POLICY IF EXISTS "Allow insert reports" ON public.trx_reports;
CREATE POLICY "No direct insert trx_reports from clients"
ON public.trx_reports FOR INSERT TO authenticated
WITH CHECK (false);

-- ═══ trx_stock_log ═══
ALTER TABLE public.trx_stock_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read stock log"
ON public.trx_stock_log FOR SELECT TO authenticated USING (true);

-- Blocked for direct inserts; RPCs bypass RLS via SECURITY DEFINER
CREATE POLICY "Only system RPCs can insert stock log"
ON public.trx_stock_log FOR INSERT TO authenticated WITH CHECK (false);

-- ═══ trx_cutting_log ═══
ALTER TABLE public.trx_cutting_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "OP_CUTTING can insert cutting log"
ON public.trx_cutting_log FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = operator_id
  AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'OP_CUTTING')
);

CREATE POLICY "All can read cutting log"
ON public.trx_cutting_log FOR SELECT TO authenticated USING (true);

CREATE POLICY "SPV can update cutting log"
ON public.trx_cutting_log FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'SPV'));

CREATE POLICY "SPV can delete cutting log"
ON public.trx_cutting_log FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'SPV'));

-- ═══ trx_defects ═══
ALTER TABLE public.trx_defects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Semua user bisa melihat laporan kendala"
ON public.trx_defects FOR SELECT TO authenticated USING (true);

CREATE POLICY "Semua user bisa membuat laporan kendala baru"
ON public.trx_defects FOR INSERT TO authenticated
WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Hanya SPV yang bisa mengubah laporan kendala"
ON public.trx_defects FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'SPV'));

CREATE POLICY "Hanya SPV yang bisa menghapus laporan kendala"
ON public.trx_defects FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'SPV'));

-- ═══ processed_events ═══
ALTER TABLE public.processed_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service Role only" ON public.processed_events
FOR ALL TO service_role USING (true) WITH CHECK (true);
