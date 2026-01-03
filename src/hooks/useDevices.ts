import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Device {
  id: string;
  device_id: string;
  device_secret: string;
  label: string | null;
  site_id: string | null;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeviceInsert {
  device_id: string;
  device_secret: string;
  label?: string | null;
  site_id?: string | null;
}

// Get all enrolled devices (admin only)
export function useDevices() {
  return useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Device[];
    },
  });
}

// Check if a device is enrolled and active
export async function checkDeviceTrust(
  deviceId: string, 
  deviceSecret: string
): Promise<{ trusted: boolean; reason: string }> {
  if (!deviceSecret) {
    return { trusted: false, reason: 'missing_secret' };
  }

  const { data, error } = await supabase
    .from('devices')
    .select('actif')
    .eq('device_id', deviceId)
    .eq('device_secret', deviceSecret)
    .maybeSingle();
  
  if (error) {
    console.error('[Device Trust] Error checking device:', error);
    return { trusted: false, reason: 'check_error' };
  }
  
  if (!data) {
    return { trusted: false, reason: 'unknown_device' };
  }
  
  if (!data.actif) {
    return { trusted: false, reason: 'device_disabled' };
  }
  
  return { trusted: true, reason: 'device_matched' };
}

// Enroll a new device (admin only)
export function useEnrollDevice() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (device: DeviceInsert) => {
      const { data, error } = await supabase
        .from('devices')
        .insert(device)
        .select()
        .single();
      
      if (error) throw error;
      return data as Device;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast({
        title: 'Appareil enrôlé',
        description: "L'appareil a été enregistré avec succès.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur d'enrôlement",
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Update device (activate/deactivate, change label)
export function useUpdateDevice() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      id, 
      updates 
    }: { 
      id: string; 
      updates: Partial<Pick<Device, 'actif' | 'label' | 'site_id'>> 
    }) => {
      const { data, error } = await supabase
        .from('devices')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Device;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast({
        title: 'Appareil mis à jour',
        description: "L'appareil a été modifié avec succès.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur de mise à jour',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
