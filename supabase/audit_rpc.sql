-- ==============================================================================================
-- 7. RPC: AUDIT PHYSICAL STOCK (MANUAL ADJUSTMENT)
-- ==============================================================================================
-- Digunakan oleh Supervisor untuk menyesuaikan stok fisik (Opname) jika ada selisih.
-- Fungsi ini akan meng-update stok di mst_items dan mencatat log di trx_stock_log.

CREATE OR REPLACE FUNCTION public.audit_physical_stock(
  p_item_id UUID,
  p_actual_qty NUMERIC,
  p_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_role app_role;
  v_current_stock NUMERIC;
  v_difference NUMERIC;
BEGIN
  -- 1. Get current user and role
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_user_id;

  -- 2. Validasi Role (Hanya SPV yang boleh audit stok manual)
  IF v_role != 'SPV' THEN
    RAISE EXCEPTION 'Forbidden: Only Supervisor can audit stock';
  END IF;

  -- 3. Lock row mst_items untuk mencegah race condition
  SELECT stock INTO v_current_stock 
  FROM public.mst_items 
  WHERE id = p_item_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found';
  END IF;

  -- 4. Hitung selisih
  v_difference := p_actual_qty - v_current_stock;

  -- Jika tidak ada selisih, kembalikan json sukses saja tanpa melakukan apa-apa
  IF v_difference = 0 THEN
    RETURN jsonb_build_object('success', true, 'message', 'No difference in stock.');
  END IF;

  -- 5. Update stok
  UPDATE public.mst_items
  SET stock = p_actual_qty,
      updated_at = NOW()
  WHERE id = p_item_id;

  -- 6. Insert ke trx_stock_log (synchronized with canonical schema)
  INSERT INTO public.trx_stock_log (
    item_id, changed_by, change_amount, previous_stock, final_stock, source, notes
  ) VALUES (
    p_item_id, v_user_id, v_difference, v_current_stock, p_actual_qty, 'AUDIT', 'AUDIT OPNAME: ' || p_notes
  );

  -- 7. Return success
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Stock audited successfully',
    'difference', v_difference,
    'new_stock', p_actual_qty
  );
END;
$$;
