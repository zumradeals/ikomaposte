import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  WorkEvent, 
  WorkEventWithWorker, 
  WorkEventType, 
  TrustStatus,
  ALLOWED_TRANSITIONS 
} from '@/types/work-events';
import { getDeviceId, getDeviceSecret } from '@/lib/storage';
import { checkDeviceTrust } from './useDevices';

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
export function useTodayEvents(trustFilter?: TrustStatus | 'all') {
  return useQuery({
    queryKey: ['today-events', trustFilter],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let query = supabase
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
      
      // Apply trust filter if specified
      if (trustFilter && trustFilter !== 'all') {
        query = query.eq('trust_status', trustFilter);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as WorkEventWithWorker[];
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });
}

// Get events for a specific date range (for export)
export function useDateRangeEvents(startDate: Date, endDate: Date, trustFilter?: TrustStatus | 'all') {
  return useQuery({
    queryKey: ['events-range', startDate.toISOString(), endDate.toISOString(), trustFilter],
    queryFn: async () => {
      let query = supabase
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
      
      if (trustFilter && trustFilter !== 'all') {
        query = query.eq('trust_status', trustFilter);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as WorkEventWithWorker[];
    },
    enabled: !!startDate && !!endDate,
  });
}

// Create a new work event with trust validation
export function useCreateWorkEvent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (event: WorkEventInsert) => {
      const deviceId = getDeviceId();
      const deviceSecret = getDeviceSecret();
      const clientOccurredAt = new Date().toISOString();
      
      // Check device trust
      const trustResult = await checkDeviceTrust(deviceId, deviceSecret);
      
      const { data, error } = await supabase
        .from('work_events')
        .insert({
          worker_id: event.worker_id,
          event_type: event.event_type,
          device_id: deviceId,
          device_secret: deviceSecret,
          snapshot_url: event.snapshot_url,
          snapshot_hash: event.snapshot_hash,
          incident_flag: event.incident_flag,
          trust_status: trustResult.trusted ? 'trusted' : 'untrusted',
          trust_reason: trustResult.reason,
          client_occurred_at: clientOccurredAt,
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
// Returns the file PATH (not URL) for storage in work_events.snapshot_url
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

  // Return the file PATH (not signed URL)
  // The admin interface will generate signed URLs when displaying
  return {
    url: filePath, // Store PATH, not URL
    hash,
  };
}
