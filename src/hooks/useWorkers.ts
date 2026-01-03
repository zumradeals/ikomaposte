import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Worker {
  id: string;
  matricule: string;
  nom_affiche: string;
  category_id: string;
  photo_url: string | null;
  actif: boolean;
  qr_token: string;
  created_at: string;
  updated_at: string;
}

export interface WorkerWithCategory extends Worker {
  categories: {
    id: string;
    nom: string;
    taux_horaire: number;
    devise: string;
  } | null;
}

export type WorkerInsert = Omit<Worker, 'id' | 'created_at' | 'updated_at' | 'qr_token'>;
export type WorkerUpdate = Partial<WorkerInsert>;

interface WorkerFilters {
  search?: string;
  categoryId?: string;
  includeInactive?: boolean;
}

export function useWorkers(filters: WorkerFilters = {}) {
  const { search, categoryId, includeInactive = false } = filters;

  return useQuery({
    queryKey: ['workers', filters],
    queryFn: async () => {
      let query = supabase
        .from('workers')
        .select(`
          *,
          categories (
            id,
            nom,
            taux_horaire,
            devise
          )
        `)
        .order('nom_affiche');
      
      if (!includeInactive) {
        query = query.eq('actif', true);
      }
      
      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      let result = data as WorkerWithCategory[];
      
      if (search) {
        const searchLower = search.toLowerCase();
        result = result.filter(
          w => w.nom_affiche.toLowerCase().includes(searchLower) ||
               w.matricule.toLowerCase().includes(searchLower)
        );
      }
      
      return result;
    },
  });
}

export function useWorker(id: string | undefined) {
  return useQuery({
    queryKey: ['worker', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('workers')
        .select(`
          *,
          categories (
            id,
            nom,
            taux_horaire,
            devise
          )
        `)
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data as WorkerWithCategory | null;
    },
    enabled: !!id,
  });
}

export function useWorkerByQrToken(qrToken: string | undefined) {
  return useQuery({
    queryKey: ['worker-qr', qrToken],
    queryFn: async () => {
      if (!qrToken) return null;
      
      const { data, error } = await supabase
        .from('workers')
        .select(`
          *,
          categories (
            id,
            nom,
            taux_horaire,
            devise
          )
        `)
        .eq('qr_token', qrToken)
        .eq('actif', true)
        .maybeSingle();
      
      if (error) throw error;
      return data as WorkerWithCategory | null;
    },
    enabled: !!qrToken,
  });
}

export function useCreateWorker() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (worker: WorkerInsert) => {
      const { data, error } = await supabase
        .from('workers')
        .insert(worker)
        .select()
        .single();
      
      if (error) throw error;
      return data as Worker;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workers'] });
      toast({
        title: 'Travailleur créé',
        description: 'Le travailleur a été créé avec succès.',
      });
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

export function useUpdateWorker() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: WorkerUpdate }) => {
      const { data, error } = await supabase
        .from('workers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Worker;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workers'] });
      toast({
        title: 'Travailleur mis à jour',
        description: 'Le travailleur a été modifié avec succès.',
      });
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

export async function uploadWorkerPhoto(file: File, workerId: string): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${workerId}.${fileExt}`;
  const filePath = `photos/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('worker-photos')
    .upload(filePath, file, { upsert: true });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from('worker-photos')
    .getPublicUrl(filePath);

  return data.publicUrl;
}
