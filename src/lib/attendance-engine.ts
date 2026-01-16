// ============================================
// IKOMA Attendance Engine v1.0
// ============================================
//
// Core calculation engine for daily attendance
// Integrates policy selection, punch analysis, and rounding
//
// DOCTRINE:
// 1. Expected time = sum of policy time slots
// 2. Observed time = IN (first punch) to OUT (last punch)
// 3. Apply tolerances BEFORE penalties
// 4. Apply rounding ONLY to calculated durations
// 5. Every status MUST be explainable
//

import {
  AttendanceStatus,
  AttendanceResult,
  AttendanceCalculationInput,
  ExpectedSchedule,
  ExpectedTimeSlot,
  ObservedAttendance,
  ObservedPunch,
  AppliedTolerances,
  AppliedRounding,
  PolicyReference,
  PunchEvent,
  AttendanceEngineConfig,
  DEFAULT_ENGINE_CONFIG,
} from '@/types/attendance';
import {
  selectPolicyForWorker,
  getToleranceForDay,
  PolicySelectionResult,
  SelectedPolicy,
} from './policy-selector';
import { RoundingMode, WeekPattern, WeekdayConfig } from '@/types/policies';

// Engine version for traceability
export const ATTENDANCE_ENGINE_VERSION = '1.0.0';

// ============================================
// MAIN CALCULATION FUNCTION
// ============================================

/**
 * Calculate daily attendance for a worker
 * 
 * This is the main entry point for the attendance engine.
 * It orchestrates policy selection, punch analysis, and status determination.
 */
