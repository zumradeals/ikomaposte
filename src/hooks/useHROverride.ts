// ============================================
// Phase 7: HR Override Hook
// Creates new revision with HR-corrected times
// ============================================

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { evaluateDecisionTable, extractCheckinCheckout } from '@/lib/decision-table';
import { CALCULATION_VERSION } from '@/types/work-summaries';

interface HROverrideParams {
  summaryId: string;
  workerId: string;
  workDate: string;
  hrOverrideCheckin: string | null;
  hrOverrideCheckout: string | null;
  hrOverrideReason: string;
  adminId: string;
}

/**
 * HR Override creates a new revision with corrected check-in/out times.
 * The decision table is re-evaluated using the HR override times.
 * This does NOT force day_status - it recalculates based on schedule.
 */
export function useHROverride() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      summaryId,
      workerId,
      workDate,
      hrOverrideCheckin,
      hrOverrideCheckout,
      hrOverrideReason,
      adminId,
    }: HROverrideParams) => {
      // 1. Fetch current summary
      const { data: currentSummary, error: fetchError } = await supabase
        .from('work_summaries')
        .select('*')
        .eq('id', summaryId)
        .single();

      if (fetchError) throw fetchError;
      if (!currentSummary) throw new Error('Summary not found');
      if (currentSummary.locked) throw new Error('Summary is locked and cannot be modified');

      // 2. Fetch events for the day
      const dateStart = `${workDate}T00:00:00`;
      const dateEnd = `${workDate}T23:59:59`;
      
      const { data: events, error: eventsError } = await supabase
        .from('work_events')
        .select('id, event_type, occurred_at, trust_status')
        .eq('worker_id', workerId)
        .gte('occurred_at', dateStart)
        .lte('occurred_at', dateEnd)
        .eq('trust_status', 'trusted')
        .order('occurred_at', { ascending: true });

      if (eventsError) throw eventsError;

      // 3. Fetch worker's schedule
      const { data: worker, error: workerError } = await supabase
        .from('workers')
        .select('category_id')
        .eq('id', workerId)
        .single();

      if (workerError) throw workerError;

      const workDateObj = new Date(workDate);
      const dayOfWeek = workDateObj.getDay();

      const { data: schedule } = await supabase
        .from('work_schedules')
        .select('*')
        .eq('category_id', worker.category_id)
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true)
        .maybeSingle();

      // 4. Build decision input with HR overrides
      const { checkin: rawCheckin, checkout: rawCheckout } = extractCheckinCheckout(
        events?.map(e => ({ event_type: e.event_type, occurred_at: e.occurred_at })) || []
      );

      // Use HR override if provided, otherwise use raw event time
      const effectiveCheckin = hrOverrideCheckin 
        ? `${workDate}T${hrOverrideCheckin}:00`
        : rawCheckin;
      const effectiveCheckout = hrOverrideCheckout 
        ? `${workDate}T${hrOverrideCheckout}:00`
        : rawCheckout;

      // 5. Re-evaluate decision table
      const decisionResult = evaluateDecisionTable({
        actual_checkin: effectiveCheckin,
        actual_checkout: effectiveCheckout,
        schedule: schedule ? {
          id: schedule.id,
          category_id: schedule.category_id,
          day_of_week: schedule.day_of_week,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          tolerance_late_minutes: schedule.tolerance_late_minutes,
          tolerance_early_leave_minutes: schedule.tolerance_early_leave_minutes,
          is_active: schedule.is_active,
          created_at: schedule.created_at,
          updated_at: schedule.updated_at,
        } : null,
        events: events?.map(e => ({
          id: e.id,
          event_type: e.event_type,
          occurred_at: e.occurred_at,
        })) || [],
      });

      // 6. Calculate work minutes based on new times
      let totalWorkMinutes = 0;
      if (effectiveCheckin && effectiveCheckout && decisionResult.day_status !== 'ANOMALIE' && decisionResult.day_status !== 'ABSENT') {
        const checkinDate = new Date(effectiveCheckin);
        const checkoutDate = new Date(effectiveCheckout);
        totalWorkMinutes = Math.max(0, Math.round((checkoutDate.getTime() - checkinDate.getTime()) / 60000));
      }

      // 7. Mark current as not current
      const { error: updateOldError } = await supabase
        .from('work_summaries')
        .update({ is_current: false, updated_at: new Date().toISOString() })
        .eq('id', summaryId);

      if (updateOldError) throw updateOldError;

      // 8. Create new revision
      const { data: newSummary, error: insertError } = await supabase
        .from('work_summaries')
        .insert({
          worker_id: workerId,
          work_date: workDate,
          total_work_minutes: totalWorkMinutes,
          total_pause_minutes: currentSummary.total_pause_minutes,
          total_amount: (totalWorkMinutes / 60) * currentSummary.taux_horaire_applied,
          taux_horaire_applied: currentSummary.taux_horaire_applied,
          devise: currentSummary.devise,
          auto_closed: currentSummary.auto_closed,
          auto_close_time: currentSummary.auto_close_time,
          events_used: currentSummary.events_used,
          segments_json: currentSummary.segments_json,
          notes: `[HR OVERRIDE ${new Date().toISOString()}] ${hrOverrideReason}`,
          calculation_version: CALCULATION_VERSION,
          revision: currentSummary.revision + 1,
          is_current: true,
          supersedes_id: summaryId,
          locked: false,
          locked_by: null,
          locked_at: null,
          day_status: decisionResult.day_status,
          anomaly_code: decisionResult.anomaly_code,
          late_minutes: decisionResult.late_minutes,
          hr_override_checkin: hrOverrideCheckin,
          hr_override_checkout: hrOverrideCheckout,
          hr_override_reason: hrOverrideReason,
          validation_status: 'DRAFT',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // 9. Log audit
      await supabase.from('admin_audit').insert({
        event: 'HR_OVERRIDE',
        device_id: 'admin-console',
        reason: `HR override for ${workerId} on ${workDate}: ${hrOverrideReason}`,
      });

      return newSummary;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-summaries'] });
      queryClient.invalidateQueries({ queryKey: ['pending-validations'] });
      queryClient.invalidateQueries({ queryKey: ['validation-stats'] });
      queryClient.invalidateQueries({ queryKey: ['worker-summary'] });
      toast({
        title: 'Correction appliquée',
        description: 'Une nouvelle révision a été créée avec les corrections RH',
      });
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
