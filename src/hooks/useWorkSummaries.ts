// Phase 4: Work Summaries Hooks

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { WorkSummary, WorkSummaryWithWorker, WorkSegment } from '@/types/work-summaries';
import { WorkEvent } from '@/types/work-events';
import { calculateWorkerDay } from '@/lib/work-calculator';
import { format, startOfDay, endOfDay } from 'date-fns';

// Get summaries for a date range
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

// Get summary for a specific worker and date
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

// Calculate and save summary for a worker's day
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

      // Calculate
      const result = calculateWorkerDay(
        events as WorkEvent[],
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

      // Delete existing summary if any
      await supabase
        .from('work_summaries')
        .delete()
        .eq('worker_id', workerId)
        .eq('work_date', format(date, 'yyyy-MM-dd'));

      // Insert new summary
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
          calculation_version: result.summary.calculation_version,
          events_used: result.summary.events_used,
          segments_json: result.summary.segments_json as unknown as null,
          notes: result.summary.notes,
        }])
        .select()
        .single();

      if (saveError) throw saveError;

      return { summary: savedSummary, warnings: result.warnings };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-summaries'] });
      queryClient.invalidateQueries({ queryKey: ['work-summary'] });
      toast({
        title: 'Calcul effectué',
        description: 'Le résumé a été calculé avec succès',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur de calcul',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Batch calculate summaries for all workers on a date
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

      // Get all trusted events for the day
      const { data: events, error: eventsError } = await supabase
        .from('work_events')
        .select('*')
        .eq('trust_status', 'trusted')
        .gte('occurred_at', dayStart.toISOString())
        .lte('occurred_at', dayEnd.toISOString());

      if (eventsError) throw eventsError;
      if (!events?.length) return { calculated: 0, errors: 0 };

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

      let calculated = 0;
      let errors = 0;

      for (const worker of workers || []) {
        if (!worker.categories) continue;

        const workerEvents = eventsByWorker.get(worker.id);
        if (!workerEvents?.length) continue;

        const result = calculateWorkerDay(
          workerEvents,
          {
            taux_horaire: worker.categories.taux_horaire,
            devise: worker.categories.devise,
          },
          date,
          autoCloseHour,
          autoCloseMinute
        );

        if (result.success && result.summary) {
          // Delete existing
          await supabase
            .from('work_summaries')
            .delete()
            .eq('worker_id', worker.id)
            .eq('work_date', format(date, 'yyyy-MM-dd'));

          // Insert new
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
              calculation_version: result.summary.calculation_version,
              events_used: result.summary.events_used,
              segments_json: result.summary.segments_json as unknown as null,
              notes: result.summary.notes,
            }]);

          if (error) errors++;
          else calculated++;
        } else {
          errors++;
        }
      }

      return { calculated, errors };
    },
    onSuccess: ({ calculated, errors }) => {
      queryClient.invalidateQueries({ queryKey: ['work-summaries'] });
      toast({
        title: 'Calcul batch terminé',
        description: `${calculated} résumés calculés, ${errors} erreurs`,
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
