import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  WorkEvent, 
  WorkEventWithWorker, 
  WorkEventType, 
  ALLOWED_TRANSITIONS 
} from '@/types/work-events';
import { getDeviceId } from '@/lib/storage';

interface WorkEventInsert {
  worker_id: string;
  event_type: WorkEventType;
  snapshot_url?: string | null;
  snapshot_hash?: string | null;
  incident_flag?: string | null;
}

// Get the last event for a worker (to determine allowed transitions)
export function useLastWorkerEvent(workerId: string | undefined) {
  return useQuery({
    queryKey: ['last-work-event', workerId],
    queryFn: async () => {
      if (!workerId) return null;
      
      // Get today's date at midnight
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data, error } = await supabase
        .from('work_events')
        .select('*')
        .eq('worker_id', workerId)
        .gte('occurred_at', today.toISOString())
        .order('occurred_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data as WorkEvent | null;
    },
    enabled: !!workerId,
  });
}

// Get allowed actions for a worker based on their last event
export function useAllowedActions(workerId: string | undefined) {
  const { data: lastEvent, isLoading } = useLastWorkerEvent(workerId);
  
  const lastEventType = lastEvent?.event_type as WorkEventType | undefined;
  const currentState: WorkEventType | 'NONE' = lastEventType || 'NONE';
  const allowedActions = ALLOWED_TRANSITIONS[currentState];
  
  return {
    allowedActions,
    lastEvent,
    isLoading,
    currentState,
  };
}

// Get today's events for a worker
export function useWorkerDayEvents(workerId: string | undefined) {
  return useQuery({
    queryKey: ['worker-day-events', workerId],
    queryFn: async () => {
      if (!workerId) return [];
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data, error } = await supabase
        .from('work_events')
        .select('*')
        .eq('worker_id', workerId)
        .gte('occurred_at', today.toISOString())
        .order('occurred_at', { ascending: true });
      
      if (error) throw error;
      return data as WorkEvent[];
    },
    enabled: !!workerId,
  });
}

// Get all events for today (admin view)
export function useTodayEvents() {
  return useQuery({
    queryKey: ['today-events'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data, error } = await supabase
        .from('work_events')
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
        .gte('occurred_at', today.toISOString())
        .order('occurred_at', { ascending: false });
      
      if (error) throw error;
      return data as WorkEventWithWorker[];
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });
}

// Get events for a specific date range (for export)
export function useDateRangeEvents(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ['events-range', startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_events')
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
        .gte('occurred_at', startDate.toISOString())
        .lte('occurred_at', endDate.toISOString())
        .order('occurred_at', { ascending: true });
      
      if (error) throw error;
      return data as WorkEventWithWorker[];
    },
    enabled: !!startDate && !!endDate,
  });
}

// Create a new work event
export function useCreateWorkEvent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (event: WorkEventInsert) => {
      const deviceId = getDeviceId();
      
      const { data, error } = await supabase
        .from('work_events')
        .insert({
          worker_id: event.worker_id,
          event_type: event.event_type,
          device_id: deviceId,
          snapshot_url: event.snapshot_url,
          snapshot_hash: event.snapshot_hash,
          incident_flag: event.incident_flag,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as WorkEvent;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['last-work-event'] });
      queryClient.invalidateQueries({ queryKey: ['worker-day-events'] });
      queryClient.invalidateQueries({ queryKey: ['today-events'] });
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

// Upload snapshot to storage
export async function uploadSnapshot(
  blob: Blob,
  deviceId: string,
  workerId: string,
  eventId: string
): Promise<{ url: string; hash: string }> {
  const date = new Date().toISOString().split('T')[0];
  const filePath = `${deviceId}/${date}/${workerId}/${eventId}.webp`;
  
  const { error: uploadError } = await supabase.storage
    .from('work-snapshots')
    .upload(filePath, blob, { 
      contentType: 'image/webp',
      upsert: false // Never overwrite snapshots
    });

  if (uploadError) throw uploadError;

  // Generate a simple hash (timestamp + size based)
  const hash = `${Date.now()}-${blob.size}`;

  // Get URL (signed URL for private bucket)
  const { data } = await supabase.storage
    .from('work-snapshots')
    .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year

  return {
    url: data?.signedUrl || filePath,
    hash,
  };
}