export async function calculateDailyAttendance(
  input: AttendanceCalculationInput,
  punches: PunchEvent[],
  config: AttendanceEngineConfig = DEFAULT_ENGINE_CONFIG
): Promise<AttendanceResult> {
  const decisionPath: string[] = [];
  const calculatedAt = new Date().toISOString();
  const dayOfWeek = new Date(input.production_date).getDay();
  
  decisionPath.push(`[START] Worker: ${input.worker_id}, Date: ${input.production_date}`);
  decisionPath.push(`[INFO] Day of week: ${dayOfWeek} (0=Sun, 6=Sat)`);
  decisionPath.push(`[INFO] Total punches received: ${punches.length}`);
  
  // Step 1: Select applicable policy
  decisionPath.push('[STEP 1] Selecting policy...');
  const policyResult = await selectPolicyForWorker({
    worker_id: input.worker_id,
    production_date: input.production_date,
    worker_category_id: input.worker_category_id,
    worker_team_id: input.worker_team_id,
  });
  
  // Handle policy selection errors
  if (policyResult.has_conflict) {
    decisionPath.push('[RESULT] Policy conflict detected');
    return buildErrorResult(
      input,
      dayOfWeek,
      'POLICY_CONFLICT',
      `Conflit: ${policyResult.conflicting_policies.length} politiques au même niveau de priorité`,
      decisionPath,
      calculatedAt,
      config
    );
  }
  
  if (!policyResult.success || !policyResult.policy) {
    decisionPath.push(`[RESULT] No policy found: ${policyResult.error}`);
    return buildErrorResult(
      input,
      dayOfWeek,
      'CONFIG_ERROR',
      `Aucune politique applicable: ${policyResult.error || 'politique non trouvée'}`,
      decisionPath,
      calculatedAt,
      config
    );
  }
  
  const policy = policyResult.policy;
  decisionPath.push(`[POLICY] Selected: ${policy.policy_code} v${policy.version} (${policy.scope_type})`);
  
  // Step 2: Extract expected schedule from policy
  decisionPath.push('[STEP 2] Extracting expected schedule...');
  const expected = extractExpectedSchedule(policy, dayOfWeek);
  
  if (!expected.is_working_day) {
    decisionPath.push('[RESULT] Non-working day');
    return buildNonWorkingDayResult(
      input,
      dayOfWeek,
      expected,
      policy,
      decisionPath,
      calculatedAt,
      config
    );
  }
  
  decisionPath.push(`[SCHEDULE] Expected: ${expected.earliest_start} - ${expected.latest_end}`);
  decisionPath.push(`[SCHEDULE] Total expected: ${expected.total_expected_minutes} minutes`);
  
  // Step 3: Analyze punches
  decisionPath.push('[STEP 3] Analyzing punches...');
  const observed = analyzePunches(punches, expected, decisionPath);
  
  // Step 4: Check for incomplete punches
  if (!observed.in_punch || !observed.out_punch) {
    const missingPunch = !observed.in_punch ? 'IN' : 'OUT';
    decisionPath.push(`[RESULT] Missing ${missingPunch} punch`);
    
    // If no punches at all on a working day -> ABSENT
    if (!observed.in_punch && !observed.out_punch) {
      return buildAbsentResult(
        input,
        dayOfWeek,
        expected,
        observed,
        policy,
        decisionPath,
        calculatedAt,
        config
      );
    }
    
    return buildIncompletePunchResult(
      input,
      dayOfWeek,
      expected,
      observed,
      policy,
      missingPunch,
      decisionPath,
      calculatedAt,
      config
    );
  }
  
  decisionPath.push(`[OBSERVED] IN: ${observed.in_punch.occurred_at}`);
  decisionPath.push(`[OBSERVED] OUT: ${observed.out_punch.occurred_at}`);
  decisionPath.push(`[OBSERVED] Raw worked: ${observed.raw_worked_minutes} minutes`);
  
  // Step 5: Get tolerances
  decisionPath.push('[STEP 5] Applying tolerances...');
  const tolerances = getTolerancesForCalculation(policy, dayOfWeek, config);
  decisionPath.push(`[TOLERANCE] Late grace: ${tolerances.late_grace_minutes}min, Early leave grace: ${tolerances.early_leave_grace_minutes}min`);
  
  // Step 6: Calculate penalties (after tolerance)
  decisionPath.push('[STEP 6] Calculating penalties...');
  const { lateMinutes, earlyLeaveMinutes } = calculatePenalties(
    observed,
    expected,
    tolerances,
    decisionPath
  );
  
  // Step 7: Apply rounding to worked duration
  decisionPath.push('[STEP 7] Applying rounding...');
  const rounding = applyRounding(
    observed.raw_worked_minutes || 0,
    policy.rounding_rules.mode,
    policy.rounding_rules.step_minutes,
    decisionPath
  );
  
  // Step 8: Calculate overtime
  decisionPath.push('[STEP 8] Calculating overtime...');
  const overtimeMinutes = Math.max(0, rounding.rounded_minutes - expected.total_expected_minutes);
  decisionPath.push(`[OVERTIME] ${overtimeMinutes} minutes (worked ${rounding.rounded_minutes} - expected ${expected.total_expected_minutes})`);
  
  // Step 9: Determine final status
  decisionPath.push('[STEP 9] Determining status...');
  const { status, reason } = determineStatus(lateMinutes, earlyLeaveMinutes, decisionPath);
  
  // Build final result
  return {
    status,
    status_reason: reason,
    worker_id: input.worker_id,
    production_date: input.production_date,
    day_of_week: dayOfWeek,
    expected,
    observed,
    worked_duration_minutes: rounding.rounded_minutes,
    overtime_minutes: overtimeMinutes,
    late_minutes: lateMinutes,
    early_leave_minutes: earlyLeaveMinutes,
    tolerances_applied: tolerances,
    rounding_applied: rounding,
    policy: buildPolicyReference(policy),
    calculated_at: calculatedAt,
    calculation_version: ATTENDANCE_ENGINE_VERSION,
    decision_path: decisionPath,
  };
}

// ============================================
// SCHEDULE EXTRACTION
// ============================================

/**
 * Extract expected schedule from policy week pattern
 */
function extractExpectedSchedule(policy: SelectedPolicy, dayOfWeek: number): ExpectedSchedule {
  const dayKey = getDayKey(dayOfWeek);
  const dayConfig = policy.week_pattern[dayKey];
  
  if (!dayConfig?.working_day || !dayConfig.time_slots?.length) {
    return {
      is_working_day: false,
      time_slots: [],
      total_expected_minutes: 0,
      earliest_start: null,
      latest_end: null,
    };
  }
  
  const slots: ExpectedTimeSlot[] = dayConfig.time_slots.map(slot => ({
    start_time: slot.start_time,
    end_time: slot.end_time,
    duration_minutes: calculateSlotDuration(slot.start_time, slot.end_time, slot.allow_cross_day),
    is_cross_day: slot.allow_cross_day || false,
  }));
  
  const totalMinutes = slots.reduce((sum, s) => sum + s.duration_minutes, 0);
  
  // Find earliest start and latest end
  const starts = slots.map(s => s.start_time).sort();
  const ends = slots.map(s => s.end_time).sort();
  
  return {
    is_working_day: true,
    time_slots: slots,
    total_expected_minutes: totalMinutes,
    earliest_start: starts[0] || null,
    latest_end: ends[ends.length - 1] || null,
  };
}

