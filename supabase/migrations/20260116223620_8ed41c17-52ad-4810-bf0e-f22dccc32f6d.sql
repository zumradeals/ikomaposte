-- ============================================
-- Policy Selection Engine v4.1
-- Proper conflict detection at same priority level
-- ============================================

-- Drop existing function to recreate with enhanced logic
DROP FUNCTION IF EXISTS get_effective_policy(UUID, DATE);
DROP FUNCTION IF EXISTS select_policy_for_worker(UUID, DATE);

-- Create the policy selection engine function
CREATE OR REPLACE FUNCTION select_policy_for_worker(
  p_worker_id UUID,
  p_production_date DATE
)
RETURNS TABLE (
  policy_id UUID,
  policy_version_id UUID,
  policy_name TEXT,
  policy_code VARCHAR,
  version INTEGER,
  scope_type policy_scope_type,
  scope_priority INTEGER,
  week_pattern JSONB,
  tolerances JSONB,
  rounding_rules JSONB,
  overtime_rules JSONB,
  timezone TEXT,
  conflict_detected BOOLEAN,
  conflict_policies JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker workers;
  v_matching_policies JSONB;
  v_conflict_count INTEGER;
  v_selected_scope policy_scope_type;
  v_selected_priority INTEGER;
BEGIN
  -- Get worker info
  SELECT * INTO v_worker FROM workers WHERE id = p_worker_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Worker not found: %', p_worker_id;
  END IF;
  
  -- Step 1: Find ALL matching policies grouped by scope priority
  -- Priority order: individual (100) > team (75) > category (50) > default (0)
  CREATE TEMP TABLE IF NOT EXISTS temp_matching_policies (
    policy_id UUID,
    policy_version_id UUID,
    policy_name TEXT,
    policy_code VARCHAR,
    version INTEGER,
    scope_type policy_scope_type,
    scope_type_priority INTEGER,
    manual_priority INTEGER,
    valid_from DATE,
    week_pattern JSONB,
    tolerances JSONB,
    rounding_rules JSONB,
    overtime_rules JSONB,
    timezone TEXT
  ) ON COMMIT DROP;
  
  DELETE FROM temp_matching_policies;
  
  INSERT INTO temp_matching_policies
  SELECT 
    tp.id AS policy_id,
    pv.id AS policy_version_id,
    tp.name AS policy_name,
    tp.code AS policy_code,
    tp.version,
    ps.scope_type,
    CASE ps.scope_type
      WHEN 'individual' THEN 100
      WHEN 'team' THEN 75
      WHEN 'category' THEN 50
      WHEN 'default' THEN 0
    END AS scope_type_priority,
    COALESCE(ps.priority, 0) AS manual_priority,
    tp.valid_from,
    tp.week_pattern,
    tp.tolerances,
    tp.rounding_rules,
    tp.overtime_rules,
    tp.timezone
  FROM time_policies tp
  JOIN policy_scopes ps ON ps.policy_id = tp.id
  LEFT JOIN policy_versions pv ON pv.policy_id = tp.id 
    AND pv.status = 'ACTIVE'
    AND pv.valid_from <= p_production_date
    AND (pv.valid_to IS NULL OR pv.valid_to >= p_production_date)
  WHERE tp.status = 'ACTIVE'
    AND tp.valid_from <= p_production_date
    AND (tp.valid_to IS NULL OR tp.valid_to >= p_production_date)
    AND (
      -- Individual scope: matches this worker
      (ps.scope_type = 'individual' AND ps.target_id = p_worker_id)
      -- Team scope: would need team_id on worker - skip for now
      -- Category scope: matches worker's category
      OR (ps.scope_type = 'category' AND ps.target_id = v_worker.category_id)
      -- Default scope: applies to everyone
      OR (ps.scope_type = 'default' AND ps.target_id IS NULL)
    );
  
  -- Step 2: Find the highest priority scope type with matching policies
  SELECT scope_type, scope_type_priority
  INTO v_selected_scope, v_selected_priority
  FROM temp_matching_policies
  ORDER BY scope_type_priority DESC
  LIMIT 1;
  
  -- If no policies found, return empty
  IF v_selected_scope IS NULL THEN
    RETURN;
  END IF;
  
  -- Step 3: Count policies at that priority level
  SELECT COUNT(*)
  INTO v_conflict_count
  FROM temp_matching_policies
  WHERE scope_type_priority = v_selected_priority;
  
  -- Step 4: If multiple policies at same priority, it's a conflict
  IF v_conflict_count > 1 THEN
    -- Build conflict info
    SELECT jsonb_agg(jsonb_build_object(
      'policy_id', tmp.policy_id,
      'policy_name', tmp.policy_name,
      'policy_code', tmp.policy_code,
      'scope_type', tmp.scope_type,
      'manual_priority', tmp.manual_priority
    ))
    INTO v_matching_policies
    FROM temp_matching_policies tmp
    WHERE tmp.scope_type_priority = v_selected_priority;
    
    -- Return the first one with conflict flag
    RETURN QUERY
    SELECT 
      tmp.policy_id,
      tmp.policy_version_id,
      tmp.policy_name,
      tmp.policy_code,
      tmp.version,
      tmp.scope_type,
      tmp.manual_priority,
      tmp.week_pattern,
      tmp.tolerances,
      tmp.rounding_rules,
      tmp.overtime_rules,
      tmp.timezone,
      TRUE AS conflict_detected,
      v_matching_policies AS conflict_policies
    FROM temp_matching_policies tmp
    WHERE tmp.scope_type_priority = v_selected_priority
    ORDER BY tmp.manual_priority DESC, tmp.valid_from DESC
    LIMIT 1;
  ELSE
    -- No conflict - return the single matching policy
    RETURN QUERY
    SELECT 
      tmp.policy_id,
      tmp.policy_version_id,
      tmp.policy_name,
      tmp.policy_code,
      tmp.version,
      tmp.scope_type,
      tmp.manual_priority,
      tmp.week_pattern,
      tmp.tolerances,
      tmp.rounding_rules,
      tmp.overtime_rules,
      tmp.timezone,
      FALSE AS conflict_detected,
      NULL::JSONB AS conflict_policies
    FROM temp_matching_policies tmp
    WHERE tmp.scope_type_priority = v_selected_priority
    LIMIT 1;
  END IF;
END;
$$;

-- Recreate get_effective_policy as a simpler wrapper (backward compatible)
CREATE OR REPLACE FUNCTION get_effective_policy(
  p_worker_id UUID,
  p_work_date DATE
)
RETURNS TABLE (
  policy_id UUID,
  policy_name TEXT,
  policy_code VARCHAR,
  version INTEGER,
  scope_type policy_scope_type,
  scope_priority INTEGER,
  week_pattern JSONB,
  tolerances JSONB,
  rounding_rules JSONB,
  overtime_rules JSONB,
  timezone TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.policy_id,
    s.policy_name,
    s.policy_code,
    s.version,
    s.scope_type,
    s.scope_priority,
    s.week_pattern,
    s.tolerances,
    s.rounding_rules,
    s.overtime_rules,
    s.timezone
  FROM select_policy_for_worker(p_worker_id, p_work_date) s
  WHERE NOT s.conflict_detected;
END;
$$;

-- Add comments
COMMENT ON FUNCTION select_policy_for_worker IS 
'Policy Selection Engine v4.1 - Selects exactly ONE policy for a worker/production_date.
Priority: individual (100) > team (75) > category (50) > default (0).
Returns conflict_detected=true if multiple policies at same priority level.';

COMMENT ON FUNCTION get_effective_policy IS 
'Backward-compatible wrapper for select_policy_for_worker. Returns NULL if conflict detected.';