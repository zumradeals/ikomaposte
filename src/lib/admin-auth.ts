// Admin PIN verification via secure Edge Function
// No PIN is stored client-side - all verification happens server-side

import { supabase } from '@/integrations/supabase/client';
import { getDeviceId } from '@/lib/storage';

interface VerifyPinResponse {
  ok: boolean;
  reason?: string;
  session_duration_ms?: number;
  retry_after_ms?: number;
  attempts_remaining?: number;
}

export interface VerifyResult {
  success: boolean;
  sessionDurationMs: number;
  reason?: string;
  retryAfterMs?: number;
  attemptsRemaining?: number;
}

export async function verifyAdminPin(pin: string): Promise<VerifyResult> {
  const deviceId = getDeviceId();
  
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const response = await fetch(`${supabaseUrl}/functions/v1/verify-admin-pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        pin,
        device_id: deviceId,
        scope: 'global',
      }),
    });

    if (!response.ok && response.status !== 200) {
      console.error('[Admin Auth] HTTP error:', response.status, response.statusText);
      return { 
        success: false, 
        sessionDurationMs: 0, 
        reason: 'CONNECTION_ERROR' 
      };
    }

    const data: VerifyPinResponse = await response.json();

    return {
      success: data.ok,
      sessionDurationMs: data.session_duration_ms || 10 * 60 * 1000,
      reason: data.reason,
      retryAfterMs: data.retry_after_ms,
      attemptsRemaining: data.attempts_remaining,
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
    // Ensure we have a fresh token; stale sessions can exist locally but be invalid server-side
    const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('[Admin Auth] Session error:', sessionError);
      return { success: false, reason: 'SESSION_ERROR' };
    }

    if (!initialSession) {
      return { success: false, reason: 'NOT_AUTHENTICATED' };
    }

    // Try to refresh session to avoid INVALID_TOKEN from backend
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    const session = refreshError ? initialSession : (refreshData.session ?? initialSession);

    if (refreshError) {
      console.warn('[Admin Auth] refreshSession failed (will try current token):', refreshError);
    }

    if (!session?.access_token) {
      // If we cannot get a usable token, force re-auth
      await supabase.auth.signOut({ scope: 'local' });
      return { success: false, reason: 'REAUTH_REQUIRED' };
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const response = await fetch(`${supabaseUrl}/functions/v1/rotate-admin-pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        current_pin: currentPin,
        new_pin: newPin,
        scope: 'global',
      }),
    });

    if (!response.ok && response.status !== 200) {
      console.error('[Admin Auth] Rotate HTTP error:', response.status);
      return { success: false, reason: 'CONNECTION_ERROR' };
    }

    const data = await response.json();

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
    // Important: stale sessions can exist locally (esp. PWA/mobile) while being invalid server-side.
    // We refresh first to avoid INVALID_TOKEN from the backend function.
    const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('[Admin Auth] Session error:', sessionError);
      return { success: false, reason: 'SESSION_ERROR' };
    }

    if (!initialSession) {
      console.error('[Admin Auth] No session available');
      return { success: false, reason: 'NOT_AUTHENTICATED' };
    }

    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    const session = refreshError ? initialSession : (refreshData.session ?? initialSession);

    if (refreshError) {
      console.warn('[Admin Auth] refreshSession failed (will try current token):', refreshError);
    }

    if (!session?.access_token) {
      console.error('[Admin Auth] No access token available');
      // Force re-auth to break out of invalid local auth state
      await supabase.auth.signOut({ scope: 'local' });
      return { success: false, reason: 'REAUTH_REQUIRED' };
    }

    // Use fetch directly to ensure Authorization header is sent
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const response = await fetch(`${supabaseUrl}/functions/v1/init-admin-pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        pin,
        scope: 'global',
        force,
      }),
    });

    if (!response.ok && response.status !== 200) {
      console.error('[Admin Auth] HTTP error:', response.status, response.statusText);
      return { success: false, reason: 'CONNECTION_ERROR' };
    }

    const data = await response.json();

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

// Format retry time for display
export function formatRetryTime(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.ceil((ms % 60000) / 1000);
  
  if (minutes > 0) {
    return `${minutes}min ${seconds}s`;
  }
  return `${seconds}s`;
}
