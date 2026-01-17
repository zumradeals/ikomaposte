import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays, differenceInDays } from 'date-fns';
import { 
  generateRawEventCSV, 
  mapEventToRow,
  SourceEventData,
} from '@/lib/raw-event-export';
import { toast } from 'sonner';

const MAX_BATCH_DAYS = 31;

interface BatchExportResult {
  date: string;
  success: boolean;
  rowCount: number;
  error?: string;
}

interface BatchExportSummary {
  results: BatchExportResult[];
  totalFiles: number;
  successCount: number;
  failedCount: number;
  totalRows: number;
}

async function fetchEventsForDate(date: Date): Promise<{
  events: SourceEventData[];
  error?: string;
}> {
  const dateStr = format(date, 'yyyy-MM-dd');
  
  // Calculate calendar day boundaries for fallback OR condition
  const dayStart = `${dateStr}T00:00:00Z`;
  const dayEnd = `${dateStr}T23:59:59.999Z`;
  
  const { data, error } = await supabase
    .from('work_events')
    .select(`
      id,
      occurred_at,
      event_type,
      device_id,
      trust_status,
      trust_reason,
      production_date,
      incident_flag,
      created_at,
      workers!inner (
        matricule,
        nom_affiche
      ),
      devices:device_id (
        label
      )
    `)
    .or(`production_date.eq.${dateStr},and(production_date.is.null,occurred_at.gte.${dayStart},occurred_at.lte.${dayEnd})`)
    .order('occurred_at', { ascending: true });

  if (error) {
    return { events: [], error: error.message };
  }

  const events: SourceEventData[] = (data || []).map((event: any) => ({
    id: event.id,
    occurred_at: event.occurred_at,
    event_type: event.event_type,
    device_id: event.device_id,
    trust_status: event.trust_status,
    trust_reason: event.trust_reason,
    production_date: event.production_date,
    incident_flag: event.incident_flag,
    created_at: event.created_at,
    worker_matricule: event.workers?.matricule || '',
    worker_name: event.workers?.nom_affiche || '',
    device_label: event.devices?.label || '',
    export_date: dateStr,
  }));

  return { events };
}

async function exportBatchRawEvents(
  startDate: Date,
  endDate: Date,
  onProgress?: (current: number, total: number) => void
): Promise<BatchExportSummary> {
  const dayCount = differenceInDays(endDate, startDate) + 1;
  
  if (dayCount > MAX_BATCH_DAYS) {
    throw new Error(`La période ne peut pas dépasser ${MAX_BATCH_DAYS} jours`);
  }
  
  if (dayCount < 1) {
    throw new Error('La date de fin doit être après la date de début');
  }

  const results: BatchExportResult[] = [];
  let totalRows = 0;

  for (let i = 0; i < dayCount; i++) {
    const currentDate = addDays(startDate, i);
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    
    onProgress?.(i + 1, dayCount);

    try {
      const { events, error } = await fetchEventsForDate(currentDate);
      
      if (error) {
        results.push({
          date: dateStr,
          success: false,
          rowCount: 0,
          error,
        });
        continue;
      }

      if (events.length === 0) {
        results.push({
          date: dateStr,
          success: true,
          rowCount: 0,
        });
        continue;
      }

      // Map events to rows
      const rows = events.map(mapEventToRow);
      const csvContent = generateRawEventCSV(rows);
      
      // Trigger download
      const filename = `ikoma_poste_events_${dateStr}.csv`;
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      totalRows += rows.length;
      results.push({
        date: dateStr,
        success: true,
        rowCount: rows.length,
      });

      // Small delay between downloads to prevent browser blocking
      if (i < dayCount - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    } catch (err) {
      results.push({
        date: dateStr,
        success: false,
        rowCount: 0,
        error: err instanceof Error ? err.message : 'Erreur inconnue',
      });
    }
  }

  const successCount = results.filter(r => r.success).length;
  const failedCount = results.filter(r => !r.success).length;

  return {
    results,
    totalFiles: dayCount,
    successCount,
    failedCount,
    totalRows,
  };
}

export function useBatchRawEventExport() {
  return useMutation({
    mutationFn: async ({ 
      startDate, 
      endDate,
      onProgress,
    }: { 
      startDate: Date; 
      endDate: Date;
      onProgress?: (current: number, total: number) => void;
    }) => {
      return exportBatchRawEvents(startDate, endDate, onProgress);
    },
    onSuccess: (summary) => {
      if (summary.failedCount === 0) {
        toast.success(
          `Export batch terminé: ${summary.successCount} fichiers, ${summary.totalRows} lignes`
        );
      } else {
        toast.warning(
          `Export partiel: ${summary.successCount}/${summary.totalFiles} fichiers, ${summary.failedCount} échecs`
        );
      }
    },
    onError: (error) => {
      toast.error(`Erreur batch: ${error.message}`);
    },
  });
}

export type { BatchExportResult, BatchExportSummary };
