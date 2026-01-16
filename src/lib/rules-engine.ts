// ============================================
// IKOMA Working Time Policies Engine v3.0
// Rules Engine Core
// ============================================
//
// DOCTRINE:
// 1. Raw punches are IMMUTABLE - rounding applies only at calculation time
// 2. Active policies are IMMUTABLE - changes create new versions
// 3. Every result is EXPLAINABLE - traced to rule + version
// 4. Conflicts raise EXPLICIT ANOMALIES - no guessing
//

import {
  RuleType,
  RoundingMode,
  PolicyRule,
  ApplicablePolicyResult,
  ConflictCheckResult,
  RoundingResult,
  OvertimeResult,
  OvertimeBreakdown,
  RoundingRuleConfig,
  OvertimeRuleConfig,
  ScheduleRuleConfig,
  ToleranceRuleConfig,
  NightShiftRuleConfig,
  AppliedRule,
  CalculationTrace,
  RawPunch,
  RoundedPunch,
  CalculationInputs,
  CalculationOutputs,
} from '@/types/policies';
import { supabase } from '@/integrations/supabase/client';

// ============================================
// POLICY LOOKUP
// ============================================

/**
 * Get applicable policy for a worker on a specific date
 * Uses the database function for atomic lookup
 */
export async function getApplicablePolicy(
  workerId: string,
  workDate: Date
): Promise<ApplicablePolicyResult | null> {
  const dateStr = workDate.toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .rpc('get_applicable_policy', {
      p_worker_id: workerId,
      p_work_date: dateStr,
    });

  if (error) {
    console.error('[RulesEngine] Policy lookup failed:', error);
    return null;
  }

  if (!data || (Array.isArray(data) && data.length === 0)) {
    return null;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    policy_id: row.policy_id as string,
    policy_version_id: row.policy_version_id as string,
    policy_code: row.policy_code as string,
    version_number: row.version_number as number,
    rules_snapshot: (row.rules_snapshot || []) as unknown as PolicyRule[],
  };
}

/**
 * Check for policy conflicts
 */
export async function checkPolicyConflicts(
  workerId: string,
  workDate: Date
): Promise<ConflictCheckResult> {
  const dateStr = workDate.toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .rpc('check_policy_conflicts', {
      p_worker_id: workerId,
      p_work_date: dateStr,
    });

  if (error) {
    console.error('[RulesEngine] Conflict check failed:', error);
    return { has_conflict: false, conflicts: [] };
  }

  const result = data as unknown as ConflictCheckResult;
  return result;
}

// ============================================
// ROUNDING ENGINE
// ============================================

/**
 * Apply rounding to a timestamp based on mode
 * Raw timestamps are NEVER modified - this returns a new rounded value
 */
export function applyRounding(
  timestamp: Date,
  mode: RoundingMode
): RoundingResult {
  const original = new Date(timestamp);
  const minutes = original.getMinutes();
  const seconds = original.getSeconds();
  
  let roundedMinutes: number;
  
  switch (mode) {
    case 'NONE':
      return {
        original_time: original,
        rounded_time: original,
        adjustment_minutes: 0,
        mode,
      };
      
    case 'QUARTER_CEIL':
      // Round up to next 15-minute mark
      roundedMinutes = Math.ceil((minutes + seconds / 60) / 15) * 15;
      break;
      
    case 'QUARTER_FLOOR':
      // Round down to previous 15-minute mark
      roundedMinutes = Math.floor(minutes / 15) * 15;
      break;
      
    case 'QUARTER_NEAREST':
      // Round to nearest 15-minute mark
      roundedMinutes = Math.round((minutes + seconds / 60) / 15) * 15;
      break;
      
    default:
      return {
        original_time: original,
        rounded_time: original,
        adjustment_minutes: 0,
        mode,
      };
  }
  
  const rounded = new Date(original);
  rounded.setMinutes(roundedMinutes % 60, 0, 0);
  
  // Handle hour overflow
  if (roundedMinutes >= 60) {
    rounded.setHours(rounded.getHours() + Math.floor(roundedMinutes / 60));
  }
  
  const adjustmentMs = rounded.getTime() - original.getTime();
  const adjustmentMinutes = Math.round(adjustmentMs / 60000);
  
  return {
    original_time: original,
    rounded_time: rounded,
    adjustment_minutes: adjustmentMinutes,
    mode,
  };
}

/**
 * Apply rounding rules to all punches
 */
