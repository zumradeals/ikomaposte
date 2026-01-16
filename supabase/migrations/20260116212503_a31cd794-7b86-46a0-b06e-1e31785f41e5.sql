-- ============================================
-- IKOMA Working Time Policies Engine v3.0
-- Migration: Rules Engine Core Tables
-- ============================================

-- ============================================
-- ENUMS
-- ============================================

-- Rule types for policy configuration
CREATE TYPE public.rule_type AS ENUM (
  'SCHEDULE',       -- Basic working hours
  'ROUNDING',       -- Quarter-hour rounding
  'TOLERANCE',      -- Late/early tolerance  
  'OVERTIME',       -- Overtime calculation
  'NIGHT_SHIFT',    -- Cross-day handling
  'BREAK',          -- Mandatory break rules
  'ROTATION'        -- Team rotation pattern
);

-- Rounding modes for punch times
CREATE TYPE public.rounding_mode AS ENUM (
  'NONE',           -- Exact time (no rounding)
  'QUARTER_CEIL',   -- Round up to 15min
  'QUARTER_FLOOR',  -- Round down to 15min
  'QUARTER_NEAREST' -- Round to nearest 15min
);

-- Policy status lifecycle
CREATE TYPE public.policy_status AS ENUM (
  'DRAFT',      -- Being configured
  'ACTIVE',     -- Currently in use
  'SUPERSEDED', -- Replaced by newer version
  'ARCHIVED'    -- No longer used
);

-- Shift pattern types
CREATE TYPE public.shift_pattern_type AS ENUM (
  'DAY',        -- Standard day shift (8h-17h)
  'MORNING',    -- Morning shift (6h-14h)
  'AFTERNOON',  -- Afternoon shift (14h-22h)
  'NIGHT',      -- Night shift (22h-6h)
  'FLEX',       -- Flexible hours
  'ROTATING'    -- Rotating 3x8
);

-- Cross-day handling strategies
CREATE TYPE public.cross_day_strategy AS ENUM (
  'MERGE_TO_START_DAY',  -- Night shift counts for start day
  'MERGE_TO_END_DAY',    -- Night shift counts for end day
  'SPLIT_AT_MIDNIGHT'    -- Split at midnight (not recommended)
);

-- ============================================
-- TABLE: time_policies (Master policy container)
-- ============================================
CREATE TABLE public.time_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(30) UNIQUE NOT NULL,  -- e.g., "POL-ADMIN-2025"
  name TEXT NOT NULL,
  description TEXT,
  applies_to_category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for active policy lookup
CREATE INDEX idx_time_policies_active ON public.time_policies(is_active) WHERE is_active = true;
CREATE INDEX idx_time_policies_category ON public.time_policies(applies_to_category_id);

