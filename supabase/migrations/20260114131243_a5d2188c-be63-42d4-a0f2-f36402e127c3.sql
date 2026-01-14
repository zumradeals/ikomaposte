-- Migration: Add versioning and locking to work_summaries
-- Build #1: Corrections appliquées + anti-écrasement silencieux

-- Add versioning columns
ALTER TABLE public.work_summaries 
ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_current BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS supersedes_id UUID REFERENCES public.work_summaries(id);

-- Add locking columns
ALTER TABLE public.work_summaries 
ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS locked_by UUID,
ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITH TIME ZONE;

-- Create index for efficient current summary lookup
CREATE INDEX IF NOT EXISTS idx_work_summaries_current 
ON public.work_summaries(worker_id, work_date, is_current) 
WHERE is_current = true;

-- Create index for supersedes chain navigation
CREATE INDEX IF NOT EXISTS idx_work_summaries_supersedes 
ON public.work_summaries(supersedes_id) 
WHERE supersedes_id IS NOT NULL;

-- Create index for locked summaries
CREATE INDEX IF NOT EXISTS idx_work_summaries_locked 
ON public.work_summaries(locked) 
WHERE locked = true;

-- Drop the unique constraint on worker_id + work_date (now we can have multiple revisions)
DROP INDEX IF EXISTS idx_work_summaries_worker_date;

-- Create a partial unique index: only one current summary per worker/date
CREATE UNIQUE INDEX idx_work_summaries_worker_date_current 
ON public.work_summaries(worker_id, work_date) 
WHERE is_current = true;