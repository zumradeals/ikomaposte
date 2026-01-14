// Phase 4: Work Summaries Hooks
// Build #1: Versioning + Anti-écrasement + Corrections appliquées

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { WorkSummary, WorkSummaryWithWorker, WorkSegment, SummaryLockError, CALCULATION_VERSION } from '@/types/work-summaries';
import { WorkEvent } from '@/types/work-events';
import { CorrectionEvent } from '@/types/corrections';
import { calculateWorkerDay } from '@/lib/work-calculator';
import { format, startOfDay, endOfDay } from 'date-fns';

// Get summaries for a date range (only current versions)
export function useSummaries(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ['work-summaries', format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd')],
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
        .gte('work_date', format(startDate, 'yyyy-MM-dd'))
        .lte('work_date', format(endDate, 'yyyy-MM-dd'))
        .order('work_date', { ascending: false });

      if (error) throw error;
      
      // Parse segments_json for each summary
      return (data || []).map(item => ({
        ...item,
        segments_json: item.segments_json as unknown as WorkSegment[] | null,
      })) as WorkSummaryWithWorker[];
    },
  });
}

// Get summary history for a specific worker and date (all revisions)
export function useWorkerSummaryHistory(workerId: string, date: Date) {
  return useQuery({
    queryKey: ['work-summary-history', workerId, format(date, 'yyyy-MM-dd')],
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
        .eq('worker_id', workerId)
        .eq('work_date', format(date, 'yyyy-MM-dd'))
        .order('revision', { ascending: false });

      if (error) throw error;
      
      return (data || []).map(item => ({
        ...item,
        segments_json: item.segments_json as unknown as WorkSegment[] | null,
      })) as WorkSummaryWithWorker[];
    },
    enabled: !!workerId,
  });
}

// Get current summary for a specific worker and date
export function useWorkerSummary(workerId: string, date: Date) {
  return useQuery({
    queryKey: ['work-summary', workerId, format(date, 'yyyy-MM-dd')],
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
        .eq('worker_id', workerId)
        .eq('work_date', format(date, 'yyyy-MM-dd'))
        .eq('is_current', true)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      
      return {
        ...data,
        segments_json: data.segments_json as unknown as WorkSegment[] | null,
      } as WorkSummaryWithWorker;
    },
    enabled: !!workerId,
  });
}

// Get events for a specific worker and date (for detail view)
export function useWorkerDayEventsForDate(workerId: string, date: Date) {
  return useQuery({
    queryKey: ['worker-day-events-date', workerId, format(date, 'yyyy-MM-dd')],
    queryFn: async () => {
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);

      const { data, error } = await supabase
        .from('work_events')
        .select('*')
        .eq('worker_id', workerId)
        .gte('occurred_at', dayStart.toISOString())
        .lte('occurred_at', dayEnd.toISOString())
        .order('occurred_at', { ascending: true });

      if (error) throw error;
      return data as WorkEvent[];
    },
    enabled: !!workerId,
  });
}

