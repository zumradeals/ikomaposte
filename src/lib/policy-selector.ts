// ============================================
// IKOMA Policy Selection Engine v4.1
// ============================================
//
// DOCTRINE:
// 1. Exactly ONE policy per worker/production_date
// 2. Priority: Individual > Team > Category > Default
// 3. Conflicts at same priority = POLICY_CONFLICT anomaly
// 4. Selected policy ID + version stored in results
//

import { supabase } from '@/integrations/supabase/client';
import {
  PolicyScopeType,
  TolerancesConfig,
  RoundingRulesConfig,
  OvertimeRulesConfig,
  WeekPattern,
  WeekdayConfig,
  TimeSlot,
  SCOPE_TYPE_PRIORITY,
} from '@/types/policies';
import type { Json } from '@/integrations/supabase/types';

// ----------------------
// Types
// ----------------------

/** Result from policy selection */
export interface PolicySelectionResult {
  // Selection status
  success: boolean;
  
  // Selected policy (null if conflict or not found)
  policy: SelectedPolicy | null;
  
  // Conflict info
  has_conflict: boolean;
  conflicting_policies: ConflictingPolicy[];
  
  // Error info
  error?: string;
  
  // Decision trace
  decision_path: string[];
}

/** The selected policy with all configuration */
export interface SelectedPolicy {
  policy_id: string;
  policy_version_id: string | null;
  policy_name: string;
  policy_code: string;
  version: number;
  
  // Scope info
  scope_type: PolicyScopeType;
  scope_priority: number;
  
  // Configuration
  week_pattern: WeekPattern;
  tolerances: TolerancesConfig;
  rounding_rules: RoundingRulesConfig;
  overtime_rules: OvertimeRulesConfig;
  timezone: string;
}

/** Policy in a conflict */
export interface ConflictingPolicy {
  policy_id: string;
  policy_name: string;
  policy_code: string;
  scope_type: PolicyScopeType;
  manual_priority: number;
}

/** Input for policy selection */
export interface PolicySelectionInput {
  worker_id: string;
  production_date: string;  // YYYY-MM-DD format
  worker_category_id?: string;
  worker_team_id?: string;
}

/** Database row from select_policy_for_worker RPC */
interface PolicySelectionDbRow {
  policy_id: string;
  policy_version_id: string | null;
  policy_name: string;
  policy_code: string;
  version: number;
  scope_type: PolicyScopeType;
  scope_priority: number;
  week_pattern: unknown;
  tolerances: unknown;
  rounding_rules: unknown;
  overtime_rules: unknown;
  timezone: string;
  conflict_detected: boolean;
  conflict_policies: unknown;
}

// ----------------------
// Default configurations
// ----------------------

const DEFAULT_TOLERANCES: TolerancesConfig = {
  late_grace_minutes: 15,
  early_leave_grace_minutes: 15,
  day_overrides: {},
};

const DEFAULT_ROUNDING_RULES: RoundingRulesConfig = {
  mode: 'NONE',
  step_minutes: 15,
  apply_to: ['worked_time'],
};

const DEFAULT_OVERTIME_RULES: OvertimeRulesConfig = {
  mode: 'DAILY',
  threshold_hours: 8,
  approval_required: false,
};

const DEFAULT_WEEKDAY: WeekdayConfig = {
  working_day: true,
  time_slots: [{ start_time: '08:00', end_time: '17:00', allow_cross_day: false }],
};

const DEFAULT_WEEKEND: WeekdayConfig = {
  working_day: false,
  time_slots: [],
};

const DEFAULT_WEEK_PATTERN: WeekPattern = {
  monday: DEFAULT_WEEKDAY,
  tuesday: DEFAULT_WEEKDAY,
  wednesday: DEFAULT_WEEKDAY,
  thursday: DEFAULT_WEEKDAY,
  friday: DEFAULT_WEEKDAY,
  saturday: DEFAULT_WEEKEND,
  sunday: DEFAULT_WEEKEND,
};

// ----------------------
// Main Selection Engine
// ----------------------

/**
 * Select the applicable policy for a worker on a production date.
 * 
 * Uses the database function `select_policy_for_worker` which:
 * 1. Finds all matching policies (by scope)
 * 2. Selects the highest priority scope type
 * 3. Detects conflicts at the same priority level
 * 
 * @returns PolicySelectionResult with selected policy or conflict info
 */
