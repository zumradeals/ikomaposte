// Phase 6: Export hooks

import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { WorkSummaryWithWorker, WorkSegment } from '@/types/work-summaries';
import { WorkEvent } from '@/types/work-events';
import { CorrectionEvent, DaySummary } from '@/types/corrections';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import {
  generatePayrollCSV,
  generateAuditJSON,
  generateSyncNDJSON,
  generateDisputeHTML,
  downloadFile,
  openHTMLInNewTab,
} from '@/lib/export-utils';

// Export stats interface
export interface ExportStats {
  totalDays: number;
  totalWorkers: number;
  totalEvents: number;
  totalCorrections: number;
  incoherentDays: number;
  correctedDays: number;
  healthyDays: number;
}

// Fetch all data needed for exports
export function useExportData(startDate: Date, endDate: Date) {
  const startStr = format(startDate, 'yyyy-MM-dd');
  const endStr = format(endDate, 'yyyy-MM-dd');
  const dayStart = startOfDay(startDate).toISOString();
  const dayEnd = endOfDay(endDate).toISOString();

  return useQuery({
    queryKey: ['export-data', startStr, endStr],
    queryFn: async () => {
      // Fetch work summaries
      const { data: summaries, error: summariesError } = await supabase
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
        .gte('work_date', startStr)
        .lte('work_date', endStr)
        .order('work_date', { ascending: true });

      if (summariesError) throw summariesError;

      // Fetch raw work events
      const { data: events, error: eventsError } = await supabase
        .from('work_events')
        .select('*')
        .gte('occurred_at', dayStart)
        .lte('occurred_at', dayEnd)
        .order('occurred_at', { ascending: true });

      if (eventsError) throw eventsError;

      // Fetch corrections
      const { data: corrections, error: correctionsError } = await supabase
        .from('correction_events')
        .select('*')
        .gte('work_date', startStr)
        .lte('work_date', endStr)
        .order('created_at', { ascending: true });

      if (correctionsError) throw correctionsError;

      // Fetch workers for anomaly detection
      const { data: workers, error: workersError } = await supabase
        .from('workers')
        .select('id, nom_affiche');

      if (workersError) throw workersError;

      const workerMap = new Map(workers?.map(w => [w.id, w.nom_affiche]) || []);

      // Build day summaries for status
      const daySummaries = buildDaySummaries(
        events as WorkEvent[],
        corrections as CorrectionEvent[],
        workerMap
      );

      // Calculate stats
      const uniqueWorkers = new Set((summaries || []).map(s => s.worker_id));
      const stats: ExportStats = {
        totalDays: new Set((summaries || []).map(s => s.work_date)).size,
        totalWorkers: uniqueWorkers.size,
        totalEvents: (events || []).length,
        totalCorrections: (corrections || []).length,
        incoherentDays: daySummaries.filter(d => d.status === 'incoherent').length,
        correctedDays: daySummaries.filter(d => d.status === 'corrected').length,
        healthyDays: daySummaries.filter(d => d.status === 'healthy').length,
      };

      return {
        summaries: (summaries || []).map(item => ({
          ...item,
          segments_json: item.segments_json as unknown as WorkSegment[] | null,
        })) as WorkSummaryWithWorker[],
        events: events as WorkEvent[],
        corrections: corrections as CorrectionEvent[],
        daySummaries,
        stats,
      };
    },
  });
}

// Build day summaries for status detection
function buildDaySummaries(
  events: WorkEvent[],
  corrections: CorrectionEvent[],
  workerMap: Map<string, string>
): DaySummary[] {
  const trustedEvents = events.filter(e => e.trust_status === 'trusted');
  
  // Group events by worker and date
  const groupedEvents = new Map<string, WorkEvent[]>();
  for (const event of trustedEvents) {
    const eventDate = format(parseISO(event.occurred_at), 'yyyy-MM-dd');
    const key = `${event.worker_id}|${eventDate}`;
    if (!groupedEvents.has(key)) {
      groupedEvents.set(key, []);
    }
    groupedEvents.get(key)!.push(event);
  }

  const summaries: DaySummary[] = [];

  for (const [key, dayEvents] of groupedEvents) {
    const [workerId, workDate] = key.split('|');
    const workerName = workerMap.get(workerId) || 'Inconnu';

    // Check for anomalies
    const hasAnomaly = checkForAnomalies(dayEvents);
    
    // Check for corrections
    const dayCorrections = corrections.filter(
      c => c.worker_id === workerId && c.work_date === workDate
    );

    let status: DaySummary['status'] = 'healthy';
    if (hasAnomaly) {
      status = dayCorrections.length > 0 ? 'corrected' : 'incoherent';
    }

    summaries.push({
      worker_id: workerId,
      worker_name: workerName,
      work_date: workDate,
      status,
      anomalies: [],
      corrections: dayCorrections,
      events: dayEvents.map(e => ({
        id: e.id,
        event_type: e.event_type,
        occurred_at: e.occurred_at,
        trust_status: e.trust_status,
      })),
    });
  }

  return summaries;
}

