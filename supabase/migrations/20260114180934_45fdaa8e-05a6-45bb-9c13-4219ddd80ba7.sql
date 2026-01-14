-- Migration: Add actor_user_id to admin_audit and create missing RLS policies
-- ============================================

-- 1. Add actor_user_id column to admin_audit for proper user identification
ALTER TABLE public.admin_audit
ADD COLUMN IF NOT EXISTS actor_user_id UUID REFERENCES auth.users(id);

-- 2. Create unique constraint for work_schedules upsert (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'work_schedules_category_day_unique'
  ) THEN
    ALTER TABLE public.work_schedules
    ADD CONSTRAINT work_schedules_category_day_unique 
    UNIQUE (category_id, day_of_week);
  END IF;
END $$;

-- 3. RLS for work_schedules: Ensure admin-only INSERT/UPDATE/DELETE
-- Public SELECT is already in place

DROP POLICY IF EXISTS "Admins can insert work schedules" ON public.work_schedules;
CREATE POLICY "Admins can insert work schedules"
  ON public.work_schedules
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update work schedules" ON public.work_schedules;
CREATE POLICY "Admins can update work schedules"
  ON public.work_schedules
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete work schedules" ON public.work_schedules;
CREATE POLICY "Admins can delete work schedules"
  ON public.work_schedules
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. RLS for admin_audit: Admin-only access
-- Enable RLS (if not already)
ALTER TABLE public.admin_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.admin_audit;
CREATE POLICY "Admins can insert audit logs"
  ON public.admin_audit
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Update existing view policy to be PERMISSIVE (not RESTRICTIVE)
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.admin_audit;
CREATE POLICY "Admins can view audit logs"
  ON public.admin_audit
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));