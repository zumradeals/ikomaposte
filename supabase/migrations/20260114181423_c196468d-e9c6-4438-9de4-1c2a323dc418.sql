-- Fix: actor_user_id must be NOT NULL with server-side enforcement
-- ============================================

-- 1. Set existing null values to a placeholder (for migration safety)
-- Then enforce NOT NULL with default from auth.uid()
ALTER TABLE public.admin_audit
ALTER COLUMN actor_user_id SET DEFAULT auth.uid();

-- 2. Make NOT NULL (new rows must have actor)
-- Note: Existing rows may have null, so we update them first
UPDATE public.admin_audit 
SET actor_user_id = '00000000-0000-0000-0000-000000000000'::uuid 
WHERE actor_user_id IS NULL;

ALTER TABLE public.admin_audit
ALTER COLUMN actor_user_id SET NOT NULL;