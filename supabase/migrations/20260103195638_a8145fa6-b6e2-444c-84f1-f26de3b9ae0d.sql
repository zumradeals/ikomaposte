-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;

-- Allow authenticated users to read their own roles
CREATE POLICY "Users can read own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);