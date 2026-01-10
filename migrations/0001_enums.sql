-- Migration: 00001_enums.sql
-- Description: Creates all custom enum types used by the application
-- Author: IKOMA Generator
-- Date: 2025-01-10
-- IKOMA Supabase Bundle Standard v1.0

-- ============================================
-- EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUMS
-- ============================================

-- Enum for user roles (admin permissions)
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Enum for work event types (clock in/out, pause)
DO $$ BEGIN
  CREATE TYPE public.work_event_type AS ENUM ('TAKE', 'PAUSE', 'RESUME', 'END');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Enum for anomaly types detected in work sessions
DO $$ BEGIN
  CREATE TYPE public.anomaly_type AS ENUM (
    'missing_end',
    'missing_take', 
    'duplicate_take',
    'duplicate_end',
    'orphan_pause',
    'orphan_resume',
    'invalid_sequence',
    'time_overlap',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Enum for correction actions applied by admins
DO $$ BEGIN
  CREATE TYPE public.correction_action AS ENUM (
    'add_virtual_event',
    'ignore_event',
    'adjust_time',
    'mark_absent',
    'mark_complete',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