/**
 * Get week pattern key from day of week number
 */
function getDayKey(dayOfWeek: number): keyof WeekPattern {
  const map: Record<number, keyof WeekPattern> = {
    0: 'sunday',
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday',
    6: 'saturday',
  };
  return map[dayOfWeek] || 'monday';
}

/**
 * Calculate duration of a time slot in minutes
 */
function calculateSlotDuration(startTime: string, endTime: string, isCrossDay: boolean): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  
  let startMinutes = startH * 60 + startM;
  let endMinutes = endH * 60 + endM;
  
  // Handle cross-day slots (e.g., 22:00 - 06:00)
  if (isCrossDay || endMinutes < startMinutes) {
    endMinutes += 24 * 60; // Add 24 hours
  }
  
  return endMinutes - startMinutes;
}

// ============================================
// PUNCH ANALYSIS
// ============================================

/**
 * Analyze punches to find IN and OUT
 */
function analyzePunches(
  punches: PunchEvent[],
  expected: ExpectedSchedule,
  decisionPath: string[]
): ObservedAttendance {
  // Filter trusted punches only
  const trustedPunches = punches.filter(p => p.trust_status === 'trusted');
  decisionPath.push(`[PUNCHES] Trusted: ${trustedPunches.length}/${punches.length}`);
  
  // Sort by time
  const sorted = [...trustedPunches].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
  );
  
  // Find IN = first TAKE
  const inPunch = sorted.find(p => p.event_type === 'TAKE');
  
  // Find OUT = last END (or last punch if no END)
  const endPunches = sorted.filter(p => p.event_type === 'END');
  const outPunch = endPunches.length > 0 
    ? endPunches[endPunches.length - 1] 
    : null;
  
  // Convert to observed format
  const observedIn: ObservedPunch | null = inPunch ? {
    event_id: inPunch.id,
    event_type: 'TAKE',
    occurred_at: inPunch.occurred_at,
    is_trusted: true,
  } : null;
  
  const observedOut: ObservedPunch | null = outPunch ? {
    event_id: outPunch.id,
    event_type: 'END',
    occurred_at: outPunch.occurred_at,
    is_trusted: true,
  } : null;
  
  // Calculate raw worked minutes
  let rawWorkedMinutes: number | null = null;
  if (observedIn && observedOut) {
    const inTime = new Date(observedIn.occurred_at).getTime();
    const outTime = new Date(observedOut.occurred_at).getTime();
    rawWorkedMinutes = Math.floor((outTime - inTime) / 60000);
  }
  
  return {
    in_punch: observedIn,
    out_punch: observedOut,
    raw_worked_minutes: rawWorkedMinutes,
    all_punches: sorted.map(p => ({
      event_id: p.id,
      event_type: p.event_type as 'TAKE' | 'END',
      occurred_at: p.occurred_at,
      is_trusted: p.trust_status === 'trusted',
    })),
  };
}

// ============================================
// TOLERANCE & PENALTIES
// ============================================

/**
 * Get tolerances for calculation
 */
function getTolerancesForCalculation(
  policy: SelectedPolicy,
  dayOfWeek: number,
  config: AttendanceEngineConfig
): AppliedTolerances {
  try {
    const policyTolerances = getToleranceForDay(policy, dayOfWeek);
    return {
      late_grace_minutes: policyTolerances.late_minutes,
      early_leave_grace_minutes: policyTolerances.early_leave_minutes,
      source: 'policy',
    };
  } catch {
    return {
      late_grace_minutes: config.default_late_grace_minutes,
      early_leave_grace_minutes: config.default_early_leave_grace_minutes,
      source: 'default',
    };
  }
}

/**
 * Calculate late and early leave penalties
 */
