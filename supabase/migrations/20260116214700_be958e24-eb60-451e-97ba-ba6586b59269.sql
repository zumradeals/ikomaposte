-- =============================================
-- Working Time Policy Enhanced Model v4.0
-- Comprehensive policy structure with audit replay
-- =============================================

-- New enums for policy model
DO $$ BEGIN
  CREATE TYPE policy_scope_type AS ENUM ('individual', 'team', 'category', 'default');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE overtime_mode AS ENUM ('DAILY', 'WEEKLY', 'OUTSIDE_SCHEDULE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Drop existing foreign key if exists (to alter time_policies)
ALTER TABLE IF EXISTS policy_versions 
DROP CONSTRAINT IF EXISTS policy_versions_policy_id_fkey;

-- =============================================
-- Enhanced time_policies table
-- =============================================
ALTER TABLE time_policies 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS status policy_status DEFAULT 'DRAFT',
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Africa/Dakar',
ADD COLUMN IF NOT EXISTS valid_from DATE,
ADD COLUMN IF NOT EXISTS valid_to DATE,
ADD COLUMN IF NOT EXISTS week_pattern JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS tolerances JSONB DEFAULT '{"late_grace_minutes": 15, "early_leave_grace_minutes": 15, "day_overrides": {}}',
ADD COLUMN IF NOT EXISTS rounding_rules JSONB DEFAULT '{"mode": "NONE", "step_minutes": 15, "apply_to": ["worked_time"]}',
ADD COLUMN IF NOT EXISTS overtime_rules JSONB DEFAULT '{"mode": "DAILY", "threshold_hours": 8, "approval_required": false}',
ADD COLUMN IF NOT EXISTS justification TEXT,
ADD COLUMN IF NOT EXISTS immutable_when_active BOOLEAN DEFAULT true;

-- Re-add foreign key
ALTER TABLE policy_versions 
ADD CONSTRAINT policy_versions_policy_id_fkey 
FOREIGN KEY (policy_id) REFERENCES time_policies(id) ON DELETE CASCADE;

-- =============================================
-- Policy Scopes Table (supports multiple scopes per policy)
-- =============================================
CREATE TABLE IF NOT EXISTS policy_scopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES time_policies(id) ON DELETE CASCADE,
  scope_type policy_scope_type NOT NULL,
  target_id UUID, -- NULL for 'default' scope
  priority INTEGER DEFAULT 0, -- Higher priority wins in conflicts
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Ensure unique scope per policy
  UNIQUE(policy_id, scope_type, target_id)
);

-- Index for fast scope lookups
CREATE INDEX IF NOT EXISTS idx_policy_scopes_target ON policy_scopes(scope_type, target_id);
CREATE INDEX IF NOT EXISTS idx_policy_scopes_policy ON policy_scopes(policy_id);

