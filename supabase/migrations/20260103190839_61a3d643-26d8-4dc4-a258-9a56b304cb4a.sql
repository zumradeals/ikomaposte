-- Phase 4: Work Summaries table for derived calculations
CREATE TABLE public.work_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES public.workers(id),
  work_date date NOT NULL,
  total_work_minutes integer NOT NULL DEFAULT 0,
  total_pause_minutes integer NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  devise text NOT NULL DEFAULT 'XOF',
  taux_horaire_applied numeric NOT NULL DEFAULT 0,
  auto_closed boolean NOT NULL DEFAULT false,
  auto_close_time time NULL,
  calculation_version text NOT NULL DEFAULT 'v1',
  calculated_at timestamptz NOT NULL DEFAULT now(),
  events_used uuid[] NOT NULL DEFAULT '{}',
  segments_json jsonb NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_worker_date UNIQUE (worker_id, work_date)
);

-- Enable RLS
ALTER TABLE public.work_summaries ENABLE ROW LEVEL SECURITY;

-- RLS policies: only admins can read/write summaries
CREATE POLICY "Admins can view work summaries"
ON public.work_summaries
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert work summaries"
ON public.work_summaries
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update work summaries"
ON public.work_summaries
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete work summaries"
ON public.work_summaries
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_work_summaries_updated_at
  BEFORE UPDATE ON public.work_summaries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance
CREATE INDEX idx_work_summaries_worker_id ON public.work_summaries(worker_id);
CREATE INDEX idx_work_summaries_work_date ON public.work_summaries(work_date);
CREATE INDEX idx_work_summaries_worker_date ON public.work_summaries(worker_id, work_date);