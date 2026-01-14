// ============================================
// Official Exports Hooks - IKOMA POSTE Doctrine
// ============================================

import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { WorkSummaryWithWorker, WorkSegment } from '@/types/work-summaries';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { getDeviceId } from '@/lib/storage';
import {
  executeDailyExport,
  executeMonthlyExport,
} from '@/lib/official-export-utils';

// ============================================
// Sequence Management (persisted in localStorage)
// ============================================

const SEQUENCE_KEY = 'ikoma_export_sequences';

interface ExportSequences {
  daily: Record<string, number>; // YYYYMM -> sequence
  monthly: Record<string, number>;
}

function getSequences(): ExportSequences {
  try {
    const stored = localStorage.getItem(SEQUENCE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to parse export sequences', e);
  }
  return { daily: {}, monthly: {} };
}

function incrementSequence(type: 'daily' | 'monthly', monthKey: string): number {
  const sequences = getSequences();
  const current = sequences[type][monthKey] || 0;
  const next = current + 1;
  sequences[type][monthKey] = next;
  localStorage.setItem(SEQUENCE_KEY, JSON.stringify(sequences));
  return next;
}

// ============================================
// Fetch Validated Summaries for Export
// ============================================

export function useValidatedSummariesForMonth(monthDate: Date) {
  const monthStart = format(startOfMonth(monthDate), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(monthDate), 'yyyy-MM-dd');
  const periodMonth = format(monthDate, 'yyyy-MM');

  return useQuery({
    queryKey: ['official-export-data', periodMonth],
    queryFn: async () => {
      // Fetch VALIDATED, is_current summaries only
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
        .eq('validation_status', 'VALIDATED')
        .eq('is_current', true)
        .gte('work_date', monthStart)
        .lte('work_date', monthEnd)
        .order('work_date', { ascending: true });

      if (error) throw error;

      // Map to proper type
      const summaries = (data || []).map(item => ({
        ...item,
        segments_json: item.segments_json as unknown as WorkSegment[] | null,
      })) as WorkSummaryWithWorker[];

      // Calculate stats
      const stats = {
        totalValidated: summaries.length,
        byStatus: {
          present: summaries.filter(s => s.day_status === 'PRESENT').length,
          retard: summaries.filter(s => s.day_status === 'RETARD').length,
          absent: summaries.filter(s => s.day_status === 'ABSENT').length,
          anomalie: summaries.filter(s => s.day_status === 'ANOMALIE').length,
        },
        uniqueWorkers: new Set(summaries.map(s => s.worker_id)).size,
      };

      return { summaries, stats, periodMonth };
    },
  });
}

// ============================================
// Audit Logging for Exports
// ============================================

async function logOfficialExport(
  exportType: 'IKP-DAILY' | 'IKP-MONTH',
  periodMonth: string,
  filename: string,
  actorUserId: string,
  rowCount: number
) {
  const deviceId = getDeviceId();
  
  await supabase.from('admin_audit').insert({
    device_id: deviceId || 'unknown',
    actor_user_id: actorUserId,
    event: `OFFICIAL_EXPORT_${exportType}`,
    reason: `Exported ${filename} (${rowCount} rows) for ${periodMonth}`,
  });
}

// ============================================
// Export Mutations
// ============================================

export function useDailyExport() {
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      summaries,
      periodMonth,
      format = 'csv',
    }: {
      summaries: WorkSummaryWithWorker[];
      periodMonth: string;
      format?: 'csv' | 'json';
    }) => {
      if (!user?.id) {
        throw new Error('Utilisateur non authentifié');
      }

      const monthKey = periodMonth.replace('-', '');
      const sequence = incrementSequence('daily', monthKey);
      
      const result = executeDailyExport(summaries, periodMonth, sequence, format);
      
      // Log to audit
      await logOfficialExport('IKP-DAILY', periodMonth, result.filename, user.id, result.rowCount);
      
      return result;
    },
    onSuccess: (result) => {
      toast({
        title: 'Export Journalier',
        description: `${result.filename}.${result.format} téléchargé (${result.rowCount} lignes)`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur export',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useMonthlyExport() {
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      summaries,
      periodMonth,
      format = 'csv',
    }: {
      summaries: WorkSummaryWithWorker[];
      periodMonth: string;
      format?: 'csv' | 'json';
    }) => {
      if (!user?.id) {
        throw new Error('Utilisateur non authentifié');
      }

      const monthKey = periodMonth.replace('-', '');
      const sequence = incrementSequence('monthly', monthKey);
      
      const result = executeMonthlyExport(summaries, periodMonth, sequence, format);
      
      // Log to audit
      await logOfficialExport('IKP-MONTH', periodMonth, result.filename, user.id, result.workerCount);
      
      return result;
    },
    onSuccess: (result) => {
      toast({
        title: 'Export Mensuel',
        description: `${result.filename}.${result.format} téléchargé (${result.workerCount} travailleurs, ${result.dayCount} jours)`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur export',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
