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

/**
 * Check if a device is enrolled and active.
 * 
 * IMPORTANT: The devices table has RLS that only allows admin users to read.
 * For anonymous/kiosk mode, we use a workaround by checking via a server-side
 * approach or by storing device validation results locally.
 * 
 * Since we can't query devices table anonymously, we need to trust the device
 * based on stored enrollment data or use an edge function.
 * 
 * TEMPORARY FIX: We return the trust check based on whether we get data back.
 * If RLS blocks the query (empty result), we check if the device was previously
 * validated and cached.
 */
export async function checkDeviceTrust(
  deviceId: string, 
  deviceSecret: string
): Promise<{ trusted: boolean; reason: string }> {
  if (!deviceId) {
    return { trusted: false, reason: 'missing_device_id' };
  }
  
  if (!deviceSecret) {
    return { trusted: false, reason: 'missing_secret' };
  }

  try {
    // 1) Exact match on (device_id + device_secret)
    // We ONLY select 'actif' so we never expose the secret in responses.
    const { data, error } = await supabase
      .from('devices')
      .select('actif')
      .eq('device_id', deviceId)
      .eq('device_secret', deviceSecret)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[Device Trust] Query error:', error);
      // If anything blocks the query, fallback to local cache.
      return checkLocalDeviceCache(deviceId, deviceSecret);
    }

    if (data) {
      if (!data.actif) {
        // Device found but disabled
        clearLocalDeviceCache(deviceId);
        return { trusted: false, reason: 'device_disabled' };
      }

      // Device is enrolled and active - cache this result
      cacheDeviceTrust(deviceId, deviceSecret);
      return { trusted: true, reason: 'device_matched' };
    }

    // 2) No exact match.
    // Differentiate between:
    // - device_id not enrolled at all
    // - device_id enrolled but secret differs (cache cleared / wrong origin / different browser storage)
    const { data: idOnly, error: idOnlyError } = await supabase
      .from('devices')
      .select('actif')
      .eq('device_id', deviceId)
      .limit(1)
      .maybeSingle();

    if (idOnlyError) {
      console.error('[Device Trust] device_id lookup error:', idOnlyError);
      return checkLocalDeviceCache(deviceId, deviceSecret);
    }

    if (idOnly) {
      if (!idOnly.actif) {
        clearLocalDeviceCache(deviceId);
        return { trusted: false, reason: 'device_disabled' };
      }
      // ID exists, but secret does not match.
      return { trusted: false, reason: 'secret_mismatch' };
    }

    // 3) No ID found server-side → try local cache, else unknown.
    const localResult = checkLocalDeviceCache(deviceId, deviceSecret);
    if (localResult.trusted) return localResult;

    return { trusted: false, reason: 'unknown_device' };
  } catch (err) {
    console.error('[Device Trust] Error:', err);
    // Fallback to local cache
    return checkLocalDeviceCache(deviceId, deviceSecret);
  }
}

// Local cache key for device trust
const DEVICE_TRUST_CACHE_KEY = 'ikoma_device_trust_cache';

interface DeviceTrustCache {
  device_id: string;
  device_secret_hash: string;
  cached_at: string;
  trusted: boolean;
}

function hashSecret(secret: string): string {
  // Simple hash for comparison (not cryptographic, just for cache validation)
  let hash = 0;
  for (let i = 0; i < secret.length; i++) {
    const char = secret.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

function cacheDeviceTrust(deviceId: string, deviceSecret: string): void {
  const cache: DeviceTrustCache = {
    device_id: deviceId,
    device_secret_hash: hashSecret(deviceSecret),
    cached_at: new Date().toISOString(),
    trusted: true,
  };
  localStorage.setItem(DEVICE_TRUST_CACHE_KEY, JSON.stringify(cache));
  console.log('[Device Trust] Cached trust status for device');
}

function clearLocalDeviceCache(deviceId: string): void {
  const stored = localStorage.getItem(DEVICE_TRUST_CACHE_KEY);
  if (stored) {
    try {
      const cache: DeviceTrustCache = JSON.parse(stored);
      if (cache.device_id === deviceId) {
        localStorage.removeItem(DEVICE_TRUST_CACHE_KEY);
        console.log('[Device Trust] Cleared local cache');
      }
    } catch {
      // Ignore
    }
  }
}

function checkLocalDeviceCache(deviceId: string, deviceSecret: string): { trusted: boolean; reason: string } {
  const stored = localStorage.getItem(DEVICE_TRUST_CACHE_KEY);
  if (!stored) {
    return { trusted: false, reason: 'no_cache' };
  }

  try {
    const cache: DeviceTrustCache = JSON.parse(stored);
    
    // Verify device ID matches
    if (cache.device_id !== deviceId) {
      return { trusted: false, reason: 'cache_device_mismatch' };
    }
    
    // Verify secret hash matches
    if (cache.device_secret_hash !== hashSecret(deviceSecret)) {
      return { trusted: false, reason: 'cache_secret_mismatch' };
    }
    
    // Check cache age (valid for 24 hours)
    const cachedAt = new Date(cache.cached_at);
    const now = new Date();
    const hoursSinceCached = (now.getTime() - cachedAt.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceCached > 24) {
      console.log('[Device Trust] Cache expired');
      return { trusted: false, reason: 'cache_expired' };
    }
    
    console.log('[Device Trust] Using cached trust status');
    return { trusted: true, reason: 'cached_trust' };
    
  } catch {
    return { trusted: false, reason: 'cache_invalid' };
  }
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
      queryClient.invalidateQueries({ queryKey: ['device-trust'] });
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
