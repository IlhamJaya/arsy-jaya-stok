-- ==============================================================================================
-- 04: RPC FUNCTIONS (BUSINESS LOGIC)
-- ==============================================================================================
-- Jalankan SETELAH 03_policies_roles.sql

-- Helper: mendapatkan role user saat ini
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role TEXT;
BEGIN
  SELECT role::text INTO v_role FROM public.profiles WHERE id = auth.uid();
  RETURN v_role;
END;
$$;

-- Helper: cleanup processed_events
CREATE OR REPLACE FUNCTION public.cleanup_processed_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.processed_events WHERE created_at < now() - interval '10 minutes';
END;
$$;

-- ────────────────────────────────────────
-- submit_report_direct — Submit & Potong Stok Langsung
-- ────────────────────────────────────────
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

  -- Selaras InputReportDashboard: hanya OP_CETAK yang boleh submit (bukan SALES/OP_CUTTING dari UI)
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

  -- Update stok DULU agar trigger fonnte-alert membaca stok final yang benar
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

-- ────────────────────────────────────────
-- add_incoming_stock — Stok Masuk (SPV / SALES)
-- ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_incoming_stock(
  p_item_id UUID, p_incoming_qty NUMERIC, p_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_item RECORD; v_user_id UUID; v_role TEXT; v_final_stock NUMERIC;
BEGIN
  v_user_id := auth.uid();
  v_role := public.get_my_role();
  IF v_role NOT IN ('SPV', 'SALES') THEN
    RAISE EXCEPTION 'Access Denied: Only Supervisors and Sales can add incoming stock.';
  END IF;

  SELECT * INTO v_item FROM public.mst_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found.'; END IF;

  v_final_stock := v_item.stock + p_incoming_qty;
  UPDATE public.mst_items SET stock = v_final_stock WHERE id = v_item.id;

  INSERT INTO public.trx_stock_log (
    item_id, changed_by, change_amount, previous_stock, final_stock, source, notes
  ) VALUES (v_item.id, v_user_id, p_incoming_qty, v_item.stock, v_final_stock, 'STOCK_IN', p_notes);

  RETURN json_build_object(
    'success', true, 'item_id', v_item.id, 'old_stock', v_item.stock,
    'new_stock', v_final_stock, 'added_qty', p_incoming_qty, 'notes', p_notes
  );
END;
$$;

-- ────────────────────────────────────────
-- audit_physical_stock — Audit Opname (SPV Only)
-- ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.audit_physical_stock(
  p_item_id UUID, p_actual_qty NUMERIC, p_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID; v_role app_role; v_current_stock NUMERIC; v_difference NUMERIC;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_user_id;
  IF v_role != 'SPV' THEN RAISE EXCEPTION 'Forbidden: Only Supervisor can audit stock'; END IF;

  SELECT stock INTO v_current_stock FROM public.mst_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found'; END IF;

  v_difference := p_actual_qty - v_current_stock;
  IF v_difference = 0 THEN
    RETURN jsonb_build_object('success', true, 'message', 'No difference in stock.');
  END IF;

  UPDATE public.mst_items SET stock = p_actual_qty, updated_at = NOW() WHERE id = p_item_id;

  INSERT INTO public.trx_stock_log (
    item_id, changed_by, change_amount, previous_stock, final_stock, source, notes
  ) VALUES (p_item_id, v_user_id, v_difference, v_current_stock, p_actual_qty, 'AUDIT', 'AUDIT OPNAME: ' || p_notes);

  RETURN jsonb_build_object(
    'success', true, 'message', 'Stock audited successfully',
    'difference', v_difference, 'new_stock', p_actual_qty
  );
END;
$$;

-- ────────────────────────────────────────
-- spv_update_trx_report_notes — Edit Notes (SPV)
-- ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.spv_update_trx_report_notes(p_report_id UUID, p_notes TEXT)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_user_id UUID; v_is_spv BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id AND role = 'SPV') INTO v_is_spv;
  IF NOT v_is_spv THEN RAISE EXCEPTION 'Forbidden: SPV only'; END IF;

  UPDATE public.trx_reports SET notes = p_notes WHERE id = p_report_id;
  UPDATE public.trx_stock_log SET notes = p_notes WHERE report_id = p_report_id;
  RETURN json_build_object('success', true, 'report_id', p_report_id);
END;
$$;

-- ────────────────────────────────────────
-- spv_delete_trx_report_and_restore_stock — Hapus Laporan + Restore Stok (SPV)
-- ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.spv_delete_trx_report_and_restore_stock(p_report_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID; v_is_spv BOOLEAN; v_report RECORD; v_item RECORD;
  v_source TEXT; v_prev_stock NUMERIC; v_final_stock NUMERIC;
BEGIN
  v_user_id := auth.uid();
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id AND role = 'SPV') INTO v_is_spv;
  IF NOT v_is_spv THEN RAISE EXCEPTION 'Forbidden: SPV only'; END IF;

  SELECT * INTO v_report FROM public.trx_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Report not found: %', p_report_id; END IF;

  SELECT * INTO v_item FROM public.mst_items WHERE id = v_report.item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found: %', v_report.item_id; END IF;

  UPDATE public.trx_stock_log SET report_id = NULL WHERE report_id = p_report_id;

  v_source := CASE WHEN v_report.type::text = 'Usage' THEN 'REPORT_USAGE' ELSE 'REPORT_DAMAGE' END;
  v_prev_stock := v_item.stock;
  v_final_stock := v_prev_stock + v_report.quantity;

  UPDATE public.mst_items SET stock = v_final_stock WHERE id = v_item.id;

  INSERT INTO public.trx_stock_log (
    item_id, report_id, changed_by, change_amount, previous_stock, final_stock, source, notes
  ) VALUES (v_item.id, NULL, v_user_id, v_report.quantity, v_prev_stock, v_final_stock, v_source, v_report.notes);

  DELETE FROM public.trx_reports WHERE id = p_report_id;

  RETURN json_build_object(
    'success', true, 'report_id', p_report_id,
    'restored_qty', v_report.quantity, 'source', v_source
  );
END;
$$;