export async function selectPolicyForWorker(
  input: PolicySelectionInput
): Promise<PolicySelectionResult> {
  const decisionPath: string[] = [];
  
  try {
    decisionPath.push(`[SELECT] Worker: ${input.worker_id}, Date: ${input.production_date}`);
    
    // Call the database function
    // Note: Using type assertion since the function was just created and types not yet regenerated
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('select_policy_for_worker', {
      p_worker_id: input.worker_id,
      p_production_date: input.production_date,
    }) as { data: PolicySelectionDbRow[] | null; error: { message: string } | null };
    
    if (error) {
      console.error('[PolicySelector] Database error:', error);
      decisionPath.push(`[ERROR] Database query failed: ${error.message}`);
      return {
        success: false,
        policy: null,
        has_conflict: false,
        conflicting_policies: [],
        error: error.message,
        decision_path: decisionPath,
      };
    }
    
    // No matching policy found
    if (!data || (Array.isArray(data) && data.length === 0)) {
      decisionPath.push('[NO_POLICY] No applicable policy found');
      return {
        success: false,
        policy: null,
        has_conflict: false,
        conflicting_policies: [],
        error: 'NO_APPLICABLE_POLICY',
        decision_path: decisionPath,
      };
    }
    
    const row = Array.isArray(data) ? data[0] : data;
    
    // Check for conflict
    if (row.conflict_detected) {
      const conflicts = parseConflictPolicies(row.conflict_policies);
      decisionPath.push(`[CONFLICT] ${conflicts.length} policies at ${row.scope_type} level`);
      conflicts.forEach(c => {
        decisionPath.push(`  - ${c.policy_code}: ${c.policy_name}`);
      });
      
      return {
        success: false,
        policy: null,
        has_conflict: true,
        conflicting_policies: conflicts,
        error: 'POLICY_CONFLICT',
        decision_path: decisionPath,
      };
    }
    
    // Parse and validate configuration
    const policy = parseSelectedPolicy(row as unknown as Record<string, unknown>);
    decisionPath.push(`[SELECTED] ${policy.policy_code} (${policy.scope_type}, v${policy.version})`);
    
    return {
      success: true,
      policy,
      has_conflict: false,
      conflicting_policies: [],
      decision_path: decisionPath,
    };
    
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[PolicySelector] Unexpected error:', err);
    decisionPath.push(`[EXCEPTION] ${errorMsg}`);
    
    return {
      success: false,
      policy: null,
      has_conflict: false,
      conflicting_policies: [],
      error: errorMsg,
      decision_path: decisionPath,
    };
  }
}

/**
 * Get the effective schedule for a specific day from a policy's week_pattern
 */
export function getScheduleForDay(
  policy: SelectedPolicy,
  dayOfWeek: number  // 0=Sunday, 1=Monday, ..., 6=Saturday
): { start_time: string; end_time: string } | null {
  const dayMap: Record<number, keyof WeekPattern> = {
    0: 'sunday',
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday',
    6: 'saturday',
  };
  
  const dayKey = dayMap[dayOfWeek];
  if (!dayKey) return null;
  
  const dayConfig = policy.week_pattern[dayKey];
  if (!dayConfig?.working_day || !dayConfig.time_slots?.length) {
    return null;
  }
  
  // Return the first slot's times
  const slot = dayConfig.time_slots[0];
  return {
    start_time: slot.start_time,
    end_time: slot.end_time,
  };
}

/**
 * Get tolerance configuration from policy
 */
export function getToleranceForDay(
  policy: SelectedPolicy,
  dayOfWeek: number
): { late_minutes: number; early_leave_minutes: number } {
  const tolerances = policy.tolerances;
  
  // Check for day-specific override
  const dayOverride = tolerances.day_overrides?.[dayOfWeek];
  if (dayOverride) {
    return {
      late_minutes: dayOverride.late_grace_minutes ?? tolerances.late_grace_minutes,
      early_leave_minutes: dayOverride.early_leave_grace_minutes ?? tolerances.early_leave_grace_minutes,
    };
  }
  
  return {
    late_minutes: tolerances.late_grace_minutes,
    early_leave_minutes: tolerances.early_leave_grace_minutes,
  };
}

/**
 * Calculate scope type priority (for display/sorting)
 */
export function getScopeTypePriority(scopeType: PolicyScopeType): number {
  return SCOPE_TYPE_PRIORITY[scopeType] ?? 0;
}

