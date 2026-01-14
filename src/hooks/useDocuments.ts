// ============================================
// IKOMA POSTE - Documents Hook
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
