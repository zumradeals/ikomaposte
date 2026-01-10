-- Migration: 00004_triggers.sql
-- Description: Creates all database triggers
-- Author: IKOMA Generator
-- Date: 2025-01-10
-- IKOMA Supabase Bundle Standard v1.0

-- ============================================
-- TRIGGER: update_categories_updated_at
-- ============================================
DROP TRIGGER IF EXISTS update_categories_updated_at ON public.categories;
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- TRIGGER: update_workers_updated_at
-- ============================================
DROP TRIGGER IF EXISTS update_workers_updated_at ON public.workers;
CREATE TRIGGER update_workers_updated_at
  BEFORE UPDATE ON public.workers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- TRIGGER: update_devices_updated_at
-- ============================================
DROP TRIGGER IF EXISTS update_devices_updated_at ON public.devices;
CREATE TRIGGER update_devices_updated_at
  BEFORE UPDATE ON public.devices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- TRIGGER: update_work_summaries_updated_at
-- ============================================
DROP TRIGGER IF EXISTS update_work_summaries_updated_at ON public.work_summaries;
CREATE TRIGGER update_work_summaries_updated_at
  BEFORE UPDATE ON public.work_summaries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
