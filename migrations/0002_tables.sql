-- =============================================
-- IKOMA POSTE - Migration 0002: Tables
-- =============================================
-- Creates all application tables with constraints and indexes

-- ---------------------------------------------
-- Table: categories
-- Worker categories with hourly rates
-- ---------------------------------------------
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL,
  devise TEXT NOT NULL DEFAULT 'XOF',
  taux_horaire NUMERIC NOT NULL,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for active categories lookup
CREATE INDEX idx_categories_actif ON public.categories(actif);

-- ---------------------------------------------
-- Table: user_roles
-- Role assignments for authenticated users
-- ---------------------------------------------
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Index for user role lookups
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);

-- ---------------------------------------------
-- Table: workers
-- Employee records with QR tokens
-- ---------------------------------------------
CREATE TABLE public.workers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  matricule TEXT NOT NULL,
  nom_affiche TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES public.categories(id),
  qr_token TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
  photo_url TEXT,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for worker lookups
CREATE UNIQUE INDEX idx_workers_matricule ON public.workers(matricule);
CREATE UNIQUE INDEX idx_workers_qr_token ON public.workers(qr_token);
CREATE INDEX idx_workers_category_id ON public.workers(category_id);
CREATE INDEX idx_workers_actif ON public.workers(actif);

-- ---------------------------------------------
-- Table: devices
-- Trusted kiosk devices for scanning
-- ---------------------------------------------
CREATE TABLE public.devices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  device_secret TEXT NOT NULL,
  label TEXT,
  site_id TEXT,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for device lookups
CREATE UNIQUE INDEX idx_devices_device_id ON public.devices(device_id);
CREATE INDEX idx_devices_actif ON public.devices(actif);

-- ---------------------------------------------
-- Table: work_events
-- Clock in/out and pause events from kiosks
-- ---------------------------------------------
CREATE TABLE public.work_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID NOT NULL REFERENCES public.workers(id),
  event_type public.work_event_type NOT NULL,
  device_id TEXT NOT NULL,
  device_secret TEXT,
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  client_occurred_at TIMESTAMP WITH TIME ZONE,
  snapshot_url TEXT,
  snapshot_hash TEXT,
  trust_status TEXT NOT NULL DEFAULT 'untrusted',
  trust_reason TEXT,
  incident_flag TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for work event queries
CREATE INDEX idx_work_events_worker_id ON public.work_events(worker_id);
CREATE INDEX idx_work_events_occurred_at ON public.work_events(occurred_at);
CREATE INDEX idx_work_events_device_id ON public.work_events(device_id);
CREATE INDEX idx_work_events_event_type ON public.work_events(event_type);
CREATE INDEX idx_work_events_trust_status ON public.work_events(trust_status);

-- Composite index for daily worker queries
CREATE INDEX idx_work_events_worker_date ON public.work_events(worker_id, occurred_at);

-- ---------------------------------------------
-- Table: work_summaries
-- Daily calculated work summaries per worker
-- ---------------------------------------------
CREATE TABLE public.work_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID NOT NULL REFERENCES public.workers(id),
  work_date DATE NOT NULL,
  total_work_minutes INTEGER NOT NULL DEFAULT 0,
  total_pause_minutes INTEGER NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  taux_horaire_applied NUMERIC NOT NULL DEFAULT 0,
  devise TEXT NOT NULL DEFAULT 'XOF',
  auto_closed BOOLEAN NOT NULL DEFAULT false,
  auto_close_time TIME WITHOUT TIME ZONE,
  segments_json JSONB,
  events_used UUID[] NOT NULL DEFAULT '{}'::uuid[],
  notes TEXT,
  calculation_version TEXT NOT NULL DEFAULT 'v1',
  calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint for one summary per worker per day
CREATE UNIQUE INDEX idx_work_summaries_worker_date ON public.work_summaries(worker_id, work_date);

-- Indexes for summary queries
CREATE INDEX idx_work_summaries_work_date ON public.work_summaries(work_date);
CREATE INDEX idx_work_summaries_auto_closed ON public.work_summaries(auto_closed);

-- ---------------------------------------------
-- Table: correction_events
-- Admin corrections and anomaly resolutions
-- ---------------------------------------------
CREATE TABLE public.correction_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID NOT NULL REFERENCES public.workers(id),
  work_date DATE NOT NULL,
  admin_id UUID NOT NULL,
  anomaly_type public.anomaly_type NOT NULL,
  correction_action public.correction_action NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  justification TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for correction queries
CREATE INDEX idx_correction_events_worker_id ON public.correction_events(worker_id);
CREATE INDEX idx_correction_events_work_date ON public.correction_events(work_date);
CREATE INDEX idx_correction_events_admin_id ON public.correction_events(admin_id);
CREATE INDEX idx_correction_events_anomaly_type ON public.correction_events(anomaly_type);
