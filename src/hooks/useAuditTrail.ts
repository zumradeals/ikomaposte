// ============================================
// IKOMA POSTE - Audit Trail Hooks
// ============================================
//
// React hooks for accessing audit trail functionality
//

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  getCalculationAudit,
  queryAuditRecords,
  getAuditPeriodSummary,
  replayCalculation,
  getPolicyAuditTrail,
  getPolicyChangesInRange,
  verifyEventIntegrity,
} from '@/lib/audit-trail';
import {
  CalculationAuditRecord,
  AuditQueryFilter,
  AuditPeriodSummary,
  ReplayResult,
  PolicyAuditEntry,
} from '@/types/audit-trail';

// ============================================
// CALCULATION AUDIT HOOKS
// ============================================

/**
 * Get audit record for a specific worker and production date
 */
export function useCalculationAudit(workerId: string | undefined, productionDate: string | undefined) {
  return useQuery({
    queryKey: ['calculation-audit', workerId, productionDate],
    queryFn: () => getCalculationAudit(workerId!, productionDate!),
    enabled: !!workerId && !!productionDate,
  });
}

/**
 * Query audit records with filters
 */
export function useAuditRecords(filter: AuditQueryFilter) {
  return useQuery({
    queryKey: ['audit-records', filter],
    queryFn: () => queryAuditRecords(filter),
    enabled: !!(filter.worker_id || filter.production_date_from),
  });
}

/**
 * Get summary of audit records for a period
 */
export function useAuditPeriodSummary(
  productionDateFrom: string | undefined,
  productionDateTo: string | undefined,
  workerId?: string
) {
  return useQuery({
    queryKey: ['audit-summary', productionDateFrom, productionDateTo, workerId],
    queryFn: () => getAuditPeriodSummary(productionDateFrom!, productionDateTo!, workerId),
    enabled: !!productionDateFrom && !!productionDateTo,
  });
}

// ============================================
// REPLAY HOOKS
// ============================================

/**
 * Replay a calculation to verify consistency
 */
export function useReplayCalculation() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: replayCalculation,
    onSuccess: (result) => {
      if (result.success) {
        if (result.differences.length === 0) {
          toast({
            title: 'Vérification réussie',
            description: 'Le calcul est reproductible avec les mêmes résultats.',
          });
        } else {
          toast({
            title: 'Différences détectées',
            description: `${result.differences.length} différence(s) trouvée(s) lors du rejeu.`,
            variant: 'destructive',
          });
        }
      } else {
        toast({
          title: 'Erreur de rejeu',
          description: result.error || 'Impossible de rejouer le calcul.',
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

// ============================================
// POLICY AUDIT HOOKS
// ============================================

/**
 * Get audit trail for a specific policy
 */
export function usePolicyAuditTrail(policyId: string | undefined) {
  return useQuery({
    queryKey: ['policy-audit', policyId],
    queryFn: () => getPolicyAuditTrail(policyId!),
    enabled: !!policyId,
  });
}

/**
 * Get all policy changes in a date range
 */
export function usePolicyChanges(startDate: string | undefined, endDate: string | undefined) {
  return useQuery({
    queryKey: ['policy-changes', startDate, endDate],
    queryFn: () => getPolicyChangesInRange(startDate!, endDate!),
    enabled: !!startDate && !!endDate,
  });
}

// ============================================
// INTEGRITY VERIFICATION HOOKS
// ============================================

/**
 * Verify event integrity for a worker and date
 */
export function useVerifyEventIntegrity() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ workerId, productionDate }: { workerId: string; productionDate: string }) =>
      verifyEventIntegrity(workerId, productionDate),
    onSuccess: (result) => {
      if (result.valid) {
        toast({
          title: 'Intégrité vérifiée',
          description: 'Aucune modification détectée sur les événements bruts.',
        });
      } else {
        toast({
          title: 'Problèmes d\'intégrité',
          description: `${result.issues.length} problème(s) détecté(s).`,
          variant: 'destructive',
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur de vérification',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// ============================================
// HELPER HOOKS
// ============================================

/**
 * Get audit records for a worker across all dates
 */
export function useWorkerAuditHistory(workerId: string | undefined, limit: number = 50) {
  return useAuditRecords({
    worker_id: workerId,
    limit,
  });
}

/**
 * Get anomalies in a date range
 */
export function useAnomaliesInRange(
  productionDateFrom: string | undefined,
  productionDateTo: string | undefined
) {
  return useAuditRecords({
    production_date_from: productionDateFrom,
    production_date_to: productionDateTo,
    has_anomaly: true,
    limit: 100,
  });
}
