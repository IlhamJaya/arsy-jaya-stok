-- ==============================================================================================
-- PATCH: sinkron DB yang sudah ada dengan perilaku aplikasi saat ini
-- ==============================================================================================
-- Jalankan SEKALI di Supabase SQL Editor (project yang sudah berjalan).
-- Aman diulang: policy di-drop dulu jika ada; CREATE TABLE IF NOT EXISTS; CREATE OR REPLACE function.
--
-- Isi patch:
--   1) Tabel mst_suppliers + grant + RLS (halaman Partner & Supplier)
--   2) trx_reports: blokir INSERT langsung dari klien (hanya lewat RPC)
--   3) submit_report_direct: wajib role OP_CETAK
--
-- Prasyarat: public.get_my_role() sudah ada (dari 04_rpc_functions). Jika belum, jalankan file 04 utuh.
-- ==============================================================================================

-- ── 1) mst_suppliers ─────────────────────────────────────────────────────────────────────────
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

ALTER TABLE public.mst_suppliers ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.mst_suppliers TO postgres;
GRANT ALL ON TABLE public.mst_suppliers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.mst_suppliers TO authenticated;

DROP POLICY IF EXISTS "SPV and HRD can read suppliers" ON public.mst_suppliers;
DROP POLICY IF EXISTS "SPV can manage suppliers" ON public.mst_suppliers;

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

-- ── 2) trx_reports: tidak ada insert dari browser ───────────────────────────────────────────
DROP POLICY IF EXISTS "Allow insert reports" ON public.trx_reports;
DROP POLICY IF EXISTS "No direct insert trx_reports from clients" ON public.trx_reports;

CREATE POLICY "No direct insert trx_reports from clients"
ON public.trx_reports FOR INSERT TO authenticated
WITH CHECK (false);

-- ── 3) submit_report_direct — hanya OP_CETAK ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_report_direct(
  p_item_id UUID, p_type TEXT, p_quantity NUMERIC, p_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_item RECORD; v_user_id UUID; v_final_stock NUMERIC; v_source TEXT; v_report_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF public.get_my_role() != 'OP_CETAK' THEN
    RAISE EXCEPTION 'Access Denied: Only OP_CETAK can submit stock usage/damage reports.';
  END IF;

  IF p_type NOT IN ('Usage', 'Damage') THEN
    RAISE EXCEPTION 'Invalid type: %. Must be Usage or Damage.', p_type;
  END IF;
  IF p_quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be greater than 0.'; END IF;

  SELECT * INTO v_item FROM public.mst_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found.'; END IF;

  v_final_stock := v_item.stock - p_quantity;
  IF v_final_stock < 0 THEN
    RAISE EXCEPTION 'Stok tidak mencukupi. Stok saat ini: %, permintaan: %.', v_item.stock, p_quantity;
  END IF;

  v_source := CASE WHEN p_type = 'Usage' THEN 'REPORT_USAGE' ELSE 'REPORT_DAMAGE' END;

  UPDATE public.mst_items SET stock = v_final_stock WHERE id = v_item.id;

  INSERT INTO public.trx_reports (
    item_id, operator_id, type, quantity, notes, status, reviewed_by, reviewed_at
  ) VALUES (
    p_item_id, v_user_id, p_type::report_type, p_quantity, p_notes, 'Approved', v_user_id, NOW()
  ) RETURNING id INTO v_report_id;

  INSERT INTO public.trx_stock_log (
    item_id, report_id, changed_by, change_amount, previous_stock, final_stock, source, notes
  ) VALUES (
    v_item.id, v_report_id, v_user_id, -p_quantity, v_item.stock, v_final_stock, v_source, p_notes
  );

  RETURN json_build_object(
    'success', true, 'report_id', v_report_id, 'item_id', v_item.id,
    'old_stock', v_item.stock, 'new_stock', v_final_stock, 'deducted_qty', p_quantity
  );
END;
$$;

-- Izin eksekusi RPC untuk role yang login (Supabase biasanya sudah ada; aman diulang)
GRANT EXECUTE ON FUNCTION public.submit_report_direct(UUID, TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_report_direct(UUID, TEXT, NUMERIC, TEXT) TO service_role;

-- ==============================================================================================
-- OPSIONAL — samakan teks branding sidebar dengan default skema baru (uncomment jika perlu)
-- ==============================================================================================
-- UPDATE public.app_settings
-- SET app_title = 'ARSY JAYA', app_subtitle = 'Stock & Tracking Sistem'
-- WHERE id = 1;

NOTIFY pgrst, 'reload schema';
