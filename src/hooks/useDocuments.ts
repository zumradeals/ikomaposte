// ============================================
// IKOMA POSTE - Documents Hook
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type DocumentStatus = 'DRAFT_PDF' | 'SIGNED' | 'REVOKED';
export type SignatureLevel = 'VISUAL' | 'SEALED' | 'BOTH';

export interface Document {
  id: string;
  document_code: string;
  document_type: 'RAP' | 'PTG';
  period_month: string;
  worker_id: string | null;
  category_id: string | null;
  export_version: string;
  source_hash: string;
  source_row_count: number;
  storage_path: string;
  file_size_bytes: number | null;
  generated_by: string;
  generated_at: string;
  filters_json: Record<string, unknown>;
  created_at: string;
  // Signature fields
  status: DocumentStatus;
  signed_by: string | null;
  signed_at: string | null;
  signature_level: SignatureLevel | null;
  pdf_hash: string | null;
  seal_block_json: Record<string, unknown> | null;
  revoked_by: string | null;
  revoked_at: string | null;
  revocation_reason: string | null;
}

export interface VerificationResult {
  valid: boolean;
  status: 'OK' | 'HASH_MISMATCH' | 'NOT_SIGNED' | 'REVOKED' | 'NOT_FOUND' | 'ERROR';
  message: string;
  document?: {
    documentCode: string;
    status: string;
    signedAt: string | null;
    signedBy: string | null;
    signatureLevel: string | null;
    storedHash: string | null;
    calculatedHash: string | null;
    sourceHash: string;
    revocationReason?: string;
  };
}

// Fetch documents list
export function useDocuments(periodMonth?: string) {
  return useQuery({
    queryKey: ['documents', periodMonth],
    queryFn: async () => {
      let query = supabase
        .from('documents')
        .select('*')
        .order('generated_at', { ascending: false });

      if (periodMonth) {
        query = query.eq('period_month', periodMonth);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Document[];
    },
  });
}

// Generate PDF mutation
export function useGeneratePDF() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      type,
      periodMonth,
      workerId,
      categoryId,
    }: {
      type: 'RAP' | 'PTG';
      periodMonth: string;
      workerId?: string;
      categoryId?: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-pdf`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ type, periodMonth, workerId, categoryId }),
        }
      );

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to generate PDF');
      }

      return result.document;
    },
    onSuccess: (data) => {
      toast({
        title: 'PDF généré',
        description: `Document ${data.documentCode} créé avec succès`,
      });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Download document
export function useDownloadDocument() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (doc: Document) => {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(doc.storage_path);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.document_code}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return doc.document_code;
    },
    onSuccess: (documentCode) => {
      toast({
        title: 'Téléchargement',
        description: `${documentCode}.pdf téléchargé`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur téléchargement',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Sign document mutation
export function useSignDocument() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      documentId,
      signatureLevel,
    }: {
      documentId: string;
      signatureLevel: SignatureLevel;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sign-document`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ documentId, signatureLevel }),
        }
      );

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to sign document');
      }

      return result.document;
    },
    onSuccess: (data) => {
      toast({
        title: 'Document signé',
        description: `${data.documentCode} signé avec succès (${data.signatureLevel})`,
      });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur signature',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Verify document mutation
export function useVerifyDocument() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      documentId,
      documentCode,
    }: {
      documentId?: string;
      documentCode?: string;
    }): Promise<VerificationResult> => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-document`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ documentId, documentCode }),
        }
      );

      const result = await response.json();
      return result as VerificationResult;
    },
    onSuccess: (result) => {
      if (result.valid) {
        toast({
          title: 'Vérification réussie',
          description: result.message,
        });
      } else {
        toast({
          title: 'Vérification échouée',
          description: result.message,
          variant: 'destructive',
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur vérification',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Revoke document mutation
export function useRevokeDocument() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      documentId,
      reason,
    }: {
      documentId: string;
      reason: string;
    }) => {
      const { data, error } = await supabase.rpc('revoke_document', {
        p_document_id: documentId,
        p_reason: reason,
      });

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Document révoqué',
        description: 'Le document a été marqué comme révoqué',
      });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur révocation',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Regenerate PDF documents with valid format
export function useRegeneratePDFs() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/regenerate-pdf`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({}),
        }
      );

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to regenerate PDFs');
      }

      return result;
    },
    onSuccess: (data) => {
      toast({
        title: 'PDFs régénérés',
        description: `${data.regenerated}/${data.total} documents mis à jour`,
      });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur régénération',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
