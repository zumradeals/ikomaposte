-- ============================================
-- IKOMA POSTE - PDF Documents Table v1.0
-- ============================================
-- Tracks generated PDF documents with traceability
-- Immutable naming: IKP-[TYPE]-[YYYYMM]-[SEQ].pdf
-- ============================================

-- Create document_type enum
CREATE TYPE public.document_type AS ENUM ('RAP', 'PTG');

-- Create documents table
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Document identification
  document_code TEXT NOT NULL UNIQUE, -- IKP-RAP-202601-001 or IKP-PTG-202601-001
  document_type public.document_type NOT NULL,
  
  -- Period and filters
  period_month TEXT NOT NULL, -- YYYY-MM
  worker_id UUID NULL REFERENCES public.workers(id), -- NULL for PTG
  category_id UUID NULL REFERENCES public.categories(id), -- Optional filter
  
  -- Traceability
  export_version TEXT NOT NULL DEFAULT '1.0',
  source_hash TEXT NOT NULL, -- SHA-256 of source JSON
  source_row_count INTEGER NOT NULL DEFAULT 0,
  
  -- Storage
  storage_path TEXT NOT NULL, -- Path in storage bucket
  file_size_bytes INTEGER NULL,
  
  -- Audit
  generated_by UUID NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Metadata
  filters_json JSONB NOT NULL DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create sequence tracking table
CREATE TABLE public.document_sequences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_type public.document_type NOT NULL,
  period_month TEXT NOT NULL, -- YYYYMM format (no dash)
  current_sequence INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(document_type, period_month)
);

-- Function to get next sequence number atomically
CREATE OR REPLACE FUNCTION public.get_next_document_sequence(
  p_document_type public.document_type,
  p_period_month TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_next_seq INTEGER;
BEGIN
  -- Upsert and get next sequence
  INSERT INTO public.document_sequences (document_type, period_month, current_sequence)
  VALUES (p_document_type, p_period_month, 1)
  ON CONFLICT (document_type, period_month)
  DO UPDATE SET 
    current_sequence = document_sequences.current_sequence + 1,
    updated_at = now()
  RETURNING current_sequence INTO v_next_seq;
  
  RETURN v_next_seq;
END;
$$;

-- Enable RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_sequences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for documents
CREATE POLICY "Admins can view documents"
  ON public.documents
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert documents"
  ON public.documents
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- RLS Policies for sequences (managed by functions only)
CREATE POLICY "Admins can view sequences"
  ON public.document_sequences
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for documents bucket
CREATE POLICY "Admins can view documents files"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'documents' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can upload documents files"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'documents' AND has_role(auth.uid(), 'admin'));

-- Index for faster lookups
CREATE INDEX idx_documents_period ON public.documents(period_month);
CREATE INDEX idx_documents_type ON public.documents(document_type);
CREATE INDEX idx_documents_worker ON public.documents(worker_id) WHERE worker_id IS NOT NULL;