export function applyRoundingRules(
  punches: RawPunch[],
  roundingRule: PolicyRule | null
): { punches: RoundedPunch[]; appliedRule: AppliedRule | null } {
  if (!roundingRule || roundingRule.rule_type !== 'ROUNDING') {
    // No rounding - return punches unchanged
    return {
      punches: punches.map(p => ({
        ...p,
        original_time: p.occurred_at,
        rounded_time: p.occurred_at,
        rounding_rule_id: '',
        rounding_mode: 'NONE' as RoundingMode,
        adjustment_minutes: 0,
      })),
      appliedRule: null,
    };
  }
  
  const config = roundingRule.config as RoundingRuleConfig;
  
  const roundedPunches: RoundedPunch[] = punches.map(punch => {
    const timestamp = new Date(punch.occurred_at);
    let mode: RoundingMode = 'NONE';
    
    // Determine which rounding mode to apply based on event type
    if (punch.event_type === 'TAKE' || punch.event_type === 'RESUME') {
      mode = config.checkin_mode;
    } else if (punch.event_type === 'END' || punch.event_type === 'PAUSE') {
      mode = config.checkout_mode;
    }
    
    const result = applyRounding(timestamp, mode);
    
    return {
      ...punch,
      original_time: punch.occurred_at,
      rounded_time: result.rounded_time.toISOString(),
      rounding_rule_id: roundingRule.id,
      rounding_mode: mode,
      adjustment_minutes: result.adjustment_minutes,
    };
  });
  
  const appliedRule: AppliedRule = {
    rule_id: roundingRule.id,
    rule_type: 'ROUNDING',
    rule_name: roundingRule.name,
    priority: roundingRule.priority,
    applied_at: new Date().toISOString(),
    result: `Applied ${config.checkin_mode} for check-in, ${config.checkout_mode} for check-out`,
    details: {
      checkin_mode: config.checkin_mode,
      checkout_mode: config.checkout_mode,
      punches_rounded: roundedPunches.filter(p => p.adjustment_minutes !== 0).length,
    },
  };
  
  return { punches: roundedPunches, appliedRule };
}

// ============================================
// OVERTIME CALCULATOR
// ============================================

/**
 * Calculate overtime based on rules
 */
export function calculateOvertime(
  totalWorkMinutes: number,
  overtimeRule: PolicyRule | null
): OvertimeResult {
  if (!overtimeRule || overtimeRule.rule_type !== 'OVERTIME') {
    return {
      has_overtime: false,
      regular_minutes: totalWorkMinutes,
      overtime_minutes: 0,
      breakdown: [],
      total_equivalent_minutes: totalWorkMinutes,
    };
  }
  
  const config = overtimeRule.config as OvertimeRuleConfig;
  const threshold = config.daily_threshold_minutes;
  
  if (totalWorkMinutes <= threshold) {
    return {
      has_overtime: false,
      regular_minutes: totalWorkMinutes,
      overtime_minutes: 0,
      breakdown: [],
      total_equivalent_minutes: totalWorkMinutes,
    };
  }
  
  const overtimeMinutes = totalWorkMinutes - threshold;
  const breakdown: OvertimeBreakdown[] = [];
  let remainingOvertime = overtimeMinutes;
  let totalEquivalent = threshold; // Regular minutes at 1x
  
  // Apply overtime tiers
  const sortedTiers = [...config.tiers].sort((a, b) => a.from_minutes - b.from_minutes);
  
  for (let i = 0; i < sortedTiers.length; i++) {
    const tier = sortedTiers[i];
    if (remainingOvertime <= 0) break;
    
    const tierStart = tier.from_minutes - threshold;
    const tierEnd = tier.to_minutes ? tier.to_minutes - threshold : Infinity;
    const tierCapacity = tierEnd - tierStart;
    
    const minutesInTier = Math.min(remainingOvertime, tierCapacity);
    const equivalentMinutes = Math.round(minutesInTier * tier.multiplier);
    
    breakdown.push({
      tier_index: i,
      from_minutes: tier.from_minutes,
      to_minutes: tier.to_minutes ?? -1,
      minutes_worked: minutesInTier,
      multiplier: tier.multiplier,
      equivalent_minutes: equivalentMinutes,
    });
    
    totalEquivalent += equivalentMinutes;
    remainingOvertime -= minutesInTier;
  }
  
  return {
    has_overtime: true,
    regular_minutes: threshold,
    overtime_minutes: overtimeMinutes,
    breakdown,
    total_equivalent_minutes: totalEquivalent,
  };
}

// ============================================
// SCHEDULE EVALUATION
// ============================================

/**
 * Get schedule for a specific day from rules
 */
export function getScheduleFromRules(
  rules: PolicyRule[],
  dayOfWeek: number
): { start_time: string; end_time: string } | null {
  const scheduleRules = rules
    .filter(r => r.rule_type === 'SCHEDULE' && r.is_active)
    .sort((a, b) => b.priority - a.priority);
  
  for (const rule of scheduleRules) {
    const config = rule.config as ScheduleRuleConfig;
    if (config.days.includes(dayOfWeek)) {
      return {
        start_time: config.start_time,
        end_time: config.end_time,
      };
    }
  }
  
  return null;
}

