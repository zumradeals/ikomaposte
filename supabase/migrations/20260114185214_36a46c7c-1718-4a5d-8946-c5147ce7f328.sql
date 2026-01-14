-- Fix RLS policies for document_sequences (add missing INSERT/UPDATE policies)
-- Sequences are managed via SECURITY DEFINER function, but we need policies for edge functions

-- Add INSERT policy for sequences (called via get_next_document_sequence function)
CREATE POLICY "Admins can insert sequences"
  ON public.document_sequences
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update sequences"
  ON public.document_sequences
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));