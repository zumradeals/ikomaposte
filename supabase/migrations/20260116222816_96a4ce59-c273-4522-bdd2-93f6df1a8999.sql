-- ============================================
-- Production Day (Jour de Production) Migration
-- A production day runs from 07:00 to 07:00 next day
-- ============================================

-- Add production_date column to work_events table
-- This stores the production day the punch belongs to
ALTER TABLE public.work_events 
ADD COLUMN IF NOT EXISTS production_date DATE GENERATED ALWAYS AS (
  CASE 
    WHEN EXTRACT(HOUR FROM occurred_at AT TIME ZONE 'Africa/Abidjan') < 7 
    THEN (occurred_at AT TIME ZONE 'Africa/Abidjan')::DATE - INTERVAL '1 day'
    ELSE (occurred_at AT TIME ZONE 'Africa/Abidjan')::DATE
  END::DATE
) STORED;

-- Add production_date column to work_summaries table
-- This replaces work_date for business calculations
ALTER TABLE public.work_summaries 
ADD COLUMN IF NOT EXISTS production_date DATE;

-- Backfill existing summaries with production_date = work_date
-- (For existing data, assume work_date was already correct)
UPDATE public.work_summaries 
SET production_date = work_date::DATE 
WHERE production_date IS NULL;

-- Create index for efficient querying by production_date
CREATE INDEX IF NOT EXISTS idx_work_events_production_date 
ON public.work_events(production_date);

CREATE INDEX IF NOT EXISTS idx_work_summaries_production_date 
ON public.work_summaries(production_date);

-- Create composite index for worker + production_date queries
CREATE INDEX IF NOT EXISTS idx_work_events_worker_production_date 
ON public.work_events(worker_id, production_date);

CREATE INDEX IF NOT EXISTS idx_work_summaries_worker_production_date 
ON public.work_summaries(worker_id, production_date);

-- ============================================
-- SQL Function: Calculate production date from timestamp
-- ============================================
CREATE OR REPLACE FUNCTION public.get_production_date(
  p_timestamp TIMESTAMP WITH TIME ZONE,
  p_timezone TEXT DEFAULT 'Africa/Abidjan'
)
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  v_local_time TIMESTAMP;
  v_hour INTEGER;
BEGIN
  -- Convert to local timezone
  v_local_time := p_timestamp AT TIME ZONE p_timezone;
  v_hour := EXTRACT(HOUR FROM v_local_time);
  
  -- Production day boundary is at 07:00
  -- Events before 07:00 belong to previous production day
  IF v_hour < 7 THEN
    RETURN (v_local_time::DATE - INTERVAL '1 day')::DATE;
  ELSE
    RETURN v_local_time::DATE;
  END IF;
END;
$$;

-- ============================================
-- SQL Function: Get production day boundaries
-- Returns start and end timestamps for a given production date
-- ============================================
CREATE OR REPLACE FUNCTION public.get_production_day_boundaries(
  p_production_date DATE,
  p_timezone TEXT DEFAULT 'Africa/Abidjan'
)
RETURNS TABLE(
  production_start TIMESTAMP WITH TIME ZONE,
  production_end TIMESTAMP WITH TIME ZONE,
  civil_date_start DATE,
  civil_date_end DATE
)
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
BEGIN
  RETURN QUERY SELECT
    -- Production day starts at 07:00 on the given date
    (p_production_date || ' 07:00:00')::TIMESTAMP AT TIME ZONE p_timezone AS production_start,
    -- Production day ends at 07:00 on the next day
    ((p_production_date + INTERVAL '1 day') || ' 07:00:00')::TIMESTAMP AT TIME ZONE p_timezone AS production_end,
    -- Civil dates covered
    p_production_date AS civil_date_start,
    (p_production_date + INTERVAL '1 day')::DATE AS civil_date_end;
END;
$$;

-- ============================================
-- SQL Function: Get events for a production day
-- ============================================
CREATE OR REPLACE FUNCTION public.get_events_for_production_day(
  p_worker_id UUID,
  p_production_date DATE,
  p_timezone TEXT DEFAULT 'Africa/Abidjan'
)
RETURNS SETOF public.work_events
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_boundaries RECORD;
BEGIN
  -- Get the production day boundaries
  SELECT * INTO v_boundaries 
  FROM public.get_production_day_boundaries(p_production_date, p_timezone);
  
  -- Return all events within the production day window
  RETURN QUERY
  SELECT we.*
  FROM public.work_events we
  WHERE we.worker_id = p_worker_id
    AND we.occurred_at >= v_boundaries.production_start
    AND we.occurred_at < v_boundaries.production_end
  ORDER BY we.occurred_at ASC;
END;
$$;

-- ============================================
-- Add comment explaining the production day concept
-- ============================================
COMMENT ON COLUMN public.work_events.production_date IS 
  'Production day (07:00 to 07:00 next day). Events before 07:00 belong to previous production day.';

COMMENT ON COLUMN public.work_summaries.production_date IS 
  'Production day for this summary. Used for all attendance and payroll calculations.';

COMMENT ON FUNCTION public.get_production_date IS 
  'Calculates the production date from a timestamp. Production day runs from 07:00 to 07:00.';

COMMENT ON FUNCTION public.get_production_day_boundaries IS 
  'Returns the start and end timestamps for a production day (07:00 to 07:00 next day).';

COMMENT ON FUNCTION public.get_events_for_production_day IS 
  'Returns all work events for a worker within a specific production day window.';