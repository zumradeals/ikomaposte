-- ============================================
-- TEAM ROTATION ENGINE (Independent from Policies)
-- ============================================

-- Teams table
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(10) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  color VARCHAR(7) DEFAULT '#3B82F6',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fixed shifts table
CREATE TABLE IF NOT EXISTS public.fixed_shifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(10) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_cross_day BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rotation configuration
CREATE TABLE IF NOT EXISTS public.rotation_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  cycle_start_date DATE NOT NULL,
  days_per_block INTEGER NOT NULL DEFAULT 2,
  blocks_per_cycle INTEGER NOT NULL DEFAULT 3,
  -- Block assignments as JSON: [{"block": 1, "assignments": {"A": "M", "B": "S", "C": "N"}}, ...]
  block_assignments JSONB NOT NULL,
  -- Weekend freeze config
  weekend_freeze_enabled BOOLEAN DEFAULT true,
  weekend_start_day INTEGER DEFAULT 6, -- Saturday (0=Sunday, 6=Saturday)
  weekend_end_day INTEGER DEFAULT 0,   -- Sunday
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Link workers to teams (optional, allows individual team assignment)
ALTER TABLE public.workers 
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id);

-- Create index for team lookups
CREATE INDEX IF NOT EXISTS idx_workers_team_id ON public.workers(team_id);

-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rotation_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies (read-only for all, write for admins)
CREATE POLICY "Teams are viewable by everyone" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Admins can manage teams" ON public.teams FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Fixed shifts are viewable by everyone" ON public.fixed_shifts FOR SELECT USING (true);
CREATE POLICY "Admins can manage fixed shifts" ON public.fixed_shifts FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Rotation config is viewable by everyone" ON public.rotation_config FOR SELECT USING (true);
CREATE POLICY "Admins can manage rotation config" ON public.rotation_config FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Insert default teams
INSERT INTO public.teams (code, name, color) VALUES
  ('A', 'Équipe A', '#3B82F6'),
  ('B', 'Équipe B', '#10B981'),
  ('C', 'Équipe C', '#F59E0B')
ON CONFLICT (code) DO NOTHING;

-- Insert fixed shifts
INSERT INTO public.fixed_shifts (code, name, start_time, end_time, is_cross_day) VALUES
  ('M', 'Matin', '07:00:00', '15:00:00', false),
  ('S', 'Soir', '15:00:00', '23:00:00', false),
  ('N', 'Nuit', '23:00:00', '07:00:00', true)
ON CONFLICT (code) DO NOTHING;

-- Insert default rotation config
INSERT INTO public.rotation_config (
  name, 
  cycle_start_date, 
  days_per_block, 
  blocks_per_cycle,
  block_assignments,
  weekend_freeze_enabled
) VALUES (
  'Rotation 3x8 Standard',
  '2025-01-06', -- Monday as cycle start
  2,
  3,
  '[
    {"block": 1, "assignments": {"A": "M", "B": "S", "C": "N"}},
    {"block": 2, "assignments": {"A": "N", "B": "M", "C": "S"}},
    {"block": 3, "assignments": {"A": "S", "B": "N", "C": "M"}}
  ]'::jsonb,
  true
);

-- Triggers for updated_at
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rotation_config_updated_at
  BEFORE UPDATE ON public.rotation_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to calculate working days between dates (excluding weekends)
CREATE OR REPLACE FUNCTION public.count_working_days(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE PARALLEL SAFE
AS $$
DECLARE
  v_count INTEGER := 0;
  v_current DATE := p_start_date;
BEGIN
  WHILE v_current <= p_end_date LOOP
    -- Skip Saturday (6) and Sunday (0)
    IF EXTRACT(DOW FROM v_current) NOT IN (0, 6) THEN
      v_count := v_count + 1;
    END IF;
    v_current := v_current + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- Function to get team shift for a production date
CREATE OR REPLACE FUNCTION public.get_team_shift(
  p_team_code VARCHAR,
  p_production_date DATE
)
RETURNS TABLE(
  shift_code VARCHAR,
  shift_name TEXT,
  start_time TIME,
  end_time TIME,
  is_cross_day BOOLEAN,
  block_number INTEGER,
  cycle_day INTEGER
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_config rotation_config;
  v_day_of_week INTEGER;
  v_working_days INTEGER;
  v_cycle_length INTEGER;
  v_cycle_day INTEGER;
  v_block_number INTEGER;
  v_shift_code VARCHAR;
  v_block_assignments JSONB;
BEGIN
  -- Check if it's a weekend
  v_day_of_week := EXTRACT(DOW FROM p_production_date)::INTEGER;
  IF v_day_of_week IN (0, 6) THEN
    -- Weekend - no shift
    RETURN;
  END IF;
  
  -- Get active rotation config
  SELECT * INTO v_config
  FROM rotation_config
  WHERE is_active = true
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active rotation configuration found';
  END IF;
  
  -- Calculate working days since cycle start
  v_working_days := public.count_working_days(v_config.cycle_start_date, p_production_date);
  
  -- Calculate cycle length in working days
  v_cycle_length := v_config.days_per_block * v_config.blocks_per_cycle;
  
  -- Calculate position within current cycle (1-indexed)
  v_cycle_day := ((v_working_days - 1) % v_cycle_length) + 1;
  
  -- Calculate which block we're in (1-indexed)
  v_block_number := ((v_cycle_day - 1) / v_config.days_per_block) + 1;
  
  -- Get block assignments
  SELECT elem->'assignments'->>p_team_code INTO v_shift_code
  FROM jsonb_array_elements(v_config.block_assignments) elem
  WHERE (elem->>'block')::INTEGER = v_block_number;
  
  IF v_shift_code IS NULL THEN
    RAISE EXCEPTION 'No assignment found for team % in block %', p_team_code, v_block_number;
  END IF;
  
  -- Return shift details
  RETURN QUERY
  SELECT 
    fs.code AS shift_code,
    fs.name AS shift_name,
    fs.start_time,
    fs.end_time,
    fs.is_cross_day,
    v_block_number AS block_number,
    v_cycle_day AS cycle_day
  FROM fixed_shifts fs
  WHERE fs.code = v_shift_code;
END;
$$;

-- Function to get all team assignments for a production date
CREATE OR REPLACE FUNCTION public.get_rotation_schedule(
  p_production_date DATE
)
RETURNS TABLE(
  team_code VARCHAR,
  team_name TEXT,
  shift_code VARCHAR,
  shift_name TEXT,
  start_time TIME,
  end_time TIME,
  is_cross_day BOOLEAN,
  block_number INTEGER,
  cycle_day INTEGER
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_team RECORD;
BEGIN
  FOR v_team IN SELECT code, name FROM teams WHERE is_active = true LOOP
    RETURN QUERY
    SELECT 
      v_team.code AS team_code,
      v_team.name AS team_name,
      ts.shift_code,
      ts.shift_name,
      ts.start_time,
      ts.end_time,
      ts.is_cross_day,
      ts.block_number,
      ts.cycle_day
    FROM public.get_team_shift(v_team.code, p_production_date) ts;
  END LOOP;
END;
$$;