-- ============================================
-- IKOMA POSTE - Document Signature/Seal v1.0
-- ============================================

-- Create enums for document status and signature level
CREATE TYPE public.document_status AS ENUM ('DRAFT_PDF', 'SIGNED', 'REVOKED');
CREATE TYPE public.signature_level AS ENUM ('VISUAL', 'SEALED', 'BOTH');

-- Add signature fields to documents table
ALTER TABLE public.documents
  ADD COLUMN status public.document_status NOT NULL DEFAULT 'DRAFT_PDF',
  ADD COLUMN signed_by UUID NULL,
  ADD COLUMN signed_at TIMESTAMPTZ NULL,
  ADD COLUMN signature_level public.signature_level NULL,
  ADD COLUMN pdf_hash TEXT NULL, -- SHA-256 of the final signed PDF
  ADD COLUMN seal_block_json JSONB NULL, -- {document_code, source_hash, pdf_hash, signed_at}
  ADD COLUMN revoked_by UUID NULL,
  ADD COLUMN revoked_at TIMESTAMPTZ NULL,
  ADD COLUMN revocation_reason TEXT NULL;

-- Create index for status lookups
CREATE INDEX idx_documents_status ON public.documents(status);

-- Add constraint: signed documents must have signature metadata
ALTER TABLE public.documents
  ADD CONSTRAINT chk_signed_documents CHECK (
    (status != 'SIGNED') OR 
    (signed_by IS NOT NULL AND signed_at IS NOT NULL AND pdf_hash IS NOT NULL)
  );

-- Add constraint: revoked documents must have revocation reason
ALTER TABLE public.documents
  ADD CONSTRAINT chk_revoked_documents CHECK (
    (status != 'REVOKED') OR 
    (revoked_by IS NOT NULL AND revoked_at IS NOT NULL AND revocation_reason IS NOT NULL)
  );

-- Function to check if document can be modified
CREATE OR REPLACE FUNCTION public.can_modify_document(p_document_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_status document_status;
BEGIN
  SELECT status INTO v_status FROM documents WHERE id = p_document_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Only DRAFT_PDF can be modified
  RETURN v_status = 'DRAFT_PDF';
END;
$$;

-- Function to sign a document
CREATE OR REPLACE FUNCTION public.sign_document(
  p_document_id UUID,
  p_signature_level signature_level,
  p_pdf_hash TEXT,
  p_seal_block JSONB
)
RETURNS documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_document documents;
  v_current_status document_status;
BEGIN
  v_user_id := auth.uid();
  
  -- Check admin role
  IF NOT has_role(v_user_id, 'admin') THEN
    RAISE EXCEPTION 'SIGN_DENIED: Requires admin role';
  END IF;
  
  -- Lock and check status
  SELECT status INTO v_current_status
  FROM documents WHERE id = p_document_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DOCUMENT_NOT_FOUND: %', p_document_id;
  END IF;
  
  IF v_current_status = 'SIGNED' THEN
    RAISE EXCEPTION 'ALREADY_SIGNED: Document already signed';
  END IF;
  
  IF v_current_status = 'REVOKED' THEN
    RAISE EXCEPTION 'DOCUMENT_REVOKED: Cannot sign revoked document';
  END IF;
  
  -- Sign the document
  UPDATE documents
  SET 
    status = 'SIGNED',
    signed_by = v_user_id,
    signed_at = now(),
    signature_level = p_signature_level,
    pdf_hash = p_pdf_hash,
    seal_block_json = p_seal_block
  WHERE id = p_document_id
  RETURNING * INTO v_document;
  
  RETURN v_document;
END;
$$;

-- Function to revoke a document
CREATE OR REPLACE FUNCTION public.revoke_document(
  p_document_id UUID,
  p_reason TEXT
)
RETURNS documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_document documents;
  v_current_status document_status;
BEGIN
  v_user_id := auth.uid();
  
  -- Check admin role
  IF NOT has_role(v_user_id, 'admin') THEN
    RAISE EXCEPTION 'REVOKE_DENIED: Requires admin role';
  END IF;
  
  IF p_reason IS NULL OR length(trim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'INVALID_REASON: Revocation reason must be at least 10 characters';
  END IF;
  
  -- Lock and check status
  SELECT status INTO v_current_status
  FROM documents WHERE id = p_document_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DOCUMENT_NOT_FOUND: %', p_document_id;
  END IF;
  
  IF v_current_status = 'REVOKED' THEN
    RAISE EXCEPTION 'ALREADY_REVOKED: Document already revoked';
  END IF;
  
  IF v_current_status = 'DRAFT_PDF' THEN
    RAISE EXCEPTION 'NOT_SIGNED: Cannot revoke unsigned document, delete it instead';
  END IF;
  
  -- Revoke the document
  UPDATE documents
  SET 
    status = 'REVOKED',
    revoked_by = v_user_id,
    revoked_at = now(),
    revocation_reason = p_reason
  WHERE id = p_document_id
  RETURNING * INTO v_document;
  
  RETURN v_document;
END;
$$;