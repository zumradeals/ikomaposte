-- Migration: 00006_storage.sql
-- Description: Creates storage buckets and their access policies
-- Author: IKOMA Generator
-- Date: 2025-01-10
-- IKOMA Supabase Bundle Standard v1.0

-- ============================================
-- BUCKET: worker-photos
-- Public bucket for worker profile photos
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'worker-photos',
  'worker-photos',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Public read access for worker photos
DROP POLICY IF EXISTS "Worker photos are publicly accessible" ON storage.objects;
CREATE POLICY "Worker photos are publicly accessible"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'worker-photos');

-- Admins can upload worker photos
CREATE POLICY "Admins can upload worker photos"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'worker-photos'
    AND public.has_role(auth.uid(), 'admin')
  );

-- Admins can update worker photos
CREATE POLICY "Admins can update worker photos"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'worker-photos'
    AND public.has_role(auth.uid(), 'admin')
  );

-- Admins can delete worker photos
CREATE POLICY "Admins can delete worker photos"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'worker-photos'
    AND public.has_role(auth.uid(), 'admin')
  );

-- =============================================
-- BUCKET: work-snapshots
-- Private bucket for kiosk capture snapshots
-- =============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'work-snapshots',
  'work-snapshots',
  false,
  2097152, -- 2MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Admins can view work snapshots
CREATE POLICY "Admins can view work snapshots"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'work-snapshots'
    AND public.has_role(auth.uid(), 'admin')
  );

-- Kiosk can upload work snapshots (anonymous insert allowed)
CREATE POLICY "Kiosk can upload work snapshots"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'work-snapshots');

-- Admins can delete work snapshots
CREATE POLICY "Admins can delete work snapshots"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'work-snapshots'
    AND public.has_role(auth.uid(), 'admin')
  );