-- ============================================
-- TABLE: policy_versions (Immutable snapshots)
-- ============================================
CREATE TABLE public.policy_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES public.time_policies(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  valid_from DATE NOT NULL,
  valid_to DATE,  -- NULL = currently active
  status public.policy_status NOT NULL DEFAULT 'DRAFT',
  rules_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,  -- Full rules snapshot at creation
  change_reason TEXT,  -- Why this version was created
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  superseded_by UUID REFERENCES public.policy_versions(id),
  UNIQUE(policy_id, version_number),
  -- Ensure valid_from < valid_to when both are set
  CONSTRAINT valid_date_range CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

-- Indexes for version lookup
CREATE INDEX idx_policy_versions_policy ON public.policy_versions(policy_id);
CREATE INDEX idx_policy_versions_validity ON public.policy_versions(valid_from, valid_to);
CREATE INDEX idx_policy_versions_status ON public.policy_versions(status);

-- ============================================
-- TABLE: shift_patterns (Reusable shift templates)
-- ============================================
CREATE TABLE public.shift_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(30) UNIQUE NOT NULL,  -- e.g., "SHIFT-3x8-MATIN"
  name TEXT NOT NULL,
  pattern_type public.shift_pattern_type NOT NULL,
  shifts JSONB NOT NULL DEFAULT '[]'::jsonb,  -- Array of shift definitions
  cross_day BOOLEAN NOT NULL DEFAULT false,  -- True for night shifts
  cross_day_strategy public.cross_day_strategy DEFAULT 'MERGE_TO_START_DAY',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- TABLE: policy_rules (Individual rules linked to version)
-- ============================================
CREATE TABLE public.policy_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_version_id UUID NOT NULL REFERENCES public.policy_versions(id) ON DELETE CASCADE,
  rule_type public.rule_type NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,  -- Higher = evaluated first
  name TEXT NOT NULL,  -- Human-readable rule name
  config JSONB NOT NULL DEFAULT '{}'::jsonb,  -- Rule-specific configuration
  shift_pattern_id UUID REFERENCES public.shift_patterns(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for rule lookup
CREATE INDEX idx_policy_rules_version ON public.policy_rules(policy_version_id);
CREATE INDEX idx_policy_rules_type ON public.policy_rules(rule_type);
CREATE INDEX idx_policy_rules_priority ON public.policy_rules(priority DESC);

-- ============================================
-- TABLE: rotation_calendars (Team/worker rotation assignments)
-- ============================================
CREATE TABLE public.rotation_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  policy_id UUID NOT NULL REFERENCES public.time_policies(id) ON DELETE CASCADE,
  rotation_pattern JSONB NOT NULL,  -- Weekly/monthly rotation definition
  team_assignments JSONB NOT NULL DEFAULT '[]'::jsonb,  -- Worker IDs per team
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rotation_calendars_policy ON public.rotation_calendars(policy_id);
CREATE INDEX idx_rotation_calendars_dates ON public.rotation_calendars(start_date, end_date);

-- ============================================
-- TABLE: calculation_traces (Full audit trail)
-- ============================================
CREATE TABLE public.calculation_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_id UUID NOT NULL REFERENCES public.work_summaries(id) ON DELETE CASCADE,
  policy_version_id UUID REFERENCES public.policy_versions(id),
  worker_id UUID NOT NULL REFERENCES public.workers(id),
  work_date DATE NOT NULL,
  
  -- Input data (immutable raw punches)
  raw_punches JSONB NOT NULL,  -- Original timestamps as received
  
  -- Transformation data
  rounded_punches JSONB,  -- After rounding applied (if any)
  rounding_details JSONB,  -- Which rounding rules were applied
  
  -- Rules evaluation
  rules_applied JSONB NOT NULL DEFAULT '[]'::jsonb,  -- Which rules fired and in what order
  decision_path TEXT NOT NULL,  -- "P1→ANOMALIE" or "P4→RETARD→OVERTIME"
  
  -- Calculation breakdown
  calculation_inputs JSONB NOT NULL,  -- Full input context (schedule, tolerances, etc.)
  calculation_outputs JSONB NOT NULL,  -- Final computed values
  
  -- Overtime details (if applicable)
  overtime_breakdown JSONB,  -- Hours at each rate tier
  
  -- Anomaly/conflict tracking
  conflicts_detected JSONB,  -- Any policy conflicts
  anomaly_reason TEXT,  -- If anomaly, why
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for trace lookup
CREATE INDEX idx_calculation_traces_summary ON public.calculation_traces(summary_id);
CREATE INDEX idx_calculation_traces_worker_date ON public.calculation_traces(worker_id, work_date);
CREATE INDEX idx_calculation_traces_policy ON public.calculation_traces(policy_version_id);

-- ============================================
-- TABLE: policy_conflicts (Explicit conflict log)
-- ============================================
CREATE TABLE public.policy_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES public.workers(id),
  work_date DATE NOT NULL,
  conflict_type TEXT NOT NULL,  -- 'POLICY_OVERLAP', 'SHIFT_CONFLICT', 'ROUNDING_ANOMALY'
  conflicting_policies JSONB NOT NULL,  -- Array of policy version IDs in conflict
  description TEXT NOT NULL,
  resolution TEXT,  -- How it was resolved (if at all)
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_policy_conflicts_worker_date ON public.policy_conflicts(worker_id, work_date);
CREATE INDEX idx_policy_conflicts_unresolved ON public.policy_conflicts(resolved_at) WHERE resolved_at IS NULL;

-- ============================================
-- ADD policy_version_id TO work_summaries
-- ============================================
ALTER TABLE public.work_summaries 
ADD COLUMN IF NOT EXISTS policy_version_id UUID REFERENCES public.policy_versions(id);

CREATE INDEX IF NOT EXISTS idx_work_summaries_policy_version 
ON public.work_summaries(policy_version_id);

-- ============================================
-- TRIGGERS: Auto-update updated_at
-- ============================================
CREATE TRIGGER update_time_policies_updated_at
  BEFORE UPDATE ON public.time_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shift_patterns_updated_at
  BEFORE UPDATE ON public.shift_patterns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rotation_calendars_updated_at
  BEFORE UPDATE ON public.rotation_calendars
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- RLS POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE public.time_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rotation_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calculation_traces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_conflicts ENABLE ROW LEVEL SECURITY;

-- time_policies: Read for all, write for admin
CREATE POLICY "time_policies_select" ON public.time_policies
  FOR SELECT USING (true);

CREATE POLICY "time_policies_insert" ON public.time_policies
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "time_policies_update" ON public.time_policies
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "time_policies_delete" ON public.time_policies
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- policy_versions: Read for all, write for admin
CREATE POLICY "policy_versions_select" ON public.policy_versions
  FOR SELECT USING (true);

CREATE POLICY "policy_versions_insert" ON public.policy_versions
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "policy_versions_update" ON public.policy_versions
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- policy_rules: Read for all, write for admin
CREATE POLICY "policy_rules_select" ON public.policy_rules
  FOR SELECT USING (true);

CREATE POLICY "policy_rules_insert" ON public.policy_rules
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "policy_rules_update" ON public.policy_rules
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "policy_rules_delete" ON public.policy_rules
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- shift_patterns: Read for all, write for admin
CREATE POLICY "shift_patterns_select" ON public.shift_patterns
  FOR SELECT USING (true);

CREATE POLICY "shift_patterns_insert" ON public.shift_patterns
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "shift_patterns_update" ON public.shift_patterns
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "shift_patterns_delete" ON public.shift_patterns
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- rotation_calendars: Read for all, write for admin
CREATE POLICY "rotation_calendars_select" ON public.rotation_calendars
  FOR SELECT USING (true);

CREATE POLICY "rotation_calendars_insert" ON public.rotation_calendars
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "rotation_calendars_update" ON public.rotation_calendars
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "rotation_calendars_delete" ON public.rotation_calendars
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- calculation_traces: Read for admin only (sensitive audit data)
CREATE POLICY "calculation_traces_select" ON public.calculation_traces
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "calculation_traces_insert" ON public.calculation_traces
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- policy_conflicts: Read for admin, insert automatic
CREATE POLICY "policy_conflicts_select" ON public.policy_conflicts
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "policy_conflicts_insert" ON public.policy_conflicts
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "policy_conflicts_update" ON public.policy_conflicts
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- FUNCTION: Get applicable policy for worker on date
-- ============================================
CREATE OR REPLACE FUNCTION public.get_applicable_policy(
  p_worker_id UUID,
  p_work_date DATE
)
RETURNS TABLE(
  policy_id UUID,
  policy_version_id UUID,
  policy_code VARCHAR(30),
  version_number INTEGER,
  rules_snapshot JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_category_id UUID;
BEGIN
  -- Get worker's category
  SELECT category_id INTO v_category_id
  FROM workers WHERE id = p_worker_id;
  
  IF v_category_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Find applicable policy version
  RETURN QUERY
  SELECT 
    tp.id AS policy_id,
    pv.id AS policy_version_id,
    tp.code AS policy_code,
    pv.version_number,
    pv.rules_snapshot
  FROM time_policies tp
  JOIN policy_versions pv ON pv.policy_id = tp.id
  WHERE tp.applies_to_category_id = v_category_id
    AND tp.is_active = true
    AND pv.status = 'ACTIVE'
    AND pv.valid_from <= p_work_date
    AND (pv.valid_to IS NULL OR pv.valid_to >= p_work_date)
  ORDER BY pv.valid_from DESC
  LIMIT 1;
END;
$$;

-- ============================================
-- FUNCTION: Create new policy version (immutable)
-- ============================================
CREATE OR REPLACE FUNCTION public.create_policy_version(
  p_policy_id UUID,
  p_valid_from DATE,
  p_rules JSONB,
  p_change_reason TEXT DEFAULT NULL
)
RETURNS public.policy_versions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_current_version_id UUID;
  v_current_version_number INTEGER;
  v_new_version policy_versions;
BEGIN
  v_user_id := auth.uid();
  
  -- Check admin role
  IF NOT has_role(v_user_id, 'admin') THEN
    RAISE EXCEPTION 'ACCESS_DENIED: Requires admin role';
  END IF;
  
  -- Get current active version
  SELECT id, version_number
  INTO v_current_version_id, v_current_version_number
  FROM policy_versions
  WHERE policy_id = p_policy_id
    AND status = 'ACTIVE'
  ORDER BY version_number DESC
  LIMIT 1
  FOR UPDATE;
  
  -- Supersede current version if exists
  IF v_current_version_id IS NOT NULL THEN
    UPDATE policy_versions
    SET 
      status = 'SUPERSEDED',
      valid_to = p_valid_from - INTERVAL '1 day'
    WHERE id = v_current_version_id;
  END IF;
  
  -- Create new version
  INSERT INTO policy_versions (
    policy_id,
    version_number,
    valid_from,
    status,
    rules_snapshot,
    change_reason,
    created_by,
    superseded_by
  ) VALUES (
    p_policy_id,
    COALESCE(v_current_version_number, 0) + 1,
    p_valid_from,
    'ACTIVE',
    p_rules,
    p_change_reason,
    v_user_id,
    NULL
  )
  RETURNING * INTO v_new_version;
  
  -- Update old version with superseded_by reference
  IF v_current_version_id IS NOT NULL THEN
    UPDATE policy_versions
    SET superseded_by = v_new_version.id
    WHERE id = v_current_version_id;
  END IF;
  
  RETURN v_new_version;
END;
$$;

-- ============================================
-- FUNCTION: Check for policy conflicts
-- ============================================
CREATE OR REPLACE FUNCTION public.check_policy_conflicts(
  p_worker_id UUID,
  p_work_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_category_id UUID;
  v_policies_count INTEGER;
  v_conflicts JSONB := '[]'::jsonb;
  v_policy_ids UUID[];
BEGIN
  -- Get worker's category
  SELECT category_id INTO v_category_id
  FROM workers WHERE id = p_worker_id;
  
  IF v_category_id IS NULL THEN
    RETURN jsonb_build_object('has_conflict', false, 'conflicts', v_conflicts);
  END IF;
  
  -- Count overlapping active policies
  SELECT 
    COUNT(*),
    array_agg(pv.id)
  INTO v_policies_count, v_policy_ids
  FROM time_policies tp
  JOIN policy_versions pv ON pv.policy_id = tp.id
  WHERE tp.applies_to_category_id = v_category_id
    AND tp.is_active = true
    AND pv.status = 'ACTIVE'
    AND pv.valid_from <= p_work_date
    AND (pv.valid_to IS NULL OR pv.valid_to >= p_work_date);
  
  -- Check for conflict (more than one active policy)
  IF v_policies_count > 1 THEN
    v_conflicts := jsonb_build_array(
      jsonb_build_object(
        'type', 'POLICY_OVERLAP',
        'description', format('Multiple active policies (%s) for same category on %s', v_policies_count, p_work_date),
        'policy_version_ids', to_jsonb(v_policy_ids)
      )
    );
    
    RETURN jsonb_build_object(
      'has_conflict', true,
      'conflicts', v_conflicts
    );
  END IF;
  
  RETURN jsonb_build_object('has_conflict', false, 'conflicts', v_conflicts);
END;
$$;