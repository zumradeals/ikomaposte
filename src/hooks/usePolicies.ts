import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  TimePolicy, 
  PolicyScope, 
  PolicyStatus,
  WeekPattern,
  TolerancesConfig,
  RoundingRulesConfig,
  OvertimeRulesConfig 
} from '@/types/policies';
import { Json } from '@/integrations/supabase/types';

// Default week pattern (Mon-Fri 8h-17h)
export const DEFAULT_WEEK_PATTERN: WeekPattern = {
  monday: { working_day: true, time_slots: [{ start_time: '08:00', end_time: '17:00', allow_cross_day: false }] },
  tuesday: { working_day: true, time_slots: [{ start_time: '08:00', end_time: '17:00', allow_cross_day: false }] },
  wednesday: { working_day: true, time_slots: [{ start_time: '08:00', end_time: '17:00', allow_cross_day: false }] },
  thursday: { working_day: true, time_slots: [{ start_time: '08:00', end_time: '17:00', allow_cross_day: false }] },
  friday: { working_day: true, time_slots: [{ start_time: '08:00', end_time: '17:00', allow_cross_day: false }] },
  saturday: { working_day: false, time_slots: [] },
  sunday: { working_day: false, time_slots: [] },
};

export const DEFAULT_TOLERANCES: TolerancesConfig = {
  late_grace_minutes: 15,
  early_leave_grace_minutes: 15,
  day_overrides: {},
};

export const DEFAULT_ROUNDING_RULES: RoundingRulesConfig = {
  mode: 'NONE',
  step_minutes: 15,
  apply_to: ['worked_time'],
};

export const DEFAULT_OVERTIME_RULES: OvertimeRulesConfig = {
  mode: 'DAILY',
  threshold_hours: 8,
  approval_required: false,
};

// Transform DB row to typed TimePolicy
function transformDbToPolicy(row: Record<string, unknown>): TimePolicy {
  return {
    id: row.id as string,
    code: row.code as string,
    name: row.name as string,
    description: row.description as string | null,
    version: (row.version as number) || 1,
    status: (row.status as PolicyStatus) || 'DRAFT',
    timezone: (row.timezone as string) || 'Africa/Dakar',
    valid_from: row.valid_from as string | null,
    valid_to: row.valid_to as string | null,
    week_pattern: (row.week_pattern as WeekPattern) || DEFAULT_WEEK_PATTERN,
    tolerances: (row.tolerances as TolerancesConfig) || DEFAULT_TOLERANCES,
    rounding_rules: (row.rounding_rules as RoundingRulesConfig) || DEFAULT_ROUNDING_RULES,
    overtime_rules: (row.overtime_rules as OvertimeRulesConfig) || DEFAULT_OVERTIME_RULES,
    justification: row.justification as string | null,
    immutable_when_active: (row.immutable_when_active as boolean) ?? true,
    applies_to_category_id: row.applies_to_category_id as string | null,
    is_active: row.is_active as boolean,
    created_at: row.created_at as string,
    created_by: row.created_by as string,
    updated_at: row.updated_at as string,
  };
}

export interface PolicyInsert {
  code: string;
  name: string;
  description?: string | null;
  timezone?: string;
  valid_from: string;
  valid_to?: string | null;
  week_pattern: WeekPattern;
  tolerances: TolerancesConfig;
  rounding_rules: RoundingRulesConfig;
  overtime_rules: OvertimeRulesConfig;
  applies_to_category_id?: string | null;
  immutable_when_active?: boolean;
}

export interface PolicyUpdate extends Partial<PolicyInsert> {
  justification?: string;
}

export interface ScopeInsert {
  policy_id: string;
  scope_type: 'individual' | 'team' | 'category' | 'default';
  target_id?: string | null;
  priority?: number;
}

// Fetch all policies
export function usePolicies(statusFilter?: PolicyStatus) {
  return useQuery({
    queryKey: ['policies', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('time_policies')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return (data || []).map(row => transformDbToPolicy(row as Record<string, unknown>));
    },
  });
}

// Fetch single policy with scopes
export function usePolicy(id: string | undefined) {
  return useQuery({
    queryKey: ['policy', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('time_policies')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) return null;
      
      // Fetch scopes
      const { data: scopesData, error: scopesError } = await supabase
        .from('policy_scopes')
        .select('*')
        .eq('policy_id', id);
      
      if (scopesError) throw scopesError;
      
      const policy = transformDbToPolicy(data as Record<string, unknown>);
      policy.scopes = (scopesData || []) as PolicyScope[];
      
      return policy;
    },
    enabled: !!id,
  });
}

// Fetch policy scopes
export function usePolicyScopes(policyId: string | undefined) {
  return useQuery({
    queryKey: ['policy-scopes', policyId],
    queryFn: async () => {
      if (!policyId) return [];
      
      const { data, error } = await supabase
        .from('policy_scopes')
        .select('*')
        .eq('policy_id', policyId)
        .order('priority', { ascending: false });
      
      if (error) throw error;
      return (data || []) as PolicyScope[];
    },
    enabled: !!policyId,
  });
}

