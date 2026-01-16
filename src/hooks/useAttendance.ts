import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  calculateDailyAttendance,
  ATTENDANCE_ENGINE_VERSION,
} from '@/lib/attendance-engine';
import type {
  AttendanceResult,
  AttendanceCalculationInput,
  PunchEvent,
} from '@/types/attendance';

/**
 * Fetch punches for a worker on a production date
 */
async function fetchPunchesForDay(
  workerId: string,
  productionDate: string
): Promise<PunchEvent[]> {
  const { data, error } = await supabase
    .from('work_events')
    .select('id, event_type, occurred_at, trust_status')
    .eq('worker_id', workerId)
    .eq('production_date', productionDate)
    .order('occurred_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch punches: ${error.message}`);
  }

  return (data || []).map(row => ({
    id: row.id,
    event_type: row.event_type as PunchEvent['event_type'],
    occurred_at: row.occurred_at,
    trust_status: row.trust_status,
  }));
}

/**
 * Fetch worker details for calculation input
 */
async function fetchWorkerDetails(workerId: string): Promise<{
  category_id: string;
  team_id: string | null;
}> {
  const { data, error } = await supabase
    .from('workers')
    .select('category_id, team_id')
    .eq('id', workerId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch worker: ${error.message}`);
  }

  return {
    category_id: data.category_id,
    team_id: data.team_id,
  };
}

/**
 * Hook to calculate attendance for a single worker/date
 */
export function useAttendanceCalculation(
  workerId: string | null,
  productionDate: string | null
) {
  return useQuery({
    queryKey: ['attendance', workerId, productionDate],
    queryFn: async (): Promise<AttendanceResult> => {
      if (!workerId || !productionDate) {
        throw new Error('Worker ID and production date required');
      }

      // Fetch worker details
      const workerDetails = await fetchWorkerDetails(workerId);

      // Fetch punches
      const punches = await fetchPunchesForDay(workerId, productionDate);

      // Calculate attendance
      const input: AttendanceCalculationInput = {
        worker_id: workerId,
        production_date: productionDate,
        worker_category_id: workerDetails.category_id,
        worker_team_id: workerDetails.team_id || undefined,
      };

      return calculateDailyAttendance(input, punches);
    },
    enabled: !!workerId && !!productionDate,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook to calculate attendance for multiple workers on a date
 */
export function useBatchAttendanceCalculation(
  workerIds: string[],
  productionDate: string | null
) {
  return useQuery({
    queryKey: ['attendance-batch', workerIds, productionDate],
    queryFn: async (): Promise<AttendanceResult[]> => {
      if (!productionDate || workerIds.length === 0) {
        return [];
      }

      const results: AttendanceResult[] = [];

      for (const workerId of workerIds) {
        try {
          const workerDetails = await fetchWorkerDetails(workerId);
          const punches = await fetchPunchesForDay(workerId, productionDate);

          const input: AttendanceCalculationInput = {
            worker_id: workerId,
            production_date: productionDate,
            worker_category_id: workerDetails.category_id,
            worker_team_id: workerDetails.team_id || undefined,
          };

          const result = await calculateDailyAttendance(input, punches);
          results.push(result);
        } catch (error) {
          console.error(`Failed to calculate attendance for worker ${workerId}:`, error);
          // Create error result
          results.push({
            status: 'CONFIG_ERROR',
            status_reason: error instanceof Error ? error.message : 'Calculation failed',
            worker_id: workerId,
            production_date: productionDate,
            day_of_week: new Date(productionDate).getDay(),
            expected: {
              is_working_day: false,
              time_slots: [],
              total_expected_minutes: 0,
              earliest_start: null,
              latest_end: null,
            },
            observed: {
              in_punch: null,
              out_punch: null,
              raw_worked_minutes: null,
              all_punches: [],
            },
            worked_duration_minutes: 0,
            overtime_minutes: 0,
            late_minutes: 0,
            early_leave_minutes: 0,
            tolerances_applied: {
              late_grace_minutes: 15,
              early_leave_grace_minutes: 15,
              source: 'default',
            },
            rounding_applied: null,
            policy: null,
            calculated_at: new Date().toISOString(),
            calculation_version: ATTENDANCE_ENGINE_VERSION,
            decision_path: [`[ERROR] ${error instanceof Error ? error.message : 'Unknown error'}`],
          });
        }
      }

      return results;
    },
    enabled: !!productionDate && workerIds.length > 0,
    staleTime: 30000,
  });
}

/**
 * Hook to trigger recalculation of attendance
 */
export function useRecalculateAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      workerId,
      productionDate,
    }: {
      workerId: string;
      productionDate: string;
    }): Promise<AttendanceResult> => {
      const workerDetails = await fetchWorkerDetails(workerId);
      const punches = await fetchPunchesForDay(workerId, productionDate);

      const input: AttendanceCalculationInput = {
        worker_id: workerId,
        production_date: productionDate,
        worker_category_id: workerDetails.category_id,
        worker_team_id: workerDetails.team_id || undefined,
      };

      return calculateDailyAttendance(input, punches);
    },
    onSuccess: (result, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: ['attendance', variables.workerId, variables.productionDate],
      });
      queryClient.invalidateQueries({
        queryKey: ['attendance-batch'],
      });
    },
  });
}

/**
 * Get attendance statistics for a date range
 */
export function useAttendanceStats(
  productionDateStart: string | null,
  productionDateEnd: string | null
) {
  return useQuery({
    queryKey: ['attendance-stats', productionDateStart, productionDateEnd],
    queryFn: async () => {
      // This would aggregate attendance data
      // For now, return placeholder structure
      return {
        total_workers: 0,
        ok_count: 0,
        late_count: 0,
        early_leave_count: 0,
        absent_count: 0,
        incomplete_count: 0,
        error_count: 0,
      };
    },
    enabled: !!productionDateStart && !!productionDateEnd,
  });
}
