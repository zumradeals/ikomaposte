/**
 * Hook for generating signed URLs for snapshots - Phase 4.5
 * Private bucket requires signed URLs for display
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseSnapshotUrlResult {
  signedUrl: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Generate a signed URL for a snapshot stored in private bucket
 * @param snapshotUrl - Can be a path (e.g., "device_id/date/worker/event.webp") or existing signed URL
 * @param bucketName - Storage bucket name, defaults to 'work-snapshots'
 */
export function useSnapshotUrl(
  snapshotUrl: string | null | undefined,
  bucketName: string = 'work-snapshots'
): UseSnapshotUrlResult {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!snapshotUrl) {
      setSignedUrl(null);
      setError(null);
      return;
    }

    // If already a full URL (signed or public), use directly
    if (snapshotUrl.startsWith('http://') || snapshotUrl.startsWith('https://')) {
      setSignedUrl(snapshotUrl);
      setError(null);
      return;
    }

    // Otherwise, it's a path - generate signed URL
    const generateSignedUrl = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: signError } = await supabase.storage
          .from(bucketName)
          .createSignedUrl(snapshotUrl, 60 * 60); // 1 hour expiry

        if (signError) {
          throw signError;
        }

        if (data?.signedUrl) {
          setSignedUrl(data.signedUrl);
        } else {
          throw new Error('No signed URL returned');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to generate signed URL';
        setError(message);
        console.error('[IKOMA] Snapshot URL error:', message, snapshotUrl);
      } finally {
        setIsLoading(false);
      }
    };

    generateSignedUrl();
  }, [snapshotUrl, bucketName]);

  return { signedUrl, isLoading, error };
}

/**
 * Utility function to generate signed URL (non-hook version for callbacks)
 */
export async function getSignedSnapshotUrl(
  snapshotUrl: string,
  bucketName: string = 'work-snapshots'
): Promise<{ url: string | null; error: string | null }> {
  // If already a full URL, return as-is
  if (snapshotUrl.startsWith('http://') || snapshotUrl.startsWith('https://')) {
    return { url: snapshotUrl, error: null };
  }

  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(snapshotUrl, 60 * 60); // 1 hour

    if (error) {
      return { url: null, error: error.message };
    }

    return { url: data?.signedUrl || null, error: null };
  } catch (err) {
    return { 
      url: null, 
      error: err instanceof Error ? err.message : 'Unknown error' 
    };
  }
}