// Lock a summary to prevent recalculation
export function useLockSummary() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ summaryId, userId }: { summaryId: string; userId: string }) => {
      const { data, error } = await supabase
        .from('work_summaries')
        .update({
          locked: true,
          locked_by: userId,
          locked_at: new Date().toISOString(),
        })
        .eq('id', summaryId)
        .eq('is_current', true)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-summaries'] });
      queryClient.invalidateQueries({ queryKey: ['work-summary'] });
      toast({
        title: 'Résumé verrouillé',
        description: 'Ce résumé ne peut plus être recalculé',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur de verrouillage',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Unlock a summary (admin override)
export function useUnlockSummary() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ summaryId }: { summaryId: string }) => {
      const { data, error } = await supabase
        .from('work_summaries')
        .update({
          locked: false,
          locked_by: null,
          locked_at: null,
        })
        .eq('id', summaryId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-summaries'] });
      queryClient.invalidateQueries({ queryKey: ['work-summary'] });
      toast({
        title: 'Résumé déverrouillé',
        description: 'Ce résumé peut maintenant être recalculé',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur de déverrouillage',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Calculate and save summary for a worker's day (with versioning)
export function useCalculateSummary() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      workerId, 
      date, 
      autoCloseHour = 18,
      autoCloseMinute = 0 
    }: { 
      workerId: string; 
      date: Date;
      autoCloseHour?: number;
      autoCloseMinute?: number;
    }) => {
      const workDateStr = format(date, 'yyyy-MM-dd');

      // Get worker with category
      const { data: worker, error: workerError } = await supabase
        .from('workers')
        .select(`
          id,
          categories (
            id,
            taux_horaire,
            devise
          )
        `)
        .eq('id', workerId)
        .single();

      if (workerError || !worker) throw new Error('Travailleur non trouvé');
      if (!worker.categories) throw new Error('Catégorie non trouvée');

      // Check for existing current summary
      const { data: existingSummary } = await supabase
        .from('work_summaries')
        .select('id, revision, locked, locked_by, locked_at')
        .eq('worker_id', workerId)
        .eq('work_date', workDateStr)
        .eq('is_current', true)
        .maybeSingle();

      // BUILD #1: Check lock before proceeding
      if (existingSummary?.locked) {
        throw new SummaryLockError(
          existingSummary.id,
          existingSummary.locked_by,
          existingSummary.locked_at
        );
      }

      // Get events for the day
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);

      const { data: events, error: eventsError } = await supabase
        .from('work_events')
        .select('*')
        .eq('worker_id', workerId)
        .gte('occurred_at', dayStart.toISOString())
        .lte('occurred_at', dayEnd.toISOString())
        .order('occurred_at', { ascending: true });

      if (eventsError) throw eventsError;
      if (!events?.length) throw new Error('Aucun événement pour cette journée');

      // BUILD #1: Get corrections for the day
      const { data: corrections, error: correctionsError } = await supabase
        .from('correction_events')
        .select('*')
        .eq('worker_id', workerId)
        .eq('work_date', workDateStr);

      if (correctionsError) throw correctionsError;

      // Calculate with corrections applied
      const result = calculateWorkerDay(
        events as WorkEvent[],
        (corrections || []) as CorrectionEvent[],
        {
          taux_horaire: worker.categories.taux_horaire,
          devise: worker.categories.devise,
        },
        date,
        autoCloseHour,
        autoCloseMinute
      );

      if (!result.success || !result.summary) {
        throw new Error(result.error || 'Calcul échoué');
      }

      // BUILD #1: Versioning - mark old as not current, create new version
      const newRevision = existingSummary ? existingSummary.revision + 1 : 1;

      if (existingSummary) {
        // Mark old version as not current
        const { error: updateError } = await supabase
          .from('work_summaries')
          .update({ is_current: false })
          .eq('id', existingSummary.id);

        if (updateError) throw updateError;
      }

      // Insert new version
      const { data: savedSummary, error: saveError } = await supabase
        .from('work_summaries')
        .insert([{
          worker_id: result.summary.worker_id,
          work_date: result.summary.work_date,
          total_work_minutes: result.summary.total_work_minutes,
          total_pause_minutes: result.summary.total_pause_minutes,
          total_amount: result.summary.total_amount,
          devise: result.summary.devise,
          taux_horaire_applied: result.summary.taux_horaire_applied,
          auto_closed: result.summary.auto_closed,
          auto_close_time: result.summary.auto_close_time,
          calculation_version: CALCULATION_VERSION,
          events_used: result.summary.events_used,
          segments_json: result.summary.segments_json as unknown as null,
          notes: result.summary.notes,
          // BUILD #1: Versioning fields
          revision: newRevision,
          is_current: true,
          supersedes_id: existingSummary?.id || null,
          locked: false,
          locked_by: null,
          locked_at: null,
        }])
        .select()
        .single();

      if (saveError) throw saveError;

      return { 
        summary: savedSummary, 
        warnings: result.warnings,
        correctionsApplied: result.correctionsApplied || 0,
        isNewVersion: newRevision > 1,
        previousRevision: existingSummary?.revision || null,
      };
    },
    onSuccess: ({ correctionsApplied, isNewVersion }) => {
      queryClient.invalidateQueries({ queryKey: ['work-summaries'] });
      queryClient.invalidateQueries({ queryKey: ['work-summary'] });
      queryClient.invalidateQueries({ queryKey: ['work-summary-history'] });
      
      const description = isNewVersion
        ? `Nouvelle version créée${correctionsApplied > 0 ? ` (${correctionsApplied} corrections appliquées)` : ''}`
        : `Résumé calculé${correctionsApplied > 0 ? ` (${correctionsApplied} corrections appliquées)` : ''}`;
      
      toast({
        title: 'Calcul effectué',
        description,
      });
    },
    onError: (error: Error) => {
      const isLockError = error instanceof SummaryLockError;
      toast({
        title: isLockError ? 'Résumé verrouillé' : 'Erreur de calcul',
        description: isLockError 
          ? 'Ce résumé est verrouillé et ne peut pas être recalculé'
          : error.message,
        variant: 'destructive',
      });
    },
  });
}

