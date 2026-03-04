-- ==============================================================================================
-- 5. FUNCTION: APPROVE TRANSACTIONS (RPC)
-- ==============================================================================================

-- Fungsi ini secara atomik akan:
-- 1. Mengubah status di trx_reports menjadi 'Approved'
-- 2. Mengurangi stok di mst_items berdasarkan tipe (Usage/Damage)
-- 3. Mencatat perubahan di trx_stock_log (termasuk previous_stock)
-- 4. Mengembalikan data stok terbaru

CREATE OR REPLACE FUNCTION public.approve_pending_report(
  p_report_id UUID, 
  p_approved_qty NUMERIC, 
  p_notes TEXT DEFAULT NULL
) 
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER -- Berjalan dengan hak istimewa (bypassing the user's RLS partially for the transaction safety)
SET search_path = public
AS $$
DECLARE
  v_report RECORD;
  v_item RECORD;
  v_spv_id UUID;
  v_final_stock NUMERIC;
  v_source TEXT;
BEGIN
  v_spv_id := auth.uid();
  
  -- 1. Validasi Role (Hanya SPV yang boleh approve)
  IF public.get_my_role() != 'SPV' THEN
    RAISE EXCEPTION 'Access Denied: Only Supervisors can approve reports.';
  END IF;

  -- 2. Dapatkan data laporan dan pastikan statusnya masih Pending
  SELECT * INTO v_report FROM public.trx_reports WHERE id = p_report_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found.';
  END IF;
  
  IF v_report.status != 'Pending' THEN
    RAISE EXCEPTION 'Report is already processed (Status: %).', v_report.status;
  END IF;

  -- 3. Dapatkan data item untuk diupdate
  SELECT * INTO v_item FROM public.mst_items WHERE id = v_report.item_id FOR UPDATE;

  -- 4. Kalkulasi stok terbaru
  v_final_stock := v_item.stock - p_approved_qty;
  
  -- Cegah stok minus
  IF v_final_stock < 0 THEN
    RAISE EXCEPTION 'Insufficient stock. Current stock is % but trying to deduct %.', v_item.stock, p_approved_qty;
  END IF;

  -- Set tipe log berdasarkan laporan
  IF v_report.type = 'Usage' THEN
    v_source := 'REPORT_USAGE';
  ELSE
    v_source := 'REPORT_DAMAGE';
  END IF;

  -- ================= ATOMIC TRANSACTION BLOCK =================
  
  -- A. Update Laporan
  UPDATE public.trx_reports 
  SET 
    status = 'Approved', 
    quantity = p_approved_qty, -- SPV bisa revisi qty saat approve
    notes = COALESCE(p_notes, notes),
    reviewed_by = v_spv_id,
    reviewed_at = NOW()
  WHERE id = p_report_id;

  -- B. Kurangi Stok Master
  UPDATE public.mst_items
  SET stock = v_final_stock
  WHERE id = v_item.id;

  -- C. Catat di Log (synchronized with canonical trx_stock_log schema)
  INSERT INTO public.trx_stock_log (
    item_id, report_id, changed_by, change_amount, previous_stock, final_stock, source, notes
  ) VALUES (
    v_item.id, p_report_id, v_spv_id, -p_approved_qty, v_item.stock, v_final_stock, v_source, p_notes
  );

  -- ============================================================

  RETURN json_build_object(
    'success', true,
    'report_id', p_report_id,
    'item_id', v_item.id,
    'old_stock', v_item.stock,
    'new_stock', v_final_stock,
    'approved_qty', p_approved_qty
  );
END;
$$;
