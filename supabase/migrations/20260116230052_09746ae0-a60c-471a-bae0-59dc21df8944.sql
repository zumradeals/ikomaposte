-- Fix security warnings: set search_path on functions

-- Fix count_working_days
CREATE OR REPLACE FUNCTION public.count_working_days(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE PARALLEL SAFE
SET search_path TO 'public'
AS $$
DECLARE
  v_count INTEGER := 0;
  v_current DATE := p_start_date;
BEGIN
  WHILE v_current <= p_end_date LOOP
    IF EXTRACT(DOW FROM v_current) NOT IN (0, 6) THEN
      v_count := v_count + 1;
    END IF;
    v_current := v_current + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- Fix get_team_shift
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
SET search_path TO 'public'
AS $$
DECLARE
  v_config rotation_config;
  v_day_of_week INTEGER;
  v_working_days INTEGER;
  v_cycle_length INTEGER;
  v_cycle_day INTEGER;
  v_block_number INTEGER;
  v_shift_code VARCHAR;
BEGIN
  v_day_of_week := EXTRACT(DOW FROM p_production_date)::INTEGER;
  IF v_day_of_week IN (0, 6) THEN
    RETURN;
  END IF;
  
  SELECT * INTO v_config
  FROM rotation_config
  WHERE is_active = true
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active rotation configuration found';
  END IF;
  
  v_working_days := public.count_working_days(v_config.cycle_start_date, p_production_date);
  v_cycle_length := v_config.days_per_block * v_config.blocks_per_cycle;
  v_cycle_day := ((v_working_days - 1) % v_cycle_length) + 1;
  v_block_number := ((v_cycle_day - 1) / v_config.days_per_block) + 1;
  
  SELECT elem->'assignments'->>p_team_code INTO v_shift_code
  FROM jsonb_array_elements(v_config.block_assignments) elem
  WHERE (elem->>'block')::INTEGER = v_block_number;
  
  IF v_shift_code IS NULL THEN
    RAISE EXCEPTION 'No assignment found for team % in block %', p_team_code, v_block_number;
  END IF;
  
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

-- Fix get_rotation_schedule
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
SET search_path TO 'public'
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