-- =============================================
-- Policy Audit Trail (immutable log of all changes)
-- =============================================
CREATE TABLE IF NOT EXISTS policy_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES time_policies(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'created', 'activated', 'archived', 'version_bumped'
  previous_state JSONB, -- Full snapshot before change
  new_state JSONB, -- Full snapshot after change
  changed_by UUID NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT now(),
  justification TEXT,
  
  -- Metadata for replay
  version_at_change INTEGER NOT NULL,
  status_at_change policy_status NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_policy_audit_trail_policy ON policy_audit_trail(policy_id, changed_at DESC);

-- =============================================
-- RLS Policies
-- =============================================
ALTER TABLE policy_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_audit_trail ENABLE ROW LEVEL SECURITY;

-- Policy Scopes RLS
CREATE POLICY "policy_scopes_select" ON policy_scopes
  FOR SELECT USING (true);

CREATE POLICY "policy_scopes_insert" ON policy_scopes
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "policy_scopes_update" ON policy_scopes
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "policy_scopes_delete" ON policy_scopes
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Policy Audit Trail RLS (read-only for admins, insert via function)
CREATE POLICY "policy_audit_trail_select" ON policy_audit_trail
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "policy_audit_trail_insert" ON policy_audit_trail
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- Function: Activate a policy (with immutability check)
-- =============================================
CREATE OR REPLACE FUNCTION activate_policy(
  p_policy_id UUID,
  p_justification TEXT DEFAULT NULL
)
RETURNS time_policies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy time_policies;
  v_previous_state JSONB;
  v_new_state JSONB;
BEGIN
  -- Lock the policy row
  SELECT * INTO v_policy FROM time_policies WHERE id = p_policy_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Policy not found: %', p_policy_id;
  END IF;
  
  IF v_policy.status = 'ACTIVE' THEN
    RAISE EXCEPTION 'Policy is already active';
  END IF;
  
  IF v_policy.valid_from IS NULL THEN
    RAISE EXCEPTION 'Cannot activate policy without valid_from date';
  END IF;
  
  -- Capture previous state
  v_previous_state := to_jsonb(v_policy);
  
  -- Deactivate any conflicting active policies with same scope
  UPDATE time_policies tp
  SET status = 'ARCHIVED',
      updated_at = now()
  FROM policy_scopes ps_new, policy_scopes ps_old
  WHERE ps_new.policy_id = p_policy_id
    AND ps_old.policy_id = tp.id
    AND tp.id != p_policy_id
    AND tp.status = 'ACTIVE'
    AND ps_new.scope_type = ps_old.scope_type
    AND (ps_new.target_id = ps_old.target_id OR (ps_new.target_id IS NULL AND ps_old.target_id IS NULL))
    AND (
      (v_policy.valid_from <= tp.valid_to OR tp.valid_to IS NULL)
      AND (v_policy.valid_to >= tp.valid_from OR v_policy.valid_to IS NULL)
    );
  
  -- Activate the policy
  UPDATE time_policies
  SET status = 'ACTIVE',
      updated_at = now()
  WHERE id = p_policy_id
  RETURNING * INTO v_policy;
  
  -- Capture new state
  v_new_state := to_jsonb(v_policy);
  
  -- Record in audit trail
  INSERT INTO policy_audit_trail (
    policy_id, action, previous_state, new_state,
    changed_by, justification, version_at_change, status_at_change
  ) VALUES (
    p_policy_id, 'activated', v_previous_state, v_new_state,
    auth.uid(), p_justification, v_policy.version, v_policy.status
  );
  
  RETURN v_policy;
END;
$$;

-- =============================================
-- Function: Create new version of a policy
-- =============================================
CREATE OR REPLACE FUNCTION bump_policy_version(
  p_policy_id UUID,
  p_changes JSONB,
  p_justification TEXT
)
RETURNS time_policies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy time_policies;
  v_previous_state JSONB;
  v_new_state JSONB;
  v_new_version INTEGER;
BEGIN
  -- Lock and get current policy
  SELECT * INTO v_policy FROM time_policies WHERE id = p_policy_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Policy not found: %', p_policy_id;
  END IF;
  
  -- Check immutability
  IF v_policy.status = 'ACTIVE' AND v_policy.immutable_when_active THEN
    RAISE EXCEPTION 'Cannot modify active policy with immutable_when_active=true. Archive first or create new policy.';
  END IF;
  
  -- Capture previous state
  v_previous_state := to_jsonb(v_policy);
  v_new_version := v_policy.version + 1;
  
  -- Apply changes
  UPDATE time_policies
  SET 
    version = v_new_version,
    name = COALESCE(p_changes->>'name', name),
    description = COALESCE(p_changes->>'description', description),
    timezone = COALESCE(p_changes->>'timezone', timezone),
    valid_from = COALESCE((p_changes->>'valid_from')::DATE, valid_from),
    valid_to = CASE 
      WHEN p_changes ? 'valid_to' THEN (p_changes->>'valid_to')::DATE 
      ELSE valid_to 
    END,
    week_pattern = COALESCE(p_changes->'week_pattern', week_pattern),
    tolerances = COALESCE(p_changes->'tolerances', tolerances),
    rounding_rules = COALESCE(p_changes->'rounding_rules', rounding_rules),
    overtime_rules = COALESCE(p_changes->'overtime_rules', overtime_rules),
    justification = p_justification,
    updated_at = now()
  WHERE id = p_policy_id
  RETURNING * INTO v_policy;
  
  -- Capture new state
  v_new_state := to_jsonb(v_policy);
  
  -- Record in audit trail
  INSERT INTO policy_audit_trail (
    policy_id, action, previous_state, new_state,
    changed_by, justification, version_at_change, status_at_change
  ) VALUES (
    p_policy_id, 'version_bumped', v_previous_state, v_new_state,
    auth.uid(), p_justification, v_policy.version, v_policy.status
  );
  
  RETURN v_policy;
END;
$$;

-- =============================================
-- Function: Get effective policy for a worker on a date
-- =============================================
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
DECLARE
  v_worker workers;
BEGIN
  -- Get worker info
  SELECT * INTO v_worker FROM workers WHERE id = p_worker_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Worker not found: %', p_worker_id;
  END IF;
  
  -- Return matching policy with highest priority scope
  RETURN QUERY
  SELECT DISTINCT ON (ps.scope_type, ps.target_id)
    tp.id AS policy_id,
    tp.name AS policy_name,
    tp.code AS policy_code,
    tp.version,
    ps.scope_type,
    ps.priority AS scope_priority,
    tp.week_pattern,
    tp.tolerances,
    tp.rounding_rules,
    tp.overtime_rules,
    tp.timezone
  FROM time_policies tp
  JOIN policy_scopes ps ON ps.policy_id = tp.id
  WHERE tp.status = 'ACTIVE'
    AND tp.valid_from <= p_work_date
    AND (tp.valid_to IS NULL OR tp.valid_to >= p_work_date)
    AND (
      -- Individual scope: matches this worker
      (ps.scope_type = 'individual' AND ps.target_id = p_worker_id)
      -- Category scope: matches worker's category
      OR (ps.scope_type = 'category' AND ps.target_id = v_worker.category_id)
      -- Default scope: applies to everyone
      OR (ps.scope_type = 'default' AND ps.target_id IS NULL)
    )
  ORDER BY 
    ps.scope_type, 
    ps.target_id,
    ps.priority DESC,
    tp.valid_from DESC
  LIMIT 1;
END;
$$;

-- =============================================
-- Function: Replay policy state at a point in time
-- =============================================
CREATE OR REPLACE FUNCTION replay_policy_at(
  p_policy_id UUID,
  p_timestamp TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state JSONB;
BEGIN
  -- Find the state just before or at the given timestamp
  SELECT new_state INTO v_state
  FROM policy_audit_trail
  WHERE policy_id = p_policy_id
    AND changed_at <= p_timestamp
  ORDER BY changed_at DESC
  LIMIT 1;
  
  IF v_state IS NULL THEN
    -- No audit record found, policy might have been created after
    SELECT to_jsonb(tp) INTO v_state
    FROM time_policies tp
    WHERE id = p_policy_id
      AND created_at <= p_timestamp;
  END IF;
  
  RETURN v_state;
END;
$$;