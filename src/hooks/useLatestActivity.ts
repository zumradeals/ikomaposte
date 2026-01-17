import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { parseISO } from 'date-fns';

/**
 * Helpers to make admin screens "demo-friendly":
 * - Many pages default to "today"; if there is no activity today (common in demos),
 *   we fall back to the most recent day/month where data exists.
 */

export function useLatestEventDay() {
  return useQuery({
    queryKey: ['latest-event-day'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_events')
        .select('occurred_at')
        .order('occurred_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data?.occurred_at) return null;
      return new Date(data.occurred_at);
    },
  });
}

export function useLatestSummaryDay() {
  return useQuery({
    queryKey: ['latest-summary-day'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_summaries')
        .select('work_date')
        .eq('is_current', true)
        .order('work_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data?.work_date) return null;
      return parseISO(data.work_date);
    },
  });
}

export function useLatestValidatedSummaryDay() {
  return useQuery({
    queryKey: ['latest-validated-summary-day'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_summaries')
        .select('work_date')
        .eq('is_current', true)
        .eq('validation_status', 'VALIDATED')
        .order('work_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data?.work_date) return null;
      return parseISO(data.work_date);
    },
  });
}
