-- =============================================
-- IKOMA POSTE - Migration 0005: Row Level Security
-- =============================================
-- Enables RLS and creates all security policies

-- =============================================
-- ENABLE RLS ON ALL TABLES
-- =============================================

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.correction_events ENABLE ROW LEVEL SECURITY;

-- =============================================
-- POLICIES: categories
-- Public read, admin write
-- =============================================

CREATE POLICY "Categories are publicly readable"
  ON public.categories
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert categories"
  ON public.categories
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update categories"
  ON public.categories
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- POLICIES: user_roles
-- Users can only read their own roles
-- =============================================

CREATE POLICY "Users can read own roles"
  ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

-- =============================================
-- POLICIES: workers
-- Public read, admin write
-- =============================================

CREATE POLICY "Workers are publicly readable"
  ON public.workers
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert workers"
  ON public.workers
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update workers"
  ON public.workers
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- POLICIES: devices
-- Public read for trust verification, admin write
-- =============================================

CREATE POLICY "Allow anonymous device trust check"
  ON public.devices
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert devices"
  ON public.devices
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update devices"
  ON public.devices
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- POLICIES: work_events
-- Public read, kiosk can insert (anonymous)
-- =============================================

CREATE POLICY "Work events are publicly readable"
  ON public.work_events
  FOR SELECT
  USING (true);

CREATE POLICY "Kiosk can insert work events"
  ON public.work_events
  FOR INSERT
  WITH CHECK (true);

-- =============================================
-- POLICIES: work_summaries
-- Admin only (full CRUD)
-- =============================================

CREATE POLICY "Admins can view work summaries"
  ON public.work_summaries
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert work summaries"
  ON public.work_summaries
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update work summaries"
  ON public.work_summaries
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete work summaries"
  ON public.work_summaries
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- POLICIES: correction_events
-- Admin only (read + insert)
-- =============================================

CREATE POLICY "Admins can view corrections"
  ON public.correction_events
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert corrections"
  ON public.correction_events
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
