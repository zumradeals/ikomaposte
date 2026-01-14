// ============================================
// Phase 7: HR Validation Hooks
// Workflow DRAFT → VALIDATED avec traçabilité
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ValidationStatusType } from '@/types/business-rules';

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
              nom
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
        // Parse erreur DB
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
 * Valide plusieurs summaries en lot
 */
export function useBatchValidate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      summaryIds,
      validatorId,
    }: {
      summaryIds: string[];
      validatorId: string;
    }) => {
      const results = {
        success: 0,
        failed: 0,
        errors: [] as string[],
      };

      for (const summaryId of summaryIds) {
        try {
          const { error } = await supabase.rpc('validate_work_summary', {
            p_summary_id: summaryId,
            p_validator_id: validatorId,
          });

          if (error) {
            results.failed++;
            results.errors.push(error.message);
          } else {
            results.success++;
          }
        } catch (err) {
          results.failed++;
          results.errors.push(err instanceof Error ? err.message : 'Erreur inconnue');
        }
      }

      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['work-summaries'] });
      queryClient.invalidateQueries({ queryKey: ['pending-validations'] });
      queryClient.invalidateQueries({ queryKey: ['validated-summaries'] });
      queryClient.invalidateQueries({ queryKey: ['validation-stats'] });

      if (results.failed === 0) {
        toast({
          title: 'Validation réussie',
          description: `${results.success} résumés validés`,
        });
      } else {
        toast({
          title: 'Validation partielle',
          description: `${results.success} réussis, ${results.failed} échoués`,
          variant: 'destructive',
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
      rejectorId,
    }: {
      summaryId: string;
      reason: string;
      rejectorId: string;
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
