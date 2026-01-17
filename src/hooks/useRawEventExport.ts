/**
 * IKOMA POSTE - Raw Event Export Hook
 * 
 * Generates daily CSV exports with:
 * - One file per calendar day
 * - One row per event
 * - No aggregation, no filtering except by date
 * - Deterministic ordering by event_timestamp
 * 
 * Date selection logic:
 * - Primary: production_date = target date
 * - Fallback: occurred_at within calendar day bounds (for events without production_date)
 */

import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfDay, endOfDay } from 'date-fns';
import { toast } from 'sonner';
import {
  SourceEventData,
  mapEventToRow,
  generateRawEventCSV,
  downloadRawEventCSV,
} from '@/lib/raw-event-export';

// ============================================================================
// DATA FETCHING
// ============================================================================

/**
 * Fetches all events for a specific date using OR logic:
 * 1. production_date = target date, OR
 * 2. occurred_at within calendar day bounds (for events without production_date)
 * 
 * Joined with workers and devices for complete data
 * Ordered by occurred_at for deterministic output
 */
async function fetchEventsForDate(date: Date): Promise<SourceEventData[]> {
  const dateStr = format(date, 'yyyy-MM-dd');
  const dayStart = startOfDay(date).toISOString();
  const dayEnd = endOfDay(date).toISOString();
  
  // Use OR filter: production_date matches OR occurred_at within calendar day
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
      )
    `)
    .or(`production_date.eq.${dateStr},and(production_date.is.null,occurred_at.gte.${dayStart},occurred_at.lte.${dayEnd})`)
    .order('occurred_at', { ascending: true });
  
  if (error) {
    throw new Error(`Failed to fetch events: ${error.message}`);
  }
  
  // Fetch device labels separately to avoid FK issues
  const deviceIds = [...new Set((data ?? []).map((e: any) => e.device_id))];
  const { data: devices } = await supabase
    .from('devices')
    .select('device_id, label')
    .in('device_id', deviceIds);
  
  const deviceMap = new Map<string, string>();
  (devices ?? []).forEach((d: any) => {
    deviceMap.set(d.device_id, d.label ?? '');
  });
  
  // Map to SourceEventData format with null safety
  // Include dateStr as export_date fallback for work_date
  return (data ?? []).map((row: any) => ({
    id: row.id ?? '',
    occurred_at: row.occurred_at ?? '',
    event_type: row.event_type ?? '',
    device_id: row.device_id ?? '',
    trust_status: row.trust_status ?? '',
    trust_reason: row.trust_reason,
    production_date: row.production_date,
    incident_flag: row.incident_flag,
    created_at: row.created_at ?? '',
    worker_matricule: row.workers?.matricule ?? '',
    worker_name: row.workers?.nom_affiche ?? '',
    device_label: deviceMap.get(row.device_id) ?? null,
    export_date: dateStr, // Fallback for work_date if production_date is null
  }));
}

// ============================================================================
// EXPORT EXECUTION
// ============================================================================

export interface DailyExportResult {
  date: string;
  filename: string;
  rowCount: number;
  success: boolean;
}

/**
 * Executes the daily raw event export
 * - Fetches events for the specified date (production_date OR calendar day)
 * - Maps to export schema with normalization
 * - Generates CSV with strict column order
 * - Triggers download
 */
async function executeDailyExport(date: Date): Promise<DailyExportResult> {
  const dateStr = format(date, 'yyyy-MM-dd');
  const filename = `ikoma_poste_events_${dateStr}.csv`;
  
  // Fetch events with OR logic
  const sourceEvents = await fetchEventsForDate(date);
  
  // Map to export format (normalization applied)
  const exportRows = sourceEvents.map(mapEventToRow);
  
  // Generate CSV with strict schema
  const csvContent = generateRawEventCSV(exportRows);
  
  // Download
  downloadRawEventCSV(csvContent, filename);
  
  return {
    date: dateStr,
    filename,
    rowCount: exportRows.length,
    success: true,
  };
}

// ============================================================================
// REACT HOOK
// ============================================================================

export function useRawEventExport() {
  return useMutation({
    mutationFn: executeDailyExport,
    onSuccess: (result) => {
      toast.success(`Export généré: ${result.filename}`, {
        description: `${result.rowCount} événement(s) exporté(s)`,
      });
    },
    onError: (error: Error) => {
      toast.error('Échec de l\'export', {
        description: error.message,
      });
    },
  });
}

// ============================================================================
// BATCH EXPORT (MULTIPLE DAYS)
// ============================================================================

export interface BatchExportResult {
  exports: DailyExportResult[];
  totalRows: number;
  successCount: number;
  errorCount: number;
}

/**
 * Executes export for a range of dates
 * One file per day, sequential execution
 */
async function executeBatchExport(
  startDate: Date,
  endDate: Date
): Promise<BatchExportResult> {
  const exports: DailyExportResult[] = [];
  let totalRows = 0;
  let successCount = 0;
  let errorCount = 0;
  
  const current = new Date(startDate);
  while (current <= endDate) {
    try {
      const result = await executeDailyExport(new Date(current));
      exports.push(result);
      totalRows += result.rowCount;
      successCount++;
    } catch (error) {
      exports.push({
        date: format(current, 'yyyy-MM-dd'),
        filename: '',
        rowCount: 0,
        success: false,
      });
      errorCount++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return { exports, totalRows, successCount, errorCount };
}

export function useBatchRawEventExport() {
  return useMutation({
    mutationFn: ({ startDate, endDate }: { startDate: Date; endDate: Date }) =>
      executeBatchExport(startDate, endDate),
    onSuccess: (result) => {
      toast.success(`Export batch terminé`, {
        description: `${result.successCount} fichier(s), ${result.totalRows} événement(s)`,
      });
    },
    onError: (error: Error) => {
      toast.error('Échec de l\'export batch', {
        description: error.message,
      });
    },
  });
}
