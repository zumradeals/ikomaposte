import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  CorrectionEvent, 
  CorrectionInsert, 
  DetectedAnomaly, 
  DaySummary,
  AnomalyType 
} from '@/types/corrections';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';

// Fetch all corrections for a date range
export function useCorrections(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['corrections', startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from('correction_events')
        .select('*')
        .order('created_at', { ascending: false });

      if (startDate) {
        query = query.gte('work_date', startDate);
      }
      if (endDate) {
        query = query.lte('work_date', endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CorrectionEvent[];
    },
    enabled: true,
  });
}

// Fetch corrections for a specific worker and date
export function useWorkerDateCorrections(workerId: string, workDate: string) {
  return useQuery({
    queryKey: ['corrections', workerId, workDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('correction_events')
        .select('*')
        .eq('worker_id', workerId)
        .eq('work_date', workDate)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as CorrectionEvent[];
    },
    enabled: !!workerId && !!workDate,
  });
}

// Create a new correction
// Create a new correction
export function useCreateCorrection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (correction: CorrectionInsert) => {
      const { data, error } = await supabase
        .from('correction_events')
        .insert([correction])
        .select()
        .single();

      if (error) throw error;
      return data as CorrectionEvent;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['corrections'] });
      queryClient.invalidateQueries({ queryKey: ['anomalies'] });
      queryClient.invalidateQueries({ queryKey: ['work-summaries'] });
      toast({
        title: 'Correction enregistrée',
        description: `Correction appliquée pour le ${format(parseISO(data.work_date), 'dd/MM/yyyy')}`,
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

// Detect anomalies in work events
export function useDetectAnomalies(date?: string) {
  return useQuery({
    queryKey: ['anomalies', date],
    queryFn: async () => {
      // Fetch trusted work events for the date
      let eventsQuery = supabase
        .from('work_events')
        .select(`
          id,
          worker_id,
          event_type,
          occurred_at,
          trust_status
        `)
        .eq('trust_status', 'trusted')
        .order('occurred_at', { ascending: true });

      if (date) {
        const dayStart = startOfDay(parseISO(date)).toISOString();
        const dayEnd = endOfDay(parseISO(date)).toISOString();
        eventsQuery = eventsQuery.gte('occurred_at', dayStart).lte('occurred_at', dayEnd);
      }

      const { data: events, error: eventsError } = await eventsQuery;
      if (eventsError) throw eventsError;

      // Fetch workers for names
      const { data: workers, error: workersError } = await supabase
        .from('workers')
        .select('id, nom_affiche');
      if (workersError) throw workersError;

      const workerMap = new Map(workers?.map(w => [w.id, w.nom_affiche]) || []);

      // Fetch existing corrections
      let correctionsQuery = supabase
        .from('correction_events')
        .select('*');
      
      if (date) {
        correctionsQuery = correctionsQuery.eq('work_date', date);
      }

      const { data: corrections, error: correctionsError } = await correctionsQuery;
      if (correctionsError) throw correctionsError;

      // Group events by worker and date
      const groupedEvents = new Map<string, typeof events>();
      
      for (const event of events || []) {
        const eventDate = format(parseISO(event.occurred_at), 'yyyy-MM-dd');
        const key = `${event.worker_id}|${eventDate}`;
        
        if (!groupedEvents.has(key)) {
          groupedEvents.set(key, []);
        }
        groupedEvents.get(key)!.push(event);
      }

      // Detect anomalies
      const anomalies: DetectedAnomaly[] = [];

      for (const [key, dayEvents] of groupedEvents) {
        const [workerId, workDate] = key.split('|');
        const workerName = workerMap.get(workerId) || 'Inconnu';
        
        const detected = detectDayAnomalies(dayEvents, workerId, workerName, workDate);
        anomalies.push(...detected);
      }

      // Build day summaries
      const summaries: DaySummary[] = [];
      const processedKeys = new Set<string>();

      for (const [key, dayEvents] of groupedEvents) {
        const [workerId, workDate] = key.split('|');
        const workerName = workerMap.get(workerId) || 'Inconnu';
        
        const dayAnomalies = anomalies.filter(
          a => a.worker_id === workerId && a.work_date === workDate
        );
        
        const dayCorrections = (corrections || []).filter(
          c => c.worker_id === workerId && c.work_date === workDate
        ) as CorrectionEvent[];

        // Determine status
        let status: DaySummary['status'] = 'healthy';
        if (dayAnomalies.length > 0) {
          // Check if all anomalies are covered by corrections
          const correctedTypes = new Set(dayCorrections.map(c => c.anomaly_type));
          const uncorrectedAnomalies = dayAnomalies.filter(
            a => !correctedTypes.has(a.anomaly_type)
          );
          
          if (uncorrectedAnomalies.length > 0) {
            status = 'incoherent';
          } else {
            status = 'corrected';
          }
        }

        summaries.push({
          worker_id: workerId,
          worker_name: workerName,
          work_date: workDate,
          status,
          anomalies: dayAnomalies,
          corrections: dayCorrections,
          events: dayEvents.map(e => ({
            id: e.id,
            event_type: e.event_type,
            occurred_at: e.occurred_at,
            trust_status: e.trust_status,
          })),
        });

        processedKeys.add(key);
      }

      return {
        anomalies,
        summaries: summaries.sort((a, b) => {
          // Sort by status priority (incoherent first), then by date desc
          const statusOrder = { incoherent: 0, corrected: 1, healthy: 2 };
          const statusDiff = statusOrder[a.status] - statusOrder[b.status];
          if (statusDiff !== 0) return statusDiff;
          return b.work_date.localeCompare(a.work_date);
        }),
      };
    },
    enabled: true,
  });
}

// Helper function to detect anomalies in a day's events
function detectDayAnomalies(
  events: Array<{ id: string; event_type: string; occurred_at: string }>,
  workerId: string,
  workerName: string,
  workDate: string
): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = [];
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
  );

  if (sortedEvents.length === 0) return anomalies;

  // Check for missing TAKE at start
  if (sortedEvents[0].event_type !== 'TAKE') {
    anomalies.push({
      worker_id: workerId,
      worker_name: workerName,
      work_date: workDate,
      anomaly_type: 'missing_take',
      description: 'La journée ne commence pas par une prise de poste (TAKE)',
      events: sortedEvents,
    });
  }

  // Check for missing END at end
  const lastEvent = sortedEvents[sortedEvents.length - 1];
  if (lastEvent.event_type !== 'END') {
    anomalies.push({
      worker_id: workerId,
      worker_name: workerName,
      work_date: workDate,
      anomaly_type: 'missing_end',
      description: 'La journée ne se termine pas par une fin de poste (END)',
      events: sortedEvents,
    });
  }

  // Check for duplicate events
  const takeEvents = sortedEvents.filter(e => e.event_type === 'TAKE');
  if (takeEvents.length > 1) {
    anomalies.push({
      worker_id: workerId,
      worker_name: workerName,
      work_date: workDate,
      anomaly_type: 'duplicate_take',
      description: `${takeEvents.length} prises de poste détectées`,
      events: sortedEvents,
    });
  }

  const endEvents = sortedEvents.filter(e => e.event_type === 'END');
  if (endEvents.length > 1) {
    anomalies.push({
      worker_id: workerId,
      worker_name: workerName,
      work_date: workDate,
      anomaly_type: 'duplicate_end',
      description: `${endEvents.length} fins de poste détectées`,
      events: sortedEvents,
    });
  }

  // Check for invalid sequence (PAUSE without RESUME, etc.)
  let state: 'idle' | 'working' | 'paused' = 'idle';
  for (const event of sortedEvents) {
    const type = event.event_type;

    if (type === 'TAKE') {
      if (state !== 'idle') {
        // Already working
      }
      state = 'working';
    } else if (type === 'PAUSE') {
      if (state !== 'working') {
        anomalies.push({
          worker_id: workerId,
          worker_name: workerName,
          work_date: workDate,
          anomaly_type: 'orphan_pause',
          description: 'Pause sans prise de poste préalable',
          events: sortedEvents,
        });
      }
      state = 'paused';
    } else if (type === 'RESUME') {
      if (state !== 'paused') {
        anomalies.push({
          worker_id: workerId,
          worker_name: workerName,
          work_date: workDate,
          anomaly_type: 'orphan_resume',
          description: 'Reprise sans pause préalable',
          events: sortedEvents,
        });
      }
      state = 'working';
    } else if (type === 'END') {
      if (state === 'idle') {
        anomalies.push({
          worker_id: workerId,
          worker_name: workerName,
          work_date: workDate,
          anomaly_type: 'invalid_sequence',
          description: 'Fin de poste sans prise préalable',
          events: sortedEvents,
        });
      }
      state = 'idle';
    }
  }

  // Deduplicate anomalies by type
  const uniqueAnomalies = new Map<AnomalyType, DetectedAnomaly>();
  for (const anomaly of anomalies) {
    if (!uniqueAnomalies.has(anomaly.anomaly_type)) {
      uniqueAnomalies.set(anomaly.anomaly_type, anomaly);
    }
  }

  return Array.from(uniqueAnomalies.values());
}