function checkForAnomalies(events: WorkEvent[]): boolean {
  if (events.length === 0) return false;
  
  const sorted = [...events].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
  );

  // Check missing TAKE at start
  if (sorted[0].event_type !== 'TAKE') return true;

  // Check missing END at end
  if (sorted[sorted.length - 1].event_type !== 'END') return true;

  // Check for duplicate TAKE/END
  const takeCount = sorted.filter(e => e.event_type === 'TAKE').length;
  const endCount = sorted.filter(e => e.event_type === 'END').length;
  if (takeCount > 1 || endCount > 1) return true;

  return false;
}

// Log export action to audit
async function logExportAction(
  exportType: string,
  periodFrom: string,
  periodTo: string,
  adminId: string
) {
  // For now, we'll just log to console
  // In production, this would be an insert to an audit table
  console.log('[EXPORT AUDIT]', {
    type: 'export_triggered',
    export_type: exportType,
    period_from: periodFrom,
    period_to: periodTo,
    admin_id: adminId,
    timestamp: new Date().toISOString(),
  });
}

// Export mutations
export function usePayrollExport() {
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      summaries,
      daySummaries,
      periodFrom,
      periodTo,
    }: {
      summaries: WorkSummaryWithWorker[];
      daySummaries: DaySummary[];
      periodFrom: string;
      periodTo: string;
    }) => {
      const csv = generatePayrollCSV(summaries, daySummaries);
      const filename = `paie_${periodFrom}_${periodTo}.csv`;
      downloadFile(csv, filename, 'text/csv;charset=utf-8;');
      
      if (user?.id) {
        await logExportAction('payroll_csv', periodFrom, periodTo, user.id);
      }
      
      return filename;
    },
    onSuccess: (filename) => {
      toast({
        title: 'Export Paie',
        description: `Fichier ${filename} téléchargé`,
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

export function useAuditExport() {
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      events,
      corrections,
      summaries,
      periodFrom,
      periodTo,
    }: {
      events: WorkEvent[];
      corrections: CorrectionEvent[];
      summaries: WorkSummaryWithWorker[];
      periodFrom: string;
      periodTo: string;
    }) => {
      const json = generateAuditJSON(events, corrections, summaries, periodFrom, periodTo);
      const filename = `audit_${periodFrom}_${periodTo}.json`;
      downloadFile(json, filename, 'application/json;charset=utf-8;');
      
      if (user?.id) {
        await logExportAction('audit_json', periodFrom, periodTo, user.id);
      }
      
      return filename;
    },
    onSuccess: (filename) => {
      toast({
        title: 'Export Audit',
        description: `Fichier ${filename} téléchargé`,
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

export function useSyncExport() {
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      events,
      corrections,
      summaries,
      periodFrom,
      periodTo,
    }: {
      events: WorkEvent[];
      corrections: CorrectionEvent[];
      summaries: WorkSummaryWithWorker[];
      periodFrom: string;
      periodTo: string;
    }) => {
      const ndjson = generateSyncNDJSON(events, corrections, summaries);
      const filename = `sync_${periodFrom}_${periodTo}.ndjson`;
      downloadFile(ndjson, filename, 'application/x-ndjson;charset=utf-8;');
      
      if (user?.id) {
        await logExportAction('sync_ndjson', periodFrom, periodTo, user.id);
      }
      
      return filename;
    },
    onSuccess: (filename) => {
      toast({
        title: 'Export Sync',
        description: `Fichier ${filename} téléchargé`,
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

export function useDisputeExport() {
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      workerName,
      matricule,
      date,
      events,
      corrections,
      summary,
    }: {
      workerName: string;
      matricule: string;
      date: string;
      events: WorkEvent[];
      corrections: CorrectionEvent[];
      summary: WorkSummaryWithWorker | null;
    }) => {
      const html = generateDisputeHTML(
        workerName,
        matricule,
        date,
        events,
        corrections,
        summary
      );
      
      openHTMLInNewTab(html);
      
      if (user?.id) {
        await logExportAction('dispute_html', date, date, user.id);
      }
      
      return `litige_${matricule}_${date}`;
    },
    onSuccess: () => {
      toast({
        title: 'Export Litige',
        description: 'Rapport ouvert dans un nouvel onglet',
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