/**
 * Get tolerance from rules
 */
export function getToleranceFromRules(
  rules: PolicyRule[],
  dayOfWeek: number
): { late_minutes: number; early_leave_minutes: number } {
  const toleranceRules = rules
    .filter(r => r.rule_type === 'TOLERANCE' && r.is_active)
    .sort((a, b) => b.priority - a.priority);
  
  for (const rule of toleranceRules) {
    const config = rule.config as ToleranceRuleConfig;
    if (config.apply_to_all_days || (config.specific_days?.includes(dayOfWeek))) {
      return {
        late_minutes: config.late_minutes,
        early_leave_minutes: config.early_leave_minutes,
      };
    }
  }
  
  // Default tolerance
  return { late_minutes: 15, early_leave_minutes: 15 };
}

// ============================================
// NIGHT SHIFT HANDLER
// ============================================

/**
 * Check if a shift is a night shift (crosses midnight)
 */
export function isNightShift(startTime: string, endTime: string): boolean {
  const [startHour] = startTime.split(':').map(Number);
  const [endHour] = endTime.split(':').map(Number);
  
  // Night shift if end hour is less than start hour
  return endHour < startHour;
}

/**
 * Get night shift configuration from rules
 */
export function getNightShiftConfig(
  rules: PolicyRule[]
): NightShiftRuleConfig | null {
  const nightRule = rules.find(r => r.rule_type === 'NIGHT_SHIFT' && r.is_active);
  if (!nightRule) return null;
  return nightRule.config as NightShiftRuleConfig;
}

// ============================================
// CALCULATION TRACE BUILDER
// ============================================

/**
 * Build a calculation trace for audit
 */
export function buildCalculationTrace(params: {
  summaryId: string;
  policyVersionId: string | null;
  workerId: string;
  workDate: Date;
  rawPunches: RawPunch[];
  roundedPunches: RoundedPunch[] | null;
  roundingDetails: Record<string, unknown> | null;
  rulesApplied: AppliedRule[];
  decisionPath: string;
  inputs: CalculationInputs;
  outputs: CalculationOutputs;
  overtimeBreakdown: OvertimeBreakdown[] | null;
  conflicts: ConflictCheckResult | null;
  anomalyReason: string | null;
}): Omit<CalculationTrace, 'id' | 'created_at'> {
  return {
    summary_id: params.summaryId,
    policy_version_id: params.policyVersionId,
    worker_id: params.workerId,
    work_date: params.workDate.toISOString().split('T')[0],
    raw_punches: params.rawPunches,
    rounded_punches: params.roundedPunches,
    rounding_details: params.roundingDetails,
    rules_applied: params.rulesApplied,
    decision_path: params.decisionPath,
    calculation_inputs: params.inputs,
    calculation_outputs: params.outputs,
    overtime_breakdown: params.overtimeBreakdown,
    conflicts_detected: params.conflicts?.has_conflict ? params.conflicts.conflicts : null,
    anomaly_reason: params.anomalyReason,
  };
}

/**
 * Save calculation trace to database
 */
export async function saveCalculationTrace(
  trace: Omit<CalculationTrace, 'id' | 'created_at'>
): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insertData: any = {
    summary_id: trace.summary_id,
    policy_version_id: trace.policy_version_id,
    worker_id: trace.worker_id,
    work_date: trace.work_date,
    raw_punches: trace.raw_punches,
    rounded_punches: trace.rounded_punches,
    rounding_details: trace.rounding_details,
    rules_applied: trace.rules_applied,
    decision_path: trace.decision_path,
    calculation_inputs: trace.calculation_inputs,
    calculation_outputs: trace.calculation_outputs,
    overtime_breakdown: trace.overtime_breakdown,
    conflicts_detected: trace.conflicts_detected,
    anomaly_reason: trace.anomaly_reason,
  };
  
  const { data, error } = await supabase
    .from('calculation_traces')
    .insert(insertData)
    .select('id')
    .single();
  
  if (error) {
    console.error('[RulesEngine] Failed to save calculation trace:', error);
    return null;
  }
  
  return data.id;
}

// ============================================
// MAIN RULES ENGINE
// ============================================

export interface RulesEngineResult {
  // Policy info
  policy_version_id: string | null;
  policy_code: string | null;
  
  // Processing results
  has_conflict: boolean;
  conflicts: Array<{ type: string; description: string }>;
  
  // Transformed data
  rounded_punches: RoundedPunch[];
  
