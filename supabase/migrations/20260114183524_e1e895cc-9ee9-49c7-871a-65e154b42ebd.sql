-- Add HR override columns to work_summaries
ALTER TABLE public.work_summaries 
ADD COLUMN IF NOT EXISTS hr_override_checkin TIME WITHOUT TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS hr_override_checkout TIME WITHOUT TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS hr_override_reason TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS late_minutes INTEGER DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.work_summaries.hr_override_checkin IS 'HR-corrected check-in time (nullable)';
COMMENT ON COLUMN public.work_summaries.hr_override_checkout IS 'HR-corrected check-out time (nullable)';
COMMENT ON COLUMN public.work_summaries.hr_override_reason IS 'Justification for HR override';
COMMENT ON COLUMN public.work_summaries.late_minutes IS 'Minutes late based on schedule tolerance';