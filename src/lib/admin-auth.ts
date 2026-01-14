// Admin PIN verification via secure Edge Function
// No PIN is stored client-side - all verification happens server-side

import { supabase } from '@/integrations/supabase/client';
import { getDeviceId } from '@/lib/storage';

interface VerifyPinResponse {
  ok: boolean;
  reason?: string;
  session_duration_ms?: number;
}

export async function verifyAdminPin(pin: string): Promise<{ success: boolean; sessionDurationMs: number; reason?: string }> {
  const deviceId = getDeviceId();
  
  try {
    const { data, error } = await supabase.functions.invoke<VerifyPinResponse>('verify-admin-pin', {
      body: {
        pin,
        device_id: deviceId,
        scope: 'global',
      },
    });

    if (error) {
      console.error('[Admin Auth] Edge function error:', error);
      return { 
        success: false, 
        sessionDurationMs: 0, 
        reason: 'CONNECTION_ERROR' 
      };
    }

    if (!data) {
      return { 
        success: false, 
        sessionDurationMs: 0, 
        reason: 'EMPTY_RESPONSE' 
      };
    }

    return {
      success: data.ok,
      sessionDurationMs: data.session_duration_ms || 10 * 60 * 1000,
      reason: data.reason,
    };
  } catch (err) {
    console.error('[Admin Auth] Verification error:', err);
    return { 
      success: false, 
      sessionDurationMs: 0, 
      reason: 'NETWORK_ERROR' 
    };
  }
}

export async function rotateAdminPin(currentPin: string, newPin: string): Promise<{ success: boolean; reason?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return { success: false, reason: 'NOT_AUTHENTICATED' };
    }

    const { data, error } = await supabase.functions.invoke('rotate-admin-pin', {
      body: {
        current_pin: currentPin,
        new_pin: newPin,
        scope: 'global',
      },
    });

    if (error) {
      console.error('[Admin Auth] Rotate error:', error);
      return { success: false, reason: 'CONNECTION_ERROR' };
    }

    return {
      success: data?.ok || false,
      reason: data?.reason,
    };
  } catch (err) {
    console.error('[Admin Auth] Rotate error:', err);
    return { success: false, reason: 'NETWORK_ERROR' };
  }
}

export async function initAdminPin(pin: string, force = false): Promise<{ success: boolean; reason?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return { success: false, reason: 'NOT_AUTHENTICATED' };
    }

    const { data, error } = await supabase.functions.invoke('init-admin-pin', {
      body: {
        pin,
        scope: 'global',
        force,
      },
    });

    if (error) {
      console.error('[Admin Auth] Init error:', error);
      return { success: false, reason: 'CONNECTION_ERROR' };
    }

    return {
      success: data?.ok || false,
      reason: data?.reason,
    };
  } catch (err) {
    console.error('[Admin Auth] Init error:', err);
    return { success: false, reason: 'NETWORK_ERROR' };
  }
}

export function getAdminSessionDuration(): number {
  // Default 10 minutes - actual duration comes from server
  return 10 * 60 * 1000;
}

// Log admin logout event
export async function logAdminLogout(deviceId: string): Promise<void> {
  try {
    // This is a best-effort log - we don't block on it
    await supabase.functions.invoke('verify-admin-pin', {
      body: {
        pin: '0000', // Dummy - will fail but we just want to log
        device_id: deviceId,
        scope: 'global',
      },
    });
  } catch {
    // Ignore errors for logout logging
  }
}