// Create policy
export function useCreatePolicy() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (policy: PolicyInsert) => {
      // Get current user for created_by
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');
      
      const { data, error } = await supabase
        .from('time_policies')
        .insert({
          code: policy.code,
          name: policy.name,
          description: policy.description,
          timezone: policy.timezone || 'Africa/Dakar',
          valid_from: policy.valid_from,
          valid_to: policy.valid_to,
          week_pattern: policy.week_pattern as unknown as Json,
          tolerances: policy.tolerances as unknown as Json,
          rounding_rules: policy.rounding_rules as unknown as Json,
          overtime_rules: policy.overtime_rules as unknown as Json,
          applies_to_category_id: policy.applies_to_category_id,
          immutable_when_active: policy.immutable_when_active ?? true,
          status: 'DRAFT',
          version: 1,
          created_by: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return transformDbToPolicy(data as Record<string, unknown>);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      toast({
        title: 'Politique créée',
        description: 'La politique de temps de travail a été créée.',
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

// Update policy (uses bump_policy_version for active policies)
export function useUpdatePolicy() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: PolicyUpdate }) => {
      // Check current status
      const { data: current, error: fetchError } = await supabase
        .from('time_policies')
        .select('status, immutable_when_active')
        .eq('id', id)
        .single();
      
      if (fetchError) throw fetchError;
      
      // If active and immutable, use bump_policy_version
      if (current.status === 'ACTIVE' && current.immutable_when_active) {
        if (!updates.justification) {
          throw new Error('Une justification est requise pour modifier une politique active');
        }
        
        const { data, error } = await supabase.rpc('bump_policy_version', {
          p_policy_id: id,
          p_changes: updates as unknown as Json,
          p_justification: updates.justification,
        });
        
        if (error) throw error;
        return transformDbToPolicy(data as Record<string, unknown>);
      }
      
      // Otherwise, direct update
      const { data, error } = await supabase
        .from('time_policies')
        .update({
          ...updates,
          week_pattern: updates.week_pattern as unknown as Json,
          tolerances: updates.tolerances as unknown as Json,
          rounding_rules: updates.rounding_rules as unknown as Json,
          overtime_rules: updates.overtime_rules as unknown as Json,
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return transformDbToPolicy(data as Record<string, unknown>);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      queryClient.invalidateQueries({ queryKey: ['policy'] });
      toast({
        title: 'Politique mise à jour',
        description: 'La politique a été modifiée avec succès.',
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

// Activate policy
export function useActivatePolicy() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, justification }: { id: string; justification?: string }) => {
      const { data, error } = await supabase.rpc('activate_policy', {
        p_policy_id: id,
        p_justification: justification,
      });
      
      if (error) throw error;
      return transformDbToPolicy(data as Record<string, unknown>);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      queryClient.invalidateQueries({ queryKey: ['policy'] });
      toast({
        title: 'Politique activée',
        description: 'La politique est maintenant active.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur d\'activation',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Archive policy
export function useArchivePolicy() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('time_policies')
        .update({ status: 'ARCHIVED' })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return transformDbToPolicy(data as Record<string, unknown>);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      toast({
        title: 'Politique archivée',
        description: 'La politique a été archivée.',
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

// Add scope to policy
export function useAddPolicyScope() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (scope: ScopeInsert) => {
      const { data, error } = await supabase
        .from('policy_scopes')
        .insert({
          policy_id: scope.policy_id,
          scope_type: scope.scope_type,
          target_id: scope.target_id,
          priority: scope.priority || 0,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as PolicyScope;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['policy-scopes', variables.policy_id] });
      queryClient.invalidateQueries({ queryKey: ['policy', variables.policy_id] });
      toast({
        title: 'Scope ajouté',
        description: 'Le scope a été ajouté à la politique.',
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

// Remove scope from policy
export function useRemovePolicyScope() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ scopeId, policyId }: { scopeId: string; policyId: string }) => {
      const { error } = await supabase
        .from('policy_scopes')
        .delete()
        .eq('id', scopeId);
      
      if (error) throw error;
      return { scopeId, policyId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['policy-scopes', result.policyId] });
      queryClient.invalidateQueries({ queryKey: ['policy', result.policyId] });
      toast({
        title: 'Scope supprimé',
        description: 'Le scope a été retiré de la politique.',
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

// Delete policy (only DRAFT)
export function useDeletePolicy() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      // First delete scopes
      await supabase
        .from('policy_scopes')
        .delete()
        .eq('policy_id', id);
      
      const { error } = await supabase
        .from('time_policies')
        .delete()
        .eq('id', id)
        .eq('status', 'DRAFT');
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      toast({
        title: 'Politique supprimée',
        description: 'La politique a été supprimée.',
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
