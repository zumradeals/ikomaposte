-- =============================================
-- IKOMA POSTE - Migration 0004: Triggers
-- =============================================
-- Creates all database triggers

-- ---------------------------------------------
-- Trigger: update_categories_updated_at
-- Auto-update updated_at on categories table
-- ---------------------------------------------
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------
-- Trigger: update_workers_updated_at
-- Auto-update updated_at on workers table
-- ---------------------------------------------
CREATE TRIGGER update_workers_updated_at
  BEFORE UPDATE ON public.workers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------
-- Trigger: update_devices_updated_at
-- Auto-update updated_at on devices table
-- ---------------------------------------------
CREATE TRIGGER update_devices_updated_at
  BEFORE UPDATE ON public.devices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------
-- Trigger: update_work_summaries_updated_at
-- Auto-update updated_at on work_summaries table
-- ---------------------------------------------
CREATE TRIGGER update_work_summaries_updated_at
  BEFORE UPDATE ON public.work_summaries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
