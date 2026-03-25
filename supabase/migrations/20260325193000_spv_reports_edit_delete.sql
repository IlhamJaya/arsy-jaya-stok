-- SPV actions for trx_reports (Usage) : edit notes & delete with stock restore

-- ---------------------------------------------------------------------------------------------
-- Update report notes + sync notes to trx_stock_log (if any)
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.spv_update_trx_report_notes(
  p_report_id UUID,
  p_notes TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_is_spv BOOLEAN;
BEGIN
  v_user_id := auth.uid();

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = v_user_id
      AND role = 'SPV'
  ) INTO v_is_spv;

  IF NOT v_is_spv THEN
    RAISE EXCEPTION 'Forbidden: SPV only';
  END IF;

  UPDATE public.trx_reports
  SET notes = p_notes
  WHERE id = p_report_id;

  UPDATE public.trx_stock_log
  SET notes = p_notes
  WHERE report_id = p_report_id;

  RETURN json_build_object('success', true, 'report_id', p_report_id);
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- Delete report and restore stock (+ write trx_stock_log)
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.spv_delete_trx_report_and_restore_stock(
  p_report_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_is_spv BOOLEAN;
  v_report RECORD;
  v_item RECORD;
  v_source TEXT;
  v_prev_stock NUMERIC;
  v_final_stock NUMERIC;
BEGIN
  v_user_id := auth.uid();

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = v_user_id
      AND role = 'SPV'
  ) INTO v_is_spv;

  IF NOT v_is_spv THEN
    RAISE EXCEPTION 'Forbidden: SPV only';
  END IF;

  SELECT * INTO v_report
  FROM public.trx_reports
  WHERE id = p_report_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found: %', p_report_id;
  END IF;

  SELECT * INTO v_item
  FROM public.mst_items
  WHERE id = v_report.item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found: %', v_report.item_id;
  END IF;

  -- Restore stock by adding quantity back.
  -- type is enum, so we compare via text.
  IF v_report.type::text = 'Usage' THEN
    v_source := 'REPORT_USAGE';
  ELSE
    v_source := 'REPORT_DAMAGE';
  END IF;

  v_prev_stock := v_item.stock;
  v_final_stock := v_prev_stock + v_report.quantity;

  UPDATE public.mst_items
  SET stock = v_final_stock
  WHERE id = v_item.id;

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
    p_report_id,
    v_user_id,
    v_report.quantity,
    v_prev_stock,
    v_final_stock,
    v_source,
    v_report.notes
  );

  DELETE FROM public.trx_reports
  WHERE id = p_report_id;

  RETURN json_build_object(
    'success', true,
    'report_id', p_report_id,
    'restored_qty', v_report.quantity,
    'source', v_source
  );
END;
$$;