function calculatePenalties(
  observed: ObservedAttendance,
  expected: ExpectedSchedule,
  tolerances: AppliedTolerances,
  decisionPath: string[]
): { lateMinutes: number; earlyLeaveMinutes: number } {
  if (!observed.in_punch || !observed.out_punch || !expected.earliest_start || !expected.latest_end) {
    return { lateMinutes: 0, earlyLeaveMinutes: 0 };
  }
  
  // Parse expected times
  const expectedStartDate = parseTimeToDate(expected.earliest_start, observed.in_punch.occurred_at);
  const expectedEndDate = parseTimeToDate(expected.latest_end, observed.out_punch.occurred_at);
  
  // Parse observed times
  const observedIn = new Date(observed.in_punch.occurred_at);
  const observedOut = new Date(observed.out_punch.occurred_at);
  
  // Calculate raw lateness
  const rawLateMinutes = Math.floor((observedIn.getTime() - expectedStartDate.getTime()) / 60000);
  decisionPath.push(`[LATE] Raw: ${rawLateMinutes}min (IN ${observedIn.toISOString()} vs expected ${expectedStartDate.toISOString()})`);
  
  // Apply tolerance
  const lateMinutes = Math.max(0, rawLateMinutes - tolerances.late_grace_minutes);
  decisionPath.push(`[LATE] After tolerance (${tolerances.late_grace_minutes}min): ${lateMinutes}min`);
  
  // Calculate raw early leave
  const rawEarlyLeaveMinutes = Math.floor((expectedEndDate.getTime() - observedOut.getTime()) / 60000);
  decisionPath.push(`[EARLY] Raw: ${rawEarlyLeaveMinutes}min (OUT ${observedOut.toISOString()} vs expected ${expectedEndDate.toISOString()})`);
  
  // Apply tolerance
  const earlyLeaveMinutes = Math.max(0, rawEarlyLeaveMinutes - tolerances.early_leave_grace_minutes);
  decisionPath.push(`[EARLY] After tolerance (${tolerances.early_leave_grace_minutes}min): ${earlyLeaveMinutes}min`);
  
  return { lateMinutes, earlyLeaveMinutes };
}

/**
 * Parse a time string (HH:MM) to a Date using reference date
 */
function parseTimeToDate(time: string, referenceIso: string): Date {
  const refDate = new Date(referenceIso);
  const [hours, minutes] = time.split(':').map(Number);
  
  const result = new Date(refDate);
  result.setHours(hours, minutes, 0, 0);
  
  return result;
}

// ============================================
// ROUNDING
// ============================================

/**
 * Apply rounding to minutes
 */
function applyRounding(
  minutes: number,
  mode: RoundingMode,
  stepMinutes: number,
  decisionPath: string[]
): AppliedRounding {
  let roundedMinutes = minutes;
  
  switch (mode) {
    case 'NONE':
      // No rounding
      break;
      
    case 'NEAREST':
    case 'QUARTER_NEAREST':
      roundedMinutes = Math.round(minutes / stepMinutes) * stepMinutes;
      break;
      
    case 'FLOOR':
    case 'QUARTER_FLOOR':
      roundedMinutes = Math.floor(minutes / stepMinutes) * stepMinutes;
      break;
      
    case 'CEIL':
    case 'QUARTER_CEIL':
      roundedMinutes = Math.ceil(minutes / stepMinutes) * stepMinutes;
      break;
  }
  
  const adjustment = roundedMinutes - minutes;
  decisionPath.push(`[ROUNDING] ${mode}: ${minutes}min → ${roundedMinutes}min (${adjustment >= 0 ? '+' : ''}${adjustment}min)`);
  
  return {
    mode,
    step_minutes: stepMinutes,
    original_minutes: minutes,
    rounded_minutes: roundedMinutes,
    adjustment_minutes: adjustment,
  };
}

// ============================================
// STATUS DETERMINATION
// ============================================

/**
 * Determine final status based on penalties
 * Priority: LATE > EARLY_LEAVE > OK
 */
function determineStatus(
  lateMinutes: number,
  earlyLeaveMinutes: number,
  decisionPath: string[]
): { status: AttendanceStatus; reason: string } {
  if (lateMinutes > 0) {
    const reason = `Retard de ${lateMinutes} minutes (après tolérance)`;
    decisionPath.push(`[STATUS] LATE: ${reason}`);
    return { status: 'LATE', reason };
  }
  
  if (earlyLeaveMinutes > 0) {
    const reason = `Départ anticipé de ${earlyLeaveMinutes} minutes (après tolérance)`;
    decisionPath.push(`[STATUS] EARLY_LEAVE: ${reason}`);
    return { status: 'EARLY_LEAVE', reason };
  }
  
  const reason = 'Présence normale, dans les tolérances';
  decisionPath.push(`[STATUS] OK: ${reason}`);
  return { status: 'OK', reason };
}

// ============================================
// RESULT BUILDERS
// ============================================

function buildPolicyReference(policy: SelectedPolicy): PolicyReference {
  return {
    policy_id: policy.policy_id,
    policy_code: policy.policy_code,
    policy_name: policy.policy_name,
    version: policy.version,
    scope_type: policy.scope_type,
  };
}