// ----------------------
// Helper Functions
// ----------------------

function parseSelectedPolicy(row: Record<string, unknown>): SelectedPolicy {
  return {
    policy_id: row.policy_id as string,
    policy_version_id: row.policy_version_id as string | null,
    policy_name: row.policy_name as string,
    policy_code: row.policy_code as string,
    version: (row.version as number) ?? 1,
    scope_type: row.scope_type as PolicyScopeType,
    scope_priority: (row.scope_priority as number) ?? 0,
    week_pattern: parseWeekPattern(row.week_pattern),
    tolerances: parseTolerances(row.tolerances),
    rounding_rules: parseRoundingRules(row.rounding_rules),
    overtime_rules: parseOvertimeRules(row.overtime_rules),
    timezone: (row.timezone as string) ?? 'Africa/Abidjan',
  };
}

function parseWeekPattern(data: unknown): WeekPattern {
  if (!data || typeof data !== 'object') {
    return DEFAULT_WEEK_PATTERN;
  }
  return data as WeekPattern;
}

function parseTolerances(data: unknown): TolerancesConfig {
  if (!data || typeof data !== 'object') {
    return DEFAULT_TOLERANCES;
  }
  const raw = data as Record<string, unknown>;
  return {
    late_grace_minutes: (raw.late_grace_minutes as number) ?? DEFAULT_TOLERANCES.late_grace_minutes,
    early_leave_grace_minutes: (raw.early_leave_grace_minutes as number) ?? DEFAULT_TOLERANCES.early_leave_grace_minutes,
    day_overrides: (raw.day_overrides as TolerancesConfig['day_overrides']) ?? {},
  };
}

function parseRoundingRules(data: unknown): RoundingRulesConfig {
  if (!data || typeof data !== 'object') {
    return DEFAULT_ROUNDING_RULES;
  }
  const raw = data as Record<string, unknown>;
  return {
    mode: (raw.mode as RoundingRulesConfig['mode']) ?? DEFAULT_ROUNDING_RULES.mode,
    step_minutes: (raw.step_minutes as number) ?? DEFAULT_ROUNDING_RULES.step_minutes,
    apply_to: (raw.apply_to as RoundingRulesConfig['apply_to']) ?? DEFAULT_ROUNDING_RULES.apply_to,
  };
}

function parseOvertimeRules(data: unknown): OvertimeRulesConfig {
  if (!data || typeof data !== 'object') {
    return DEFAULT_OVERTIME_RULES;
  }
  const raw = data as Record<string, unknown>;
  return {
    mode: (raw.mode as OvertimeRulesConfig['mode']) ?? DEFAULT_OVERTIME_RULES.mode,
    threshold_hours: (raw.threshold_hours as number) ?? DEFAULT_OVERTIME_RULES.threshold_hours,
    approval_required: (raw.approval_required as boolean) ?? DEFAULT_OVERTIME_RULES.approval_required,
  };
}

function parseConflictPolicies(data: unknown): ConflictingPolicy[] {
  if (!data || !Array.isArray(data)) {
    return [];
  }
  return data.map((item: Record<string, unknown>) => ({
    policy_id: item.policy_id as string,
    policy_name: item.policy_name as string,
    policy_code: item.policy_code as string,
    scope_type: item.scope_type as PolicyScopeType,
    manual_priority: (item.manual_priority as number) ?? 0,
  }));
}

// ----------------------
// Logging & Conflict Recording
// ----------------------

/**
 * Record a policy conflict in the database for later resolution
 */
export async function recordPolicyConflict(
  workerId: string,
  productionDate: string,
  conflictingPolicies: ConflictingPolicy[]
): Promise<void> {
  try {
    const { error } = await supabase
      .from('policy_conflicts')
      .insert([{
        worker_id: workerId,
        work_date: productionDate,
        conflict_type: 'SAME_PRIORITY_LEVEL',
        description: `${conflictingPolicies.length} policies match at ${conflictingPolicies[0]?.scope_type} level`,
        conflicting_policies: conflictingPolicies as unknown as Json,
      }]);
    
    if (error) {
      console.error('[PolicySelector] Failed to record conflict:', error);
    }
  } catch (err) {
    console.error('[PolicySelector] Error recording conflict:', err);
  }
}

/**
 * Format the decision path for display/logging
 */
export function formatDecisionPath(decisionPath: string[]): string {
  return decisionPath.join('\n');
}
