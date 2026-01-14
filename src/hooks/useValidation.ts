// ============================================
// Phase 7: HR Validation Hooks (v2)
// Workflow DRAFT → VALIDATED avec traçabilité
// Uses atomic RPC hr_validate_summaries
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

/**
 * Récupère les summaries en attente de validation (DRAFT)
 */
export function usePendingValidations(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ['pending-validations', format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_summaries')
        .select(`
          *,
          workers (
            id,
            nom_affiche,
            matricule,
            photo_url,
            categories (
              id,
              nom,
              taux_horaire,
              devise
            )
          )
        `)
        .eq('is_current', true)
        .eq('validation_status', 'DRAFT')
        .gte('work_date', format(startDate, 'yyyy-MM-dd'))
        .lte('work_date', format(endDate, 'yyyy-MM-dd'))
        .order('work_date', { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

/**
 * Récupère les summaries validés pour une période
 */
export function useValidatedSummaries(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ['validated-summaries', format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_summaries')
        .select(`
          *,
          workers (
            id,
            nom_affiche,
            matricule,
            photo_url,
            categories (
              id,
              nom
            )
          )
        `)
        .eq('is_current', true)
        .eq('validation_status', 'VALIDATED')
        .gte('work_date', format(startDate, 'yyyy-MM-dd'))
        .lte('work_date', format(endDate, 'yyyy-MM-dd'))
        .order('work_date', { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

/**
 * Statistiques de validation pour un période
 */
export function useValidationStats(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ['validation-stats', format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_summaries')
        .select('validation_status, day_status')
        .eq('is_current', true)
        .gte('work_date', format(startDate, 'yyyy-MM-dd'))
        .lte('work_date', format(endDate, 'yyyy-MM-dd'));

      if (error) throw error;

      const stats = {
        total: data.length,
        draft: data.filter(d => d.validation_status === 'DRAFT').length,
        validated: data.filter(d => d.validation_status === 'VALIDATED').length,
        byDayStatus: {
          PRESENT: data.filter(d => d.day_status === 'PRESENT').length,
          RETARD: data.filter(d => d.day_status === 'RETARD').length,
          ABSENT: data.filter(d => d.day_status === 'ABSENT').length,
          ANOMALIE: data.filter(d => d.day_status === 'ANOMALIE').length,
        },
      };

      return stats;
    },
  });
}

/**
 * Valide un summary (DRAFT → VALIDATED)
 * Utilise la fonction DB pour atomicité et verrouillage
 */
export function useValidateSummary() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      summaryId,
      validatorId,
    }: {
      summaryId: string;
      validatorId: string;
    }) => {
      const { data, error } = await supabase.rpc('validate_work_summary', {
        p_summary_id: summaryId,
        p_validator_id: validatorId,
      });

      if (error) {
        if (error.message?.includes('VALIDATION_FAILED')) {
          throw new Error('Validation impossible: le résumé est déjà validé ou n\'existe pas');
        }
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-summaries'] });
      queryClient.invalidateQueries({ queryKey: ['pending-validations'] });
      queryClient.invalidateQueries({ queryKey: ['validated-summaries'] });
      queryClient.invalidateQueries({ queryKey: ['validation-stats'] });
      toast({
        title: 'Validé',
        description: 'Le résumé a été validé et verrouillé',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur de validation',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Result type from hr_validate_summaries RPC
 */
interface BatchValidationResult {
  validated_count: number;
  skipped_count: number;
  error_count: number;
  errors: string[];
  total_processed: number;
}

/**
 * Valide plusieurs summaries en lot via RPC atomique
 * Idempotent: ignore les déjà VALIDATED
 */
export function useBatchValidate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      summaryIds,
    }: {
      summaryIds: string[];
    }): Promise<BatchValidationResult> => {
      if (summaryIds.length === 0) {
        return {
          validated_count: 0,
          skipped_count: 0,
          error_count: 0,
          errors: [],
          total_processed: 0,
        };
      }

      const { data, error } = await supabase.rpc('hr_validate_summaries', {
        p_summary_ids: summaryIds,
      });

      if (error) {
        if (error.message?.includes('ACCESS_DENIED')) {
          throw new Error('Accès refusé: rôle admin requis');
        }
        throw error;
      }

      return data as unknown as BatchValidationResult;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['work-summaries'] });
      queryClient.invalidateQueries({ queryKey: ['pending-validations'] });
      queryClient.invalidateQueries({ queryKey: ['validated-summaries'] });
      queryClient.invalidateQueries({ queryKey: ['validation-stats'] });
      queryClient.invalidateQueries({ queryKey: ['official-export-data'] });

      if (result.error_count === 0 && result.skipped_count === 0) {
        toast({
          title: 'Validation réussie',
          description: `${result.validated_count} résumé(s) validé(s)`,
        });
      } else if (result.validated_count > 0) {
        toast({
          title: 'Validation partielle',
          description: `${result.validated_count} validé(s), ${result.skipped_count} ignoré(s), ${result.error_count} erreur(s)`,
          variant: result.error_count > 0 ? 'destructive' : 'default',
        });
      } else {
        toast({
          title: 'Aucune validation',
          description: `${result.skipped_count} déjà validé(s), ${result.error_count} erreur(s)`,
          variant: 'default',
        });
      }
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

/**
 * Rejette un summary pour correction (reste en DRAFT)
 * Ajoute une note de rejet
 */
export function useRejectSummary() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      summaryId,
      reason,
    }: {
      summaryId: string;
      reason: string;
    }) => {
      const { data, error } = await supabase
        .from('work_summaries')
        .update({
          notes: `[REJET ${new Date().toISOString()}] ${reason}`,
        })
        .eq('id', summaryId)
        .eq('validation_status', 'DRAFT')
        .eq('is_current', true)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-summaries'] });
      queryClient.invalidateQueries({ queryKey: ['pending-validations'] });
      toast({
        title: 'Rejeté',
        description: 'Le résumé a été marqué pour correction',
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
