-- ==============================================================================================
-- 8. RPC: ADD INCOMING STOCK (STOK MASUK)
-- ==============================================================================================
-- Digunakan oleh Supervisor dan Sales untuk menambah stok barang (Restock / Penerimaan Barang).
-- Fungsi ini secara atomik akan menambah stok di mst_items dan mencatat log di trx_stock_log.

CREATE OR REPLACE FUNCTION public.add_incoming_stock(
  p_item_id UUID, 
  p_incoming_qty NUMERIC, 
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
  v_role TEXT;
  v_final_stock NUMERIC;
BEGIN
  v_user_id := auth.uid();
  
  -- 1. Validasi Role (Hanya SPV & SALES yang boleh tambah stok masuk)
  v_role := public.get_my_role();
  IF v_role NOT IN ('SPV', 'SALES') THEN
    RAISE EXCEPTION 'Access Denied: Only Supervisors and Sales can add incoming stock.';
  END IF;

  -- 2. Dapatkan data item untuk diupdate
  SELECT * INTO v_item FROM public.mst_items WHERE id = p_item_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found.';
  END IF;

  -- 3. Kalkulasi stok terbaru
  v_final_stock := v_item.stock + p_incoming_qty;

  -- ================= ATOMIC TRANSACTION BLOCK =================
  
  -- A. Tambah Stok Master
  UPDATE public.mst_items
  SET stock = v_final_stock
  WHERE id = v_item.id;

  -- B. Catat di Log (synchronized with canonical trx_stock_log schema)
  INSERT INTO public.trx_stock_log (
    item_id, changed_by, change_amount, previous_stock, final_stock, source, notes
  ) VALUES (
    v_item.id, v_user_id, p_incoming_qty, v_item.stock, v_final_stock, 'STOCK_IN', p_notes
  );

  -- ============================================================

  RETURN json_build_object(
    'success', true,
    'item_id', v_item.id,
    'old_stock', v_item.stock,
    'new_stock', v_final_stock,
    'added_qty', p_incoming_qty,
    'notes', p_notes
  );
END;
$$;
