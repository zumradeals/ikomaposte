-- Phase 3: Work Events (append-only pointage system)

-- Create event type enum
CREATE TYPE public.work_event_type AS ENUM ('TAKE', 'PAUSE', 'RESUME', 'END');

-- Create work_events table (append-only, no updates/deletes allowed)
CREATE TABLE public.work_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE RESTRICT,
  event_type work_event_type NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  device_id TEXT NOT NULL,
  snapshot_url TEXT,
  snapshot_hash TEXT,
  incident_flag TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.work_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies: SELECT public (for kiosk), INSERT for anon (kiosk) and admin
CREATE POLICY "Work events are publicly readable"
ON public.work_events
FOR SELECT
USING (true);

-- Allow anonymous insert for kiosk mode (append-only)
CREATE POLICY "Kiosk can insert work events"
ON public.work_events
FOR INSERT
WITH CHECK (true);

-- NO UPDATE policy - events are immutable
-- NO DELETE policy - events cannot be deleted

-- Create index for efficient queries
CREATE INDEX idx_work_events_worker_id ON public.work_events(worker_id);
CREATE INDEX idx_work_events_occurred_at ON public.work_events(occurred_at DESC);
CREATE INDEX idx_work_events_device_id ON public.work_events(device_id);

-- Enable realtime for work_events
ALTER PUBLICATION supabase_realtime ADD TABLE public.work_events;

-- Create work-snapshots storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('work-snapshots', 'work-snapshots', false);

-- Storage RLS policies
-- Admin can read all snapshots
CREATE POLICY "Admins can view snapshots"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'work-snapshots' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Allow anonymous upload for kiosk (insert only)
CREATE POLICY "Kiosk can upload snapshots"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'work-snapshots');