// Batch calculate summaries for all workers on a date (with versioning)
export function useBatchCalculateSummaries() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      date,
      autoCloseHour = 18,
      autoCloseMinute = 0 
    }: { 
      date: Date;
      autoCloseHour?: number;
      autoCloseMinute?: number;
    }) => {
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);
      const workDateStr = format(date, 'yyyy-MM-dd');

      // Get all trusted events for the day
      const { data: events, error: eventsError } = await supabase
        .from('work_events')
        .select('*')
        .eq('trust_status', 'trusted')
        .gte('occurred_at', dayStart.toISOString())
        .lte('occurred_at', dayEnd.toISOString());

      if (eventsError) throw eventsError;
      if (!events?.length) return { calculated: 0, errors: 0, locked: 0 };

      // Group events by worker
      const eventsByWorker = new Map<string, WorkEvent[]>();
      for (const event of events) {
        const existing = eventsByWorker.get(event.worker_id) || [];
        existing.push(event as WorkEvent);
        eventsByWorker.set(event.worker_id, existing);
      }

      // Get all workers with categories
      const workerIds = Array.from(eventsByWorker.keys());
      const { data: workers, error: workersError } = await supabase
        .from('workers')
        .select(`
          id,
          categories (
            id,
            taux_horaire,
            devise
          )
        `)
        .in('id', workerIds);

      if (workersError) throw workersError;

      // Get existing current summaries for the date
      const { data: existingSummaries } = await supabase
        .from('work_summaries')
        .select('id, worker_id, revision, locked, locked_by, locked_at')
        .eq('work_date', workDateStr)
        .eq('is_current', true)
        .in('worker_id', workerIds);

      const existingByWorker = new Map(
        (existingSummaries || []).map(s => [s.worker_id, s])
      );

      // Get all corrections for the date
      const { data: allCorrections } = await supabase
        .from('correction_events')
        .select('*')
        .eq('work_date', workDateStr)
        .in('worker_id', workerIds);

      const correctionsByWorker = new Map<string, CorrectionEvent[]>();
      for (const correction of allCorrections || []) {
        const existing = correctionsByWorker.get(correction.worker_id) || [];
        existing.push(correction as CorrectionEvent);
        correctionsByWorker.set(correction.worker_id, existing);
      }

      let calculated = 0;
      let errors = 0;
      let locked = 0;

      for (const worker of workers || []) {
        if (!worker.categories) continue;

        const workerEvents = eventsByWorker.get(worker.id);
        if (!workerEvents?.length) continue;

        const existingSummary = existingByWorker.get(worker.id);
        
        // BUILD #1: Skip locked summaries
        if (existingSummary?.locked) {
          locked++;
          continue;
        }

        const workerCorrections = correctionsByWorker.get(worker.id) || [];

        const result = calculateWorkerDay(
          workerEvents,
          workerCorrections,
          {
            taux_horaire: worker.categories.taux_horaire,
            devise: worker.categories.devise,
          },
          date,
          autoCloseHour,
          autoCloseMinute
        );

        if (result.success && result.summary) {
          const newRevision = existingSummary ? existingSummary.revision + 1 : 1;

          // Mark old version as not current
          if (existingSummary) {
            await supabase
              .from('work_summaries')
              .update({ is_current: false })
              .eq('id', existingSummary.id);
          }

          // Insert new version
          const { error } = await supabase
            .from('work_summaries')
            .insert([{
              worker_id: result.summary.worker_id,
              work_date: result.summary.work_date,
              total_work_minutes: result.summary.total_work_minutes,
              total_pause_minutes: result.summary.total_pause_minutes,
              total_amount: result.summary.total_amount,
              devise: result.summary.devise,
              taux_horaire_applied: result.summary.taux_horaire_applied,
              auto_closed: result.summary.auto_closed,
              auto_close_time: result.summary.auto_close_time,
              calculation_version: CALCULATION_VERSION,
              events_used: result.summary.events_used,
              segments_json: result.summary.segments_json as unknown as null,
              notes: result.summary.notes,
              revision: newRevision,
              is_current: true,
              supersedes_id: existingSummary?.id || null,
              locked: false,
              locked_by: null,
              locked_at: null,
            }]);

          if (error) errors++;
          else calculated++;
        } else {
          errors++;
        }
      }

      return { calculated, errors, locked };
    },
    onSuccess: ({ calculated, errors, locked }) => {
      queryClient.invalidateQueries({ queryKey: ['work-summaries'] });
      queryClient.invalidateQueries({ queryKey: ['work-summary-history'] });
      
      let description = `${calculated} résumés calculés`;
      if (errors > 0) description += `, ${errors} erreurs`;
      if (locked > 0) description += `, ${locked} verrouillés (ignorés)`;
      
      toast({
        title: 'Calcul batch terminé',
        description,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur batch',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Export summaries to CSV
export function exportSummariesToCSV(summaries: WorkSummaryWithWorker[], fileName: string) {
  const headers = [
    'Date',
    'Matricule',
    'Nom',
    'Catégorie',
    'Heures travaillées',
    'Minutes travaillées',
    'Pauses (min)',
    'Taux horaire',
    'Montant',
    'Devise',
    'Auto-clôturé',
    'Version calcul',
    'Révision',
    'Verrouillé',
  ];

  const rows = summaries.map(s => [
    s.work_date,
    s.workers?.matricule || 'N/A',
    s.workers?.nom_affiche || 'N/A',
    s.workers?.categories?.nom || 'N/A',
    Math.floor(s.total_work_minutes / 60),
    s.total_work_minutes,
    s.total_pause_minutes,
    s.taux_horaire_applied,
    s.total_amount,
    s.devise,
    s.auto_closed ? 'Oui' : 'Non',
    s.calculation_version,
    s.revision,
    s.locked ? 'Oui' : 'Non',
  ]);

  const csvContent = [
    headers.join(';'),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(';'))
  ].join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
}
