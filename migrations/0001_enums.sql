-- =============================================
-- IKOMA POSTE - Migration 0001: Enums
-- =============================================
-- Creates all custom enum types used by the application

-- Enum for user roles (admin permissions)
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Enum for work event types (clock in/out, pause)
CREATE TYPE public.work_event_type AS ENUM ('clock_in', 'clock_out', 'pause_start', 'pause_end');

-- Enum for anomaly types detected in work sessions
CREATE TYPE public.anomaly_type AS ENUM (
  'missing_clock_out',
  'missing_clock_in', 
  'orphan_pause',
  'overlapping_session',
  'excessive_duration',
  'manual_correction'
);

-- Enum for correction actions applied by admins
CREATE TYPE public.correction_action AS ENUM (
  'add_event',
  'remove_event',
  'modify_event',
  'close_session',
  'invalidate_day'
);
