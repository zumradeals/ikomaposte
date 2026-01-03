-- Create enum for anomaly types
CREATE TYPE public.anomaly_type AS ENUM (
  'missing_end',
  'missing_take',
  'duplicate_take',
  'duplicate_end',
  'orphan_pause',
  'orphan_resume',
  'invalid_sequence',
  'time_overlap',
  'other'
);

-- Create enum for correction actions
CREATE TYPE public.correction_action AS ENUM (
  'add_virtual_event',
  'ignore_event',
  'adjust_time',
  'mark_absent',
  'mark_complete',
  'other'
);

-- Create correction_events table
CREATE TABLE public.correction_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID NOT NULL REFERENCES public.workers(id),
  work_date DATE NOT NULL,
  anomaly_type anomaly_type NOT NULL,
  correction_action correction_action NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  justification TEXT NOT NULL CHECK (char_length(trim(justification)) > 0),
  admin_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient lookups
CREATE INDEX idx_correction_events_worker_date ON public.correction_events(worker_id, work_date);
CREATE INDEX idx_correction_events_date ON public.correction_events(work_date);

-- Enable RLS
ALTER TABLE public.correction_events ENABLE ROW LEVEL SECURITY;

-- Admins can view all corrections
CREATE POLICY "Admins can view corrections"
ON public.correction_events
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert corrections
CREATE POLICY "Admins can insert corrections"
ON public.correction_events
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- No UPDATE or DELETE allowed - corrections are append-only audit trail
COMMENT ON TABLE public.correction_events IS 'Append-only audit trail for work event corrections. Never delete or update records.';