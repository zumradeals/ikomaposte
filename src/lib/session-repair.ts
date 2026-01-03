/**
 * Session Repair Utilities - Phase 4.5
 * Hard reset for auth issues on Chrome mobile
 */

import { supabase } from '@/integrations/supabase/client';

const PRESERVE_KEYS = ['ikoma_device_id', 'ikoma_device_secret'];

/**
 * Perform a hard session reset: sign out, clear storage (except device keys), reload
 */
export async function repairSession(): Promise<void> {
  console.log('[IKOMA] Starting session repair...');
  
  try {
    // 1. Sign out from Supabase
    await supabase.auth.signOut({ scope: 'local' });
    console.log('[IKOMA] Signed out');
  } catch (err) {
    console.warn('[IKOMA] Sign out error (continuing):', err);
  }

  // 2. Preserve device keys
  const preserved: Record<string, string | null> = {};
  PRESERVE_KEYS.forEach(key => {
    preserved[key] = localStorage.getItem(key);
  });

  // 3. Clear all localStorage
  localStorage.clear();

  // 4. Restore preserved keys
  PRESERVE_KEYS.forEach(key => {
    if (preserved[key]) {
      localStorage.setItem(key, preserved[key]!);
    }
  });

  console.log('[IKOMA] Storage cleared (device keys preserved)');

  // 5. Clear sessionStorage
  sessionStorage.clear();

  // 6. Reload the page
  window.location.reload();
}

/**
 * Clear app cache (unregister service worker + reload)
 */
export async function clearAppCache(): Promise<void> {
  console.log('[IKOMA] Clearing app cache...');
  
  try {
    // Unregister all service workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
      console.log('[IKOMA] Service workers unregistered:', registrations.length);
    }

    // Clear caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      console.log('[IKOMA] Caches cleared:', cacheNames.length);
    }
  } catch (err) {
    console.warn('[IKOMA] Cache clear error:', err);
  }

  // Hard reload
  window.location.reload();
}

/**
 * Check if session appears valid
 */
export async function checkSessionHealth(): Promise<{
  hasSession: boolean;
  hasUser: boolean;
  tokenExpired: boolean;
  errorMessage: string | null;
}> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      return {
        hasSession: false,
        hasUser: false,
        tokenExpired: false,
        errorMessage: error.message,
      };
    }

    if (!session) {
      return {
        hasSession: false,
        hasUser: false,
        tokenExpired: false,
        errorMessage: null,
      };
    }

    // Check token expiry
    const expiresAt = session.expires_at ? new Date(session.expires_at * 1000) : null;
    const now = new Date();
    const tokenExpired = expiresAt ? expiresAt < now : false;

    return {
      hasSession: true,
      hasUser: !!session.user,
      tokenExpired,
      errorMessage: null,
    };
  } catch (err) {
    return {
      hasSession: false,
      hasUser: false,
      tokenExpired: false,
      errorMessage: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