function buildEmptyObserved(): ObservedAttendance {
  return {
    in_punch: null,
    out_punch: null,
    raw_worked_minutes: null,
    all_punches: [],
  };
}

function buildEmptyExpected(): ExpectedSchedule {
  return {
    is_working_day: false,
    time_slots: [],
    total_expected_minutes: 0,
    earliest_start: null,
    latest_end: null,
  };
}

function buildDefaultTolerances(config: AttendanceEngineConfig): AppliedTolerances {
  return {
    late_grace_minutes: config.default_late_grace_minutes,
    early_leave_grace_minutes: config.default_early_leave_grace_minutes,
    source: 'default',
  };
}

function buildErrorResult(
  input: AttendanceCalculationInput,
  dayOfWeek: number,
  status: AttendanceStatus,
  reason: string,
  decisionPath: string[],
  calculatedAt: string,
  config: AttendanceEngineConfig
): AttendanceResult {
  return {
    status,
    status_reason: reason,
    worker_id: input.worker_id,
    production_date: input.production_date,
    day_of_week: dayOfWeek,
    expected: buildEmptyExpected(),
    observed: buildEmptyObserved(),
    worked_duration_minutes: 0,
    overtime_minutes: 0,
    late_minutes: 0,
    early_leave_minutes: 0,
    tolerances_applied: buildDefaultTolerances(config),
    rounding_applied: null,
    policy: null,
    calculated_at: calculatedAt,
    calculation_version: ATTENDANCE_ENGINE_VERSION,
    decision_path: decisionPath,
  };
}

function buildNonWorkingDayResult(
  input: AttendanceCalculationInput,
  dayOfWeek: number,
  expected: ExpectedSchedule,
  policy: SelectedPolicy,
  decisionPath: string[],
  calculatedAt: string,
  config: AttendanceEngineConfig
): AttendanceResult {
  return {
    status: 'NON_WORKING_DAY',
    status_reason: 'Jour non travaillé selon la politique',
    worker_id: input.worker_id,
    production_date: input.production_date,
    day_of_week: dayOfWeek,
    expected,
    observed: buildEmptyObserved(),
    worked_duration_minutes: 0,
    overtime_minutes: 0,
    late_minutes: 0,
    early_leave_minutes: 0,
    tolerances_applied: buildDefaultTolerances(config),
    rounding_applied: null,
    policy: buildPolicyReference(policy),
    calculated_at: calculatedAt,
    calculation_version: ATTENDANCE_ENGINE_VERSION,
    decision_path: decisionPath,
  };
}

function buildAbsentResult(
  input: AttendanceCalculationInput,
  dayOfWeek: number,
  expected: ExpectedSchedule,
  observed: ObservedAttendance,
  policy: SelectedPolicy,
  decisionPath: string[],
  calculatedAt: string,
  config: AttendanceEngineConfig
): AttendanceResult {
  return {
    status: 'ABSENT',
    status_reason: 'Aucun pointage sur un jour travaillé',
    worker_id: input.worker_id,
    production_date: input.production_date,
    day_of_week: dayOfWeek,
    expected,
    observed,
    worked_duration_minutes: 0,
    overtime_minutes: 0,
    late_minutes: 0,
    early_leave_minutes: 0,
    tolerances_applied: getTolerancesForCalculation(policy, dayOfWeek, config),
    rounding_applied: null,
    policy: buildPolicyReference(policy),
    calculated_at: calculatedAt,
    calculation_version: ATTENDANCE_ENGINE_VERSION,
    decision_path: decisionPath,
  };
}

function buildIncompletePunchResult(
  input: AttendanceCalculationInput,
  dayOfWeek: number,
  expected: ExpectedSchedule,
  observed: ObservedAttendance,
  policy: SelectedPolicy,
  missingPunch: string,
  decisionPath: string[],
  calculatedAt: string,
  config: AttendanceEngineConfig
): AttendanceResult {
  return {
    status: 'INCOMPLETE_PUNCH',
    status_reason: `Pointage incomplet: ${missingPunch} manquant`,
    worker_id: input.worker_id,
    production_date: input.production_date,
    day_of_week: dayOfWeek,
    expected,
    observed,
    worked_duration_minutes: 0,
    overtime_minutes: 0,
    late_minutes: 0,
    early_leave_minutes: 0,
    tolerances_applied: getTolerancesForCalculation(policy, dayOfWeek, config),
    rounding_applied: null,
    policy: buildPolicyReference(policy),
    calculated_at: calculatedAt,
    calculation_version: ATTENDANCE_ENGINE_VERSION,
    decision_path: decisionPath,
  };
}

