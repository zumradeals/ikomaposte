-- Build #1 Fix: Remove blocking unique constraint + Add backfill + Concurrency protection

-- 1. Remove the old unique CONSTRAINT (not just index) that blocks versioning
ALTER TABLE work_summaries DROP CONSTRAINT IF EXISTS unique_worker_date;

-- 2. Backfill existing summaries to ensure revision/is_current are set correctly
UPDATE work_summaries 
SET 
  revision = COALESCE(revision, 1),
  is_current = COALESCE(is_current, true),
  locked = COALESCE(locked, false)
WHERE revision IS NULL OR revision = 0;

-- 3. Create function for atomic version creation (prevents race conditions)
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
  v_existing RECORD;
  v_new_summary work_summaries;
BEGIN
  -- Lock the row for update to prevent race conditions
  SELECT id, revision, locked, locked_by, locked_at
  INTO v_existing
  FROM work_summaries
  WHERE worker_id = p_worker_id 
    AND work_date = p_work_date 
    AND is_current = true
  FOR UPDATE;

  -- Check if locked
  IF v_existing IS NOT NULL AND v_existing.locked THEN
    RAISE EXCEPTION 'SUMMARY_LOCKED:id=%,locked_by=%,locked_at=%', 
      v_existing.id, 
      COALESCE(v_existing.locked_by::text, 'unknown'),
      COALESCE(v_existing.locked_at::text, 'unknown');
  END IF;

  -- Mark old version as not current
  IF v_existing IS NOT NULL THEN
    UPDATE work_summaries 
    SET is_current = false, updated_at = now()
    WHERE id = v_existing.id;
  END IF;

  -- Insert new version
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
    COALESCE(v_existing.revision, 0) + 1,
    true,
    v_existing.id,
    false,
    NULL,
    NULL
  )
  RETURNING * INTO v_new_summary;

  RETURN v_new_summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;