  // Schedule info
  schedule: { start_time: string; end_time: string } | null;
  tolerance: { late_minutes: number; early_leave_minutes: number };
  
  // Overtime info
  overtime: OvertimeResult | null;
  
  // Audit trail
  rules_applied: AppliedRule[];
  decision_path: string[];
  
  // Anomaly
  anomaly: string | null;
}

/**
 * Main entry point: Process punches through all applicable rules
 */
export async function processWithRulesEngine(
  workerId: string,
  workDate: Date,
  rawPunches: RawPunch[],
  totalWorkMinutes: number
): Promise<RulesEngineResult> {
  const result: RulesEngineResult = {
    policy_version_id: null,
    policy_code: null,
    has_conflict: false,
    conflicts: [],
    rounded_punches: [],
    schedule: null,
    tolerance: { late_minutes: 15, early_leave_minutes: 15 },
    overtime: null,
    rules_applied: [],
    decision_path: [],
    anomaly: null,
  };
  
  // Step 1: Check for conflicts
  result.decision_path.push('P1:CONFLICT_CHECK');
  const conflictCheck = await checkPolicyConflicts(workerId, workDate);
  
  if (conflictCheck.has_conflict) {
    result.has_conflict = true;
    result.conflicts = conflictCheck.conflicts.map(c => ({
      type: c.conflict_type,
      description: c.description,
    }));
    result.anomaly = `POLICY_CONFLICT: ${conflictCheck.conflicts[0]?.description}`;
    result.decision_path.push('→ANOMALIE:POLICY_CONFLICT');
    return result;
  }
  
  // Step 2: Get applicable policy
  result.decision_path.push('P2:POLICY_LOOKUP');
  const policy = await getApplicablePolicy(workerId, workDate);
  
  if (!policy) {
    // No policy = use legacy behavior (no advanced rules)
    result.decision_path.push('→NO_POLICY:LEGACY_MODE');
    result.rounded_punches = rawPunches.map(p => ({
      ...p,
      original_time: p.occurred_at,
      rounded_time: p.occurred_at,
      rounding_rule_id: '',
      rounding_mode: 'NONE' as RoundingMode,
      adjustment_minutes: 0,
    }));
    return result;
  }
  
  result.policy_version_id = policy.policy_version_id;
  result.policy_code = policy.policy_code;
  result.decision_path.push(`→POLICY:${policy.policy_code}:v${policy.version_number}`);
  
  const rules = policy.rules_snapshot;
  
  // Step 3: Apply rounding rules
  result.decision_path.push('P3:ROUNDING');
  const roundingRule = rules.find(r => r.rule_type === 'ROUNDING' && r.is_active);
  const { punches: roundedPunches, appliedRule: roundingApplied } = applyRoundingRules(rawPunches, roundingRule ?? null);
  result.rounded_punches = roundedPunches;
  if (roundingApplied) {
    result.rules_applied.push(roundingApplied);
    result.decision_path.push(`→ROUNDING:${roundingRule?.name}`);
  }
  
  // Step 4: Get schedule for day
  result.decision_path.push('P4:SCHEDULE');
  const dayOfWeek = workDate.getDay();
  result.schedule = getScheduleFromRules(rules, dayOfWeek);
  result.tolerance = getToleranceFromRules(rules, dayOfWeek);
  
  if (result.schedule) {
    result.decision_path.push(`→SCHEDULE:${result.schedule.start_time}-${result.schedule.end_time}`);
  } else {
    result.decision_path.push('→NO_SCHEDULE');
  }
  
  // Step 5: Calculate overtime
  result.decision_path.push('P5:OVERTIME');
  const overtimeRule = rules.find(r => r.rule_type === 'OVERTIME' && r.is_active);
  result.overtime = calculateOvertime(totalWorkMinutes, overtimeRule ?? null);
  
  if (result.overtime.has_overtime) {
    result.rules_applied.push({
      rule_id: overtimeRule?.id ?? 'none',
      rule_type: 'OVERTIME',
      rule_name: overtimeRule?.name ?? 'Overtime',
      priority: overtimeRule?.priority ?? 0,
      applied_at: new Date().toISOString(),
      result: `${result.overtime.overtime_minutes}min overtime`,
      details: {
        regular_minutes: result.overtime.regular_minutes,
        overtime_minutes: result.overtime.overtime_minutes,
        breakdown: result.overtime.breakdown,
      },
    });
    result.decision_path.push(`→OVERTIME:${result.overtime.overtime_minutes}min`);
  }
  
  return result;
}

// ============================================
// HELPER: Format decision path for display
// ============================================

export function formatDecisionPath(path: string[]): string {
  return path.join(' → ');
}
