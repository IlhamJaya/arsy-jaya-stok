-- 1) Template WA: pengingat restok setelah pemakaian saat stok <= batas minimal
ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS wa_template_restock_usage TEXT;

UPDATE public.app_settings
SET wa_template_restock_usage = COALESCE(
  wa_template_restock_usage,
  '📛 *PERINGATAN RESTOK* 📛

Bahan: *{item}*
Sisa stok setelah pemakaian: *{stock}* {unit}
Batas minimal: *{min_stock}* {unit}

Bahan ini *masih dalam zona kritis*. Mohon restok sebelum pemakaian berlanjut.

Operator: {operator}
Qty dipakai (laporan ini): {qty} {unit}
Waktu: {date} {time}'
)
WHERE id = 1;

-- 2) Urutan RPC: update stok dulu, baru INSERT trx_reports — agar trigger WA membaca sisa stok yang sudah benar
CREATE OR REPLACE FUNCTION public.submit_report_direct(
  p_item_id UUID,
  p_type TEXT,
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

  IF p_type NOT IN ('Usage', 'Damage') THEN
    RAISE EXCEPTION 'Invalid type: %. Must be Usage or Damage.', p_type;
  END IF;

  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than 0.';
  END IF;

  SELECT * INTO v_item FROM public.mst_items WHERE id = p_item_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found.';
  END IF;

  v_final_stock := v_item.stock - p_quantity;

  IF v_final_stock < 0 THEN
    RAISE EXCEPTION 'Stok tidak mencukupi. Stok saat ini: %, permintaan: %.', v_item.stock, p_quantity;
  END IF;

  IF p_type = 'Usage' THEN
    v_source := 'REPORT_USAGE';
  ELSE
    v_source := 'REPORT_DAMAGE';
  END IF;

  -- B dulu: stok master sudah final sebelum INSERT laporan (trigger fonnte-alert membaca stok akhir)
  UPDATE public.mst_items
  SET stock = v_final_stock
  WHERE id = v_item.id;

  INSERT INTO public.trx_reports (
    item_id,
    operator_id,
    type,
    quantity,
    notes,
    status,
    reviewed_by,
    reviewed_at
  ) VALUES (
    p_item_id,
    v_user_id,
    p_type::report_type,
    p_quantity,
    p_notes,
    'Approved',
    v_user_id,
    NOW()
  )
  RETURNING id INTO v_report_id;

  INSERT INTO public.trx_stock_log (
    item_id,
    report_id,
    changed_by,
    change_amount,
    previous_stock,
    final_stock,
    source,
    notes
  ) VALUES (
    v_item.id,
    v_report_id,
    v_user_id,
    -p_quantity,
    v_item.stock,
    v_final_stock,
    v_source,
    p_notes
  );

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