// ============================================
// ENHANCED CALCULATION WITH AUDIT TRAIL
// ============================================

import { saveCalculationAudit } from './audit-trail';
import { getWorkerShiftInfo, WorkerShiftInfo } from './rotation-engine';
import { WorkEvent } from '@/types/work-events';
import { CorrectionEvent } from '@/types/corrections';

/**
 * Extended result with full audit context
 */
export interface EnhancedAttendanceResult extends AttendanceResult {
  // Rotation context
  rotation_info: WorkerShiftInfo | null;
  
  // Policy version for replay
  policy_version_id: string | null;
  
  // Audit record ID (if saved)
  audit_record_id: string | null;
}

/**
 * Calculate daily attendance with full audit trail
 * 
 * This function:
 * 1. Runs the standard attendance calculation
 * 2. Fetches rotation context for the worker
 * 3. Saves a complete audit record for replay capability
 * 
 * @param input Worker and date info
 * @param punches Raw punch events (immutable)
 * @param corrections Any corrections to apply
 * @param summaryId Optional existing summary ID to link
 * @param config Engine configuration
 */
export async function calculateDailyAttendanceWithAudit(
  input: AttendanceCalculationInput,
  punches: WorkEvent[],
  corrections: CorrectionEvent[],
  summaryId: string | null = null,
  config: AttendanceEngineConfig = DEFAULT_ENGINE_CONFIG
): Promise<EnhancedAttendanceResult> {
  // Convert WorkEvents to PunchEvents for calculation
  const punchEvents: PunchEvent[] = punches.map(p => ({
    id: p.id,
    event_type: p.event_type,
    occurred_at: p.occurred_at,
    trust_status: p.trust_status,
  }));
  
  // Run standard calculation
  const result = await calculateDailyAttendance(input, punchEvents, config);
  
  // Fetch rotation context
  let rotationInfo: WorkerShiftInfo | null = null;
  try {
    rotationInfo = await getWorkerShiftInfo(input.worker_id, input.production_date);
  } catch (err) {
    console.warn('[AttendanceEngine] Failed to fetch rotation info:', err);
  }
  
  // Build enhanced result
  const enhancedResult: EnhancedAttendanceResult = {
    ...result,
    rotation_info: rotationInfo,
    policy_version_id: result.policy ? (result.policy as PolicyReference & { policy_version_id?: string }).policy_version_id || null : null,
    audit_record_id: null,
  };
  
  // Save audit trail if we have a summary ID
  if (summaryId) {
    try {
      const auditId = await saveCalculationAudit({
        summaryId,
        workerId: input.worker_id,
        productionDate: input.production_date,
        workDate: input.production_date,
        attendanceResult: result,
        policy: result.policy ? {
          policy_id: result.policy.policy_id,
          policy_version_id: null,
          policy_name: result.policy.policy_name,
          policy_code: result.policy.policy_code,
          version: result.policy.version,
          scope_type: result.policy.scope_type,
          scope_priority: 0,
          week_pattern: {} as any,
          tolerances: {} as any,
          rounding_rules: {} as any,
          overtime_rules: {} as any,
          timezone: 'Africa/Abidjan',
        } : null,
        rotationInfo,
        punches,
        corrections,
        decisionPath: result.decision_path,
      });
      enhancedResult.audit_record_id = auditId;
    } catch (err) {
      console.error('[AttendanceEngine] Failed to save audit:', err);
    }
  }
  
  return enhancedResult;
}

// ============================================
// UTILITY EXPORTS
// ============================================

/**
 * Format duration in minutes as human readable
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h${mins.toString().padStart(2, '0')}`;
}

/**
 * Get status severity for sorting/display
 */
export function getStatusSeverity(status: AttendanceStatus): number {
  const severities: Record<AttendanceStatus, number> = {
    CONFIG_ERROR: 100,
    POLICY_CONFLICT: 90,
    INCOMPLETE_PUNCH: 80,
    ABSENT: 70,
    LATE: 50,
    EARLY_LEAVE: 40,
    NON_WORKING_DAY: 10,
    OK: 0,
  };
  return severities[status] ?? 0;
}

/**
 * Check if status requires admin attention
 */
export function requiresAttention(status: AttendanceStatus): boolean {
  return ['CONFIG_ERROR', 'POLICY_CONFLICT', 'INCOMPLETE_PUNCH', 'ABSENT'].includes(status);
}
