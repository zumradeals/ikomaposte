-- =============================================
-- IKOMA POSTE - Migration 0003: Functions
-- =============================================
-- Creates all database functions

-- ---------------------------------------------
-- Function: update_updated_at_column
-- Auto-updates the updated_at timestamp on row modification
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------
-- Function: has_role
-- Security definer function to check user roles
-- Avoids RLS recursion issues when checking permissions
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;
