-- Create atomic batch validation function
-- Requires admin role, idempotent, returns summary
CREATE OR REPLACE FUNCTION public.hr_validate_summaries(p_summary_ids UUID[])
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_validated_count INTEGER := 0;
  v_skipped_count INTEGER := 0;
  v_error_count INTEGER := 0;
  v_errors TEXT[] := '{}';
  v_summary_id UUID;
  v_user_id UUID;
  v_current_status TEXT;
  v_is_locked BOOLEAN;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  -- Check admin role
  IF NOT has_role(v_user_id, 'admin') THEN
    RAISE EXCEPTION 'ACCESS_DENIED: Requires admin role';
  END IF;

  -- Process each summary
  FOREACH v_summary_id IN ARRAY p_summary_ids
  LOOP
    BEGIN
      -- Get current state with lock
      SELECT validation_status, locked
      INTO v_current_status, v_is_locked
      FROM work_summaries
      WHERE id = v_summary_id AND is_current = true
      FOR UPDATE;

      -- Skip if not found
      IF NOT FOUND THEN
        v_error_count := v_error_count + 1;
        v_errors := array_append(v_errors, 'NOT_FOUND:' || v_summary_id::text);
        CONTINUE;
      END IF;

      -- Skip if already validated (idempotent)
      IF v_current_status = 'VALIDATED' THEN
        v_skipped_count := v_skipped_count + 1;
        CONTINUE;
      END IF;

      -- Skip if locked by different process
      IF v_is_locked THEN
        v_skipped_count := v_skipped_count + 1;
        CONTINUE;
      END IF;

      -- Validate and lock
      UPDATE work_summaries
      SET 
        validation_status = 'VALIDATED',
        validated_by = v_user_id,
        validated_at = now(),
        locked = true,
        locked_by = v_user_id,
        locked_at = now(),
        updated_at = now()
      WHERE id = v_summary_id;

      v_validated_count := v_validated_count + 1;

    EXCEPTION WHEN OTHERS THEN
      v_error_count := v_error_count + 1;
      v_errors := array_append(v_errors, SQLERRM || ':' || v_summary_id::text);
    END;
  END LOOP;

  -- Return summary
  RETURN json_build_object(
    'validated_count', v_validated_count,
    'skipped_count', v_skipped_count,
    'error_count', v_error_count,
    'errors', v_errors,
    'total_processed', array_length(p_summary_ids, 1)
  );
END;
$$;

-- Grant execute to authenticated users (RLS check inside function)
GRANT EXECUTE ON FUNCTION public.hr_validate_summaries(UUID[]) TO authenticated;