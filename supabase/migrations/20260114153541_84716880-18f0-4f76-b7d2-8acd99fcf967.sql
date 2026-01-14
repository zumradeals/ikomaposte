-- ============================================
-- PHASE 7: Règles Métier IKOMA - Build #1
-- Migration: Enums, horaires théoriques, statuts jour
-- ============================================

-- 1. Nouveaux enums pour statuts métier (liste fermée)
DO $$ BEGIN
  CREATE TYPE public.day_status AS ENUM ('PRESENT', 'RETARD', 'ABSENT', 'ANOMALIE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.anomaly_code AS ENUM (
    'NO_CHECKIN',
    'NO_CHECKOUT', 
    'DUPLICATE_CHECKIN',
    'DUPLICATE_CHECKOUT',
    'INVALID_SEQUENCE',
    'TIME_OVERLAP',
    'FUTURE_EVENT',
    'IMPOSSIBLE_DURATION'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.validation_status AS ENUM ('DRAFT', 'VALIDATED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Table des horaires théoriques par catégorie/jour
CREATE TABLE IF NOT EXISTS public.work_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=dimanche
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  tolerance_late_minutes INTEGER NOT NULL DEFAULT 15,
  tolerance_early_leave_minutes INTEGER NOT NULL DEFAULT 15,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(category_id, day_of_week)
);

-- 3. Extension work_summaries pour validation RH et statuts métier
ALTER TABLE public.work_summaries 
  ADD COLUMN IF NOT EXISTS day_status public.day_status,
  ADD COLUMN IF NOT EXISTS anomaly_code public.anomaly_code,
  ADD COLUMN IF NOT EXISTS validation_status public.validation_status NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS validated_by UUID,
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ;

-- 4. Index pour performances requêtes validation
CREATE INDEX IF NOT EXISTS idx_work_summaries_validation 
  ON public.work_summaries(validation_status, work_date);

CREATE INDEX IF NOT EXISTS idx_work_summaries_day_status 
  ON public.work_summaries(day_status, work_date);

CREATE INDEX IF NOT EXISTS idx_work_schedules_category_day 
  ON public.work_schedules(category_id, day_of_week);

-- 5. RLS pour work_schedules
ALTER TABLE public.work_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Work schedules are publicly readable"
  ON public.work_schedules FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage work schedules"
  ON public.work_schedules FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 6. Trigger updated_at pour work_schedules
CREATE TRIGGER update_work_schedules_updated_at
  BEFORE UPDATE ON public.work_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Fonction de validation RH (verrouille le summary)
CREATE OR REPLACE FUNCTION public.validate_work_summary(
  p_summary_id UUID,
  p_validator_id UUID
)
RETURNS work_summaries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_summary work_summaries;
BEGIN
  -- Lock and update
  UPDATE work_summaries
  SET 
    validation_status = 'VALIDATED',
    validated_by = p_validator_id,
    validated_at = now(),
    locked = true,
    locked_by = p_validator_id,
    locked_at = now(),
    updated_at = now()
  WHERE id = p_summary_id
    AND validation_status = 'DRAFT'
    AND is_current = true
  RETURNING * INTO v_summary;
  
  IF v_summary IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_FAILED: Summary not found, already validated, or not current';
  END IF;
  
  RETURN v_summary;
END;
$$;