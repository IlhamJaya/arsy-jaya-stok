-- ==============================================================================================
-- FUNCTION: SUBMIT REPORT DIRECT (tanpa approval - langsung potong stok)
-- ==============================================================================================

-- Fungsi ini secara atomik akan:
-- 1. Insert laporan ke trx_reports dengan status 'Approved' langsung
-- 2. Mengurangi stok di mst_items berdasarkan tipe (Usage/Damage)
-- 3. Mencatat perubahan di trx_stock_log (termasuk previous_stock)
-- 4. Mengembalikan data stok terbaru

CREATE OR REPLACE FUNCTION public.submit_report_direct(
  p_item_id UUID,
  p_type TEXT,        -- 'Usage' atau 'Damage'
  p_quantity NUMERIC,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_user_id UUID;
  v_final_stock NUMERIC;
  v_source TEXT;
  v_report_id UUID;
BEGIN
  v_user_id := auth.uid();

  -- 1. Validasi input
  IF p_type NOT IN ('Usage', 'Damage') THEN
    RAISE EXCEPTION 'Invalid type: %. Must be Usage or Damage.', p_type;
  END IF;

  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than 0.';
  END IF;

  -- 2. Dapatkan data item dan lock row untuk update
  SELECT * INTO v_item FROM public.mst_items WHERE id = p_item_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found.';
  END IF;

  -- 3. Kalkulasi stok terbaru
  v_final_stock := v_item.stock - p_quantity;

  -- Cegah stok minus
  IF v_final_stock < 0 THEN
    RAISE EXCEPTION 'Stok tidak mencukupi. Stok saat ini: %, permintaan: %.', v_item.stock, p_quantity;
  END IF;

  -- Set tipe log berdasarkan laporan
  IF p_type = 'Usage' THEN
    v_source := 'REPORT_USAGE';
  ELSE
    v_source := 'REPORT_DAMAGE';
  END IF;

  -- ================= ATOMIC TRANSACTION BLOCK =================

  -- A. Insert Laporan langsung dengan status Approved
  INSERT INTO public.trx_reports (
    item_id, operator_id, type, quantity, notes, status, reviewed_by, reviewed_at
  ) VALUES (
    p_item_id, v_user_id, p_type::report_type, p_quantity, p_notes, 'Approved', v_user_id, NOW()
  )
  RETURNING id INTO v_report_id;

  -- B. Kurangi Stok Master
  UPDATE public.mst_items
  SET stock = v_final_stock
  WHERE id = v_item.id;

  -- C. Catat di Log
  INSERT INTO public.trx_stock_log (
    item_id, report_id, changed_by, change_amount, previous_stock, final_stock, source, notes
  ) VALUES (
    v_item.id, v_report_id, v_user_id, -p_quantity, v_item.stock, v_final_stock, v_source, p_notes
  );

  -- ============================================================

  RETURN json_build_object(
    'success', true,
    'report_id', v_report_id,
    'item_id', v_item.id,
    'old_stock', v_item.stock,
    'new_stock', v_final_stock,
    'deducted_qty', p_quantity
  );
END;
$$;
