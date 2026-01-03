
-- 1. Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 2. Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- 3. Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 5. RLS policy for user_roles: only admins can view roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 6. Drop existing permissive INSERT/UPDATE policies on categories
DROP POLICY IF EXISTS "Allow insert on categories" ON public.categories;
DROP POLICY IF EXISTS "Allow update on categories" ON public.categories;

-- 7. Create new admin-only policies for categories
CREATE POLICY "Admins can insert categories"
ON public.categories
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update categories"
ON public.categories
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 8. Drop existing permissive INSERT/UPDATE policies on workers
DROP POLICY IF EXISTS "Allow insert on workers" ON public.workers;
DROP POLICY IF EXISTS "Allow update on workers" ON public.workers;

-- 9. Create new admin-only policies for workers
CREATE POLICY "Admins can insert workers"
ON public.workers
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update workers"
ON public.workers
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 10. Update storage policies for worker-photos bucket
-- First drop existing policies if any
DROP POLICY IF EXISTS "Public read access for worker photos" ON storage.objects;
DROP POLICY IF EXISTS "Admin upload access for worker photos" ON storage.objects;
DROP POLICY IF EXISTS "Admin update access for worker photos" ON storage.objects;

-- Public read access
CREATE POLICY "Public read access for worker photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'worker-photos');

-- Admin only insert
CREATE POLICY "Admin upload access for worker photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'worker-photos' AND public.has_role(auth.uid(), 'admin'));

-- Admin only update
CREATE POLICY "Admin update access for worker photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'worker-photos' AND public.has_role(auth.uid(), 'admin'));

-- Admin only delete
CREATE POLICY "Admin delete access for worker photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'worker-photos' AND public.has_role(auth.uid(), 'admin'));
