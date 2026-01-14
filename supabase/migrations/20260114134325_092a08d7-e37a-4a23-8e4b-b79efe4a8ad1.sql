-- Fix: The function must set is_current=false BEFORE inserting the new row
-- The issue is the partial unique index on (worker_id, work_date) WHERE is_current=true

CREATE OR REPLACE FUNCTION create_summary_version(
  p_worker_id UUID,
  p_work_date DATE,
  p_total_work_minutes INTEGER,
  p_total_pause_minutes INTEGER,
  p_total_amount NUMERIC,
  p_taux_horaire_applied NUMERIC,
  p_devise TEXT,
  p_auto_closed BOOLEAN,
  p_auto_close_time TIME,
  p_events_used UUID[],
  p_segments_json JSONB,
  p_notes TEXT,
  p_calculation_version TEXT
) RETURNS work_summaries AS $$
DECLARE
  v_existing_id UUID;
  v_existing_revision INTEGER;
  v_is_locked BOOLEAN;
  v_locked_by UUID;
  v_locked_at TIMESTAMPTZ;
  v_new_summary work_summaries;
BEGIN
  -- Lock and fetch existing current summary
  SELECT id, revision, locked, locked_by, locked_at
  INTO v_existing_id, v_existing_revision, v_is_locked, v_locked_by, v_locked_at
  FROM work_summaries
  WHERE worker_id = p_worker_id 
    AND work_date = p_work_date 
    AND is_current = true
  FOR UPDATE;

  -- Check if locked
  IF v_existing_id IS NOT NULL AND v_is_locked THEN
    RAISE EXCEPTION 'SUMMARY_LOCKED:id=%,locked_by=%,locked_at=%', 
      v_existing_id, 
      COALESCE(v_locked_by::text, 'unknown'),
      COALESCE(v_locked_at::text, 'unknown');
  END IF;

  -- CRITICAL: Mark old version as not current FIRST (before insert)
  -- This clears the partial unique index constraint
  IF v_existing_id IS NOT NULL THEN
    UPDATE work_summaries 
    SET is_current = false, updated_at = now()
    WHERE id = v_existing_id;
  END IF;

  -- Now insert new version (partial unique index is now clear)
  INSERT INTO work_summaries (
    worker_id,
    work_date,
    total_work_minutes,
    total_pause_minutes,
    total_amount,
    taux_horaire_applied,
    devise,
    auto_closed,
    auto_close_time,
    events_used,
    segments_json,
    notes,
    calculation_version,
    revision,
    is_current,
    supersedes_id,
    locked,
    locked_by,
    locked_at
  ) VALUES (
    p_worker_id,
    p_work_date,
    p_total_work_minutes,
    p_total_pause_minutes,
    p_total_amount,
    p_taux_horaire_applied,
    p_devise,
    p_auto_closed,
    p_auto_close_time,
    p_events_used,
    p_segments_json,
    p_notes,
    p_calculation_version,
    COALESCE(v_existing_revision, 0) + 1,
    true,
    v_existing_id,
    false,
    NULL,
    NULL
  )
  RETURNING * INTO v_new_summary;

  RETURN v_new_summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;