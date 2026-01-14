// ============================================
// Phase 7: Work Schedules Hooks
// CRUD pour les horaires théoriques par catégorie/jour
// 
// SECURITY PATH: Client-side with RLS (admin role required)
// - All CRUD operations use Supabase client with RLS policies
// - RLS policy "Admins can manage work schedules" enforces has_role(auth.uid(), 'admin')
// - No edge functions or service-role needed for this module
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  WorkSchedule,
  WorkScheduleInsert,
  WorkScheduleWithCategory,
} from '@/types/business-rules';

/**
 * Récupère tous les horaires actifs
 */
export function useWorkSchedules() {
  return useQuery({
    queryKey: ['work-schedules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_schedules')
        .select(`
          *,
          categories (
            id,
            nom
          )
        `)
        .eq('is_active', true)
        .order('category_id')
        .order('day_of_week');

      if (error) throw error;
      return data as WorkScheduleWithCategory[];
    },
  });
}

/**
 * Récupère les horaires pour une catégorie spécifique
 */
export function useCategorySchedules(categoryId: string) {
  return useQuery({
    queryKey: ['work-schedules', 'category', categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_schedules')
        .select('*')
        .eq('category_id', categoryId)
        .eq('is_active', true)
        .order('day_of_week');

      if (error) throw error;
      return data as WorkSchedule[];
    },
    enabled: !!categoryId,
  });
}

/**
 * Récupère l'horaire pour une catégorie et un jour spécifique
 */
export function useDaySchedule(categoryId: string, dayOfWeek: number) {
  return useQuery({
    queryKey: ['work-schedules', 'day', categoryId, dayOfWeek],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_schedules')
        .select('*')
        .eq('category_id', categoryId)
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      return data as WorkSchedule | null;
    },
    enabled: !!categoryId && dayOfWeek >= 0 && dayOfWeek <= 6,
  });
}

/**
 * Crée ou met à jour un horaire
 */
export function useUpsertSchedule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (schedule: WorkScheduleInsert) => {
      // Upsert: insert ou update si existe déjà
      const { data, error } = await supabase
        .from('work_schedules')
        .upsert(
          {
            ...schedule,
            is_active: schedule.is_active ?? true,
            tolerance_late_minutes: schedule.tolerance_late_minutes ?? 15,
            tolerance_early_leave_minutes: schedule.tolerance_early_leave_minutes ?? 15,
          },
          {
            onConflict: 'category_id,day_of_week',
          }
        )
        .select()
        .single();

      if (error) throw error;
      return data as WorkSchedule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-schedules'] });
      toast({
        title: 'Horaire enregistré',
        description: 'L\'horaire a été mis à jour',
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

/**
 * Crée des horaires par lot pour une catégorie (lun-ven par défaut)
 */
export function useBatchCreateSchedules() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      categoryId,
      startTime,
      endTime,
      toleranceLateMinutes = 15,
      workingDays = [1, 2, 3, 4, 5], // Lun-Ven par défaut
    }: {
      categoryId: string;
      startTime: string;
      endTime: string;
      toleranceLateMinutes?: number;
      workingDays?: number[];
    }) => {
      const schedules: WorkScheduleInsert[] = workingDays.map(day => ({
        category_id: categoryId,
        day_of_week: day,
        start_time: startTime,
        end_time: endTime,
        tolerance_late_minutes: toleranceLateMinutes,
        tolerance_early_leave_minutes: toleranceLateMinutes,
      }));

      const { data, error } = await supabase
        .from('work_schedules')
        .upsert(schedules, {
          onConflict: 'category_id,day_of_week',
        })
        .select();

      if (error) throw error;
      return data as WorkSchedule[];
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['work-schedules'] });
      toast({
        title: 'Horaires créés',
        description: `${data.length} jours configurés`,
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

/**
 * Désactive un horaire (soft delete)
 */
export function useDeactivateSchedule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (scheduleId: string) => {
      const { data, error } = await supabase
        .from('work_schedules')
        .update({ is_active: false })
        .eq('id', scheduleId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-schedules'] });
      toast({
        title: 'Horaire désactivé',
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

/**
 * Copie les horaires d'une catégorie vers une autre (per-day upsert, no auto-deactivation)
 * Doctrine: Uses upsert per day. Does NOT auto-deactivate target schedules.
 * Security: Requires admin RLS. Audit logged in admin_audit.
 */
export function useCopySchedules() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      sourceCategoryId,
      targetCategoryId,
      replaceAll = false, // Explicit confirmation required for replace
      adminDeviceId,
      actorUserId, // Required for audit trail
    }: {
      sourceCategoryId: string;
      targetCategoryId: string;
      replaceAll?: boolean;
      adminDeviceId?: string;
      actorUserId?: string;
    }) => {
      // Fetch source schedules
      const { data: sourceSchedules, error: fetchError } = await supabase
        .from('work_schedules')
        .select('*')
        .eq('category_id', sourceCategoryId)
        .eq('is_active', true);

      if (fetchError) throw fetchError;
      if (!sourceSchedules?.length) {
        throw new Error('Aucun horaire à copier');
      }

      // If replaceAll explicitly requested, deactivate target schedules first
      if (replaceAll) {
        const { error: deactivateError } = await supabase
          .from('work_schedules')
          .update({ is_active: false })
          .eq('category_id', targetCategoryId)
          .eq('is_active', true);

        if (deactivateError) throw deactivateError;

        // Audit log for replaceAll (requires actor_user_id for traceability)
        if (adminDeviceId) {
          await supabase.from('admin_audit').insert({
            device_id: adminDeviceId,
            actor_user_id: actorUserId || null,
            event: 'SCHEDULES_REPLACE_ALL',
            reason: `Replaced all schedules: ${sourceCategoryId} -> ${targetCategoryId}`,
          });
        }
      }

      // Create target schedules (per-day upsert)
      const targetSchedules = sourceSchedules.map(s => ({
        category_id: targetCategoryId,
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        tolerance_late_minutes: s.tolerance_late_minutes,
        tolerance_early_leave_minutes: s.tolerance_early_leave_minutes,
        is_active: true,
      }));

      const { data, error } = await supabase
        .from('work_schedules')
        .upsert(targetSchedules, {
          onConflict: 'category_id,day_of_week',
        })
        .select();

      if (error) throw error;

      // Audit log for copy (requires actor_user_id for traceability)
      if (adminDeviceId) {
        await supabase.from('admin_audit').insert({
          device_id: adminDeviceId,
          actor_user_id: actorUserId || null,
          event: 'SCHEDULES_COPIED',
          reason: `Copied ${data.length} schedules: ${sourceCategoryId} -> ${targetCategoryId}`,
        });
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['work-schedules'] });
      toast({
        title: 'Horaires copiés',
        description: `${data.length} jours copiés (fusion par jour)`,
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
