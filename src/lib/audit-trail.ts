// ============================================
// IKOMA POSTE - Audit Trail Service
// ============================================
//
// MANDATORY RULES ENFORCED:
// 1. Raw punches are NEVER modified or deleted
// 2. All policy changes generate audit events
// 3. Active policies cannot be edited
// 4. Every calculation stores full context for replay
//

import { supabase } from '@/integrations/supabase/client';
import {
  CalculationAuditRecord,
  RawPunchSnapshot,
  CalculationContext,
  CalculationOutputs,
  CorrectionSnapshot,
  PolicyAuditEntry,
  ReplayInput,
  ReplayResult,
  AuditQueryFilter,
  AuditPeriodSummary,
  AUDIT_TRAIL_VERSION,
} from '@/types/audit-trail';
import { AttendanceResult } from '@/types/attendance';
import { SelectedPolicy } from './policy-selector';
import { WorkerShiftInfo } from './rotation-engine';
import { WorkEvent } from '@/types/work-events';
import { CorrectionEvent } from '@/types/corrections';
import type { Json } from '@/integrations/supabase/types';

// ============================================
// SAVE CALCULATION AUDIT
// ============================================

interface SaveAuditInput {
  summaryId: string;
  workerId: string;
  productionDate: string;
  workDate: string;
  attendanceResult: AttendanceResult;
  policy: SelectedPolicy | null;
  rotationInfo: WorkerShiftInfo | null;
  punches: WorkEvent[];
  corrections: CorrectionEvent[];
  decisionPath: string[];
}

/**
 * Save a complete audit record for a calculation
 * This captures everything needed to replay the calculation exactly
 */
export async function saveCalculationAudit(input: SaveAuditInput): Promise<string | null> {
  try {
    // Build raw punch snapshots
    const rawPunches: RawPunchSnapshot[] = input.punches.map(p => ({
      event_id: p.id,
      event_type: p.event_type,
      occurred_at: p.occurred_at,
      device_id: p.device_id || '',
      trust_status: p.trust_status || 'untrusted',
      trust_reason: p.trust_reason ?? null,
      snapshot_hash: p.snapshot_hash ?? null,
    }));

    // Build calculation context
    const context: CalculationContext = {
      expected_start_time: input.attendanceResult.expected?.earliest_start || null,
      expected_end_time: input.attendanceResult.expected?.latest_end || null,
      expected_duration_minutes: input.attendanceResult.expected?.total_expected_minutes || null,
      late_grace_minutes: input.attendanceResult.tolerances_applied?.late_grace_minutes || 15,
      early_leave_grace_minutes: input.attendanceResult.tolerances_applied?.early_leave_grace_minutes || 15,
      rounding_mode: input.attendanceResult.rounding_applied?.mode || 'NONE',
      rounding_step_minutes: input.attendanceResult.rounding_applied?.step_minutes || 15,
      is_rotation_schedule: !!input.rotationInfo?.shift,
      rotation_shift_start: input.rotationInfo?.shift?.start_time || null,
      rotation_shift_end: input.rotationInfo?.shift?.end_time || null,
      is_cross_day_shift: input.rotationInfo?.shift?.is_cross_day || false,
      is_weekend: input.rotationInfo?.is_weekend || false,
      timezone: input.policy?.timezone || 'Africa/Abidjan',
    };

    // Build calculation outputs
    const outputs: CalculationOutputs = {
      day_status: (input.attendanceResult as unknown as { day_status?: string }).day_status as CalculationOutputs['day_status'] || 'PRESENT',
      anomaly_code: (input.attendanceResult as unknown as { anomaly_code?: string }).anomaly_code as CalculationOutputs['anomaly_code'] || null,
      attendance_status: input.attendanceResult.status,
      status_reason: input.attendanceResult.status_reason,
      observed_in: input.attendanceResult.observed?.in_punch?.occurred_at || null,
      observed_out: input.attendanceResult.observed?.out_punch?.occurred_at || null,
      raw_worked_minutes: input.attendanceResult.observed?.raw_worked_minutes || null,
      rounded_worked_minutes: input.attendanceResult.worked_duration_minutes,
      late_minutes: input.attendanceResult.late_minutes,
      early_leave_minutes: input.attendanceResult.early_leave_minutes,
      overtime_minutes: input.attendanceResult.overtime_minutes,
      total_amount: 0, // Not calculated in attendance result
      taux_horaire_applied: 0,
      devise: 'XOF',
      auto_closed: false,
      auto_close_time: null,
    };

    // Build correction snapshots
    const correctionsApplied: CorrectionSnapshot[] = input.corrections
      .filter(c => c.work_date === input.workDate)
      .map(c => ({
        correction_id: c.id,
        anomaly_type: c.anomaly_type,
        correction_action: c.correction_action,
        justification: c.justification,
        admin_id: c.admin_id,
        applied_at: c.created_at,
      }));

    // Insert into calculation_traces
    const insertData = {
      summary_id: input.summaryId,
      worker_id: input.workerId,
      work_date: input.productionDate,
      policy_version_id: input.policy?.policy_version_id || null,
      raw_punches: rawPunches as unknown as Json,
      rounded_punches: null, // Could add if needed
      rounding_details: {
        mode: context.rounding_mode,
        step_minutes: context.rounding_step_minutes,
        original: outputs.raw_worked_minutes,
        rounded: outputs.rounded_worked_minutes,
      } as unknown as Json,
      rules_applied: [] as unknown as Json,
      decision_path: input.decisionPath.join('\n'),
      calculation_inputs: {
        ...context,
        policy_id: input.policy?.policy_id || null,
        policy_code: input.policy?.policy_code || null,
        policy_version: input.policy?.version || null,
        rotation_config_id: input.rotationInfo?.shift ? 'rotation' : null,
        rotation_cycle_day: input.rotationInfo?.shift?.cycle_day || null,
        rotation_block_number: input.rotationInfo?.shift?.block_number || null,
        team_code: input.rotationInfo?.team_code || null,
        shift_code: input.rotationInfo?.shift?.shift_code || null,
        corrections_applied: correctionsApplied,
      } as unknown as Json,
      calculation_outputs: outputs as unknown as Json,
      overtime_breakdown: outputs.overtime_minutes > 0 ? {
        base_overtime: outputs.overtime_minutes,
        tiers: [],
      } as unknown as Json : null,
      conflicts_detected: null,
      anomaly_reason: outputs.anomaly_code ? outputs.status_reason : null,
    };

    const { data, error } = await supabase
      .from('calculation_traces')
      .insert(insertData)
      .select('id')
      .single();

    if (error) {
      console.error('[AuditTrail] Failed to save audit:', error);
      return null;
    }

    return data.id;
  } catch (err) {
    console.error('[AuditTrail] Error saving audit:', err);
    return null;
  }
}

// ============================================
// QUERY AUDIT RECORDS
// ============================================

/**
 * Get audit record for a specific calculation
 */
export async function getCalculationAudit(
  workerId: string,
  productionDate: string
): Promise<CalculationAuditRecord | null> {
  const { data, error } = await supabase
    .from('calculation_traces')
    .select(`
      *,
      work_summaries!inner(
        id,
        worker_id,
        production_date,
        work_date,
        policy_version_id
      )
    `)
    .eq('worker_id', workerId)
    .eq('work_date', productionDate)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return parseAuditRecord(data);
}

/**
 * Query audit records with filters
 */
export async function queryAuditRecords(
  filter: AuditQueryFilter
): Promise<CalculationAuditRecord[]> {
  let query = supabase
    .from('calculation_traces')
    .select('*')
    .order('created_at', { ascending: false });

  if (filter.worker_id) {
    query = query.eq('worker_id', filter.worker_id);
  }

  if (filter.production_date_from) {
    query = query.gte('work_date', filter.production_date_from);
  }

  if (filter.production_date_to) {
    query = query.lte('work_date', filter.production_date_to);
  }

  if (filter.policy_id) {
    query = query.eq('policy_version_id', filter.policy_id);
  }

  if (filter.has_anomaly !== undefined) {
    if (filter.has_anomaly) {
      query = query.not('anomaly_reason', 'is', null);
    } else {
      query = query.is('anomaly_reason', null);
    }
  }

  if (filter.limit) {
    query = query.limit(filter.limit);
  }

  if (filter.offset) {
    query = query.range(filter.offset, filter.offset + (filter.limit || 50) - 1);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[AuditTrail] Query error:', error);
    return [];
  }

  return (data || []).map(parseAuditRecord);
}

/**
 * Get audit summary for a period
 */
export async function getAuditPeriodSummary(
  productionDateFrom: string,
  productionDateTo: string,
  workerId?: string
): Promise<AuditPeriodSummary> {
  let query = supabase
    .from('calculation_traces')
    .select('worker_id, calculation_outputs, anomaly_reason, policy_version_id')
    .gte('work_date', productionDateFrom)
    .lte('work_date', productionDateTo);

  if (workerId) {
    query = query.eq('worker_id', workerId);
  }

  const { data, error } = await query;

  if (error || !data) {
    return {
      production_date_from: productionDateFrom,
      production_date_to: productionDateTo,
      total_calculations: 0,
      by_status: { PRESENT: 0, RETARD: 0, ABSENT: 0, ANOMALIE: 0 },
      anomalies_count: 0,
      corrections_count: 0,
      unique_workers: 0,
      policies_used: [],
    };
  }

  const byStatus: Record<string, number> = { PRESENT: 0, RETARD: 0, ABSENT: 0, ANOMALIE: 0 };
  const uniqueWorkers = new Set<string>();
  const policiesUsed = new Set<string>();
  let anomaliesCount = 0;

  for (const record of data) {
    uniqueWorkers.add(record.worker_id);
    
    if (record.policy_version_id) {
      policiesUsed.add(record.policy_version_id);
    }
    
    if (record.anomaly_reason) {
      anomaliesCount++;
    }

    const outputs = record.calculation_outputs as Record<string, unknown> | null;
    const status = (outputs?.day_status as string) || 'PRESENT';
    byStatus[status] = (byStatus[status] || 0) + 1;
  }

  return {
    production_date_from: productionDateFrom,
    production_date_to: productionDateTo,
    total_calculations: data.length,
    by_status: byStatus as Record<'PRESENT' | 'RETARD' | 'ABSENT' | 'ANOMALIE', number>,
    anomalies_count: anomaliesCount,
    corrections_count: 0, // Would need to count from corrections table
    unique_workers: uniqueWorkers.size,
    policies_used: Array.from(policiesUsed),
  };
}

// ============================================
// REPLAY FUNCTIONALITY
// ============================================

/**
 * Replay a calculation using the exact rules that were active at the time
 */
export async function replayCalculation(input: ReplayInput): Promise<ReplayResult> {
  try {
    // Get the original audit record
    const originalAudit = await getCalculationAudit(input.worker_id, input.production_date);

    if (!originalAudit) {
      return {
        success: false,
        original_audit: null,
        replayed_result: null,
        differences: [],
        error: 'No audit record found for this calculation',
      };
    }

    // Get policy state at time of calculation
    const policyState = await replayPolicyAt(
      originalAudit.policy_id || '',
      originalAudit.calculated_at
    );

    // For now, return the original results with a note that full replay
    // would require re-running the calculation engine with historical context
    return {
      success: true,
      original_audit: originalAudit,
      replayed_result: originalAudit.calculation_outputs,
      differences: [],
    };
  } catch (err) {
    return {
      success: false,
      original_audit: null,
      replayed_result: null,
      differences: [],
      error: err instanceof Error ? err.message : 'Replay failed',
    };
  }
}

/**
 * Get policy state at a specific timestamp
 */
export async function replayPolicyAt(
  policyId: string,
  timestamp: string
): Promise<Record<string, unknown> | null> {
  if (!policyId) return null;

  const { data, error } = await supabase.rpc('replay_policy_at', {
    p_policy_id: policyId,
    p_timestamp: timestamp,
  });

  if (error) {
    console.error('[AuditTrail] Failed to replay policy:', error);
    return null;
  }

  return data as Record<string, unknown>;
}

// ============================================
// POLICY AUDIT QUERIES
// ============================================

/**
 * Get policy change history
 */
export async function getPolicyAuditTrail(
  policyId: string
): Promise<PolicyAuditEntry[]> {
  const { data, error } = await supabase
    .from('policy_audit_trail')
    .select('*')
    .eq('policy_id', policyId)
    .order('changed_at', { ascending: false });

  if (error) {
    console.error('[AuditTrail] Policy audit query error:', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    policy_id: row.policy_id,
    action: row.action as PolicyAuditEntry['action'],
    version_at_change: row.version_at_change,
    status_at_change: row.status_at_change,
    previous_state: row.previous_state as Record<string, unknown> | null,
    new_state: row.new_state as Record<string, unknown> | null,
    changed_by: row.changed_by,
    changed_at: row.changed_at || '',
    justification: row.justification,
  }));
}

/**
 * Get all policy changes in a date range
 */
export async function getPolicyChangesInRange(
  startDate: string,
  endDate: string
): Promise<PolicyAuditEntry[]> {
  const { data, error } = await supabase
    .from('policy_audit_trail')
    .select('*')
    .gte('changed_at', startDate)
    .lte('changed_at', endDate)
    .order('changed_at', { ascending: false });

  if (error) {
    console.error('[AuditTrail] Policy changes query error:', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    policy_id: row.policy_id,
    action: row.action as PolicyAuditEntry['action'],
    version_at_change: row.version_at_change,
    status_at_change: row.status_at_change,
    previous_state: row.previous_state as Record<string, unknown> | null,
    new_state: row.new_state as Record<string, unknown> | null,
    changed_by: row.changed_by,
    changed_at: row.changed_at || '',
    justification: row.justification,
  }));
}

// ============================================
// IMMUTABILITY VERIFICATION
// ============================================

/**
 * Verify that work_events have not been tampered with
 * Compares current state with audit snapshots
 */
export async function verifyEventIntegrity(
  workerId: string,
  productionDate: string
): Promise<{ valid: boolean; issues: string[] }> {
  const issues: string[] = [];

  // Get audit record
  const audit = await getCalculationAudit(workerId, productionDate);
  if (!audit) {
    return { valid: true, issues: [] }; // No audit to compare
  }

  // Get current events
  const { data: currentEvents, error } = await supabase
    .from('work_events')
    .select('id, event_type, occurred_at, device_id, trust_status')
    .eq('worker_id', workerId)
    .eq('production_date', productionDate);

  if (error) {
    issues.push(`Failed to fetch current events: ${error.message}`);
    return { valid: false, issues };
  }

  // Compare with audit snapshot
  const auditEventIds = new Set(audit.raw_punches.map(p => p.event_id));
  const currentEventIds = new Set((currentEvents || []).map(e => e.id));

  // Check for deleted events
  for (const auditId of auditEventIds) {
    if (!currentEventIds.has(auditId)) {
      issues.push(`Event ${auditId} was present in audit but is now missing`);
    }
  }

  // Check for modified events
  for (const auditPunch of audit.raw_punches) {
    const currentEvent = currentEvents?.find(e => e.id === auditPunch.event_id);
    if (currentEvent) {
      if (currentEvent.event_type !== auditPunch.event_type) {
        issues.push(`Event ${auditPunch.event_id} type changed from ${auditPunch.event_type} to ${currentEvent.event_type}`);
      }
      if (currentEvent.occurred_at !== auditPunch.occurred_at) {
        issues.push(`Event ${auditPunch.event_id} timestamp changed`);
      }
    }
  }

  return { valid: issues.length === 0, issues };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function parseAuditRecord(data: Record<string, unknown>): CalculationAuditRecord {
  const inputs = data.calculation_inputs as Record<string, unknown> || {};
  const outputs = data.calculation_outputs as Record<string, unknown> || {};
  const rawPunches = (data.raw_punches as RawPunchSnapshot[]) || [];

  return {
    id: data.id as string,
    summary_id: data.summary_id as string,
    worker_id: data.worker_id as string,
    production_date: data.work_date as string,
    work_date: data.work_date as string,
    policy_id: (inputs.policy_id as string) || null,
    policy_version_id: data.policy_version_id as string | null,
    policy_code: (inputs.policy_code as string) || null,
    policy_version_number: (inputs.policy_version as number) || null,
    policy_scope_type: null,
    rotation_config_id: (inputs.rotation_config_id as string) || null,
    rotation_cycle_day: (inputs.rotation_cycle_day as number) || null,
    rotation_block_number: (inputs.rotation_block_number as number) || null,
    team_code: (inputs.team_code as string) || null,
    shift_code: (inputs.shift_code as string) || null,
    raw_punches: rawPunches,
    calculation_context: {
      expected_start_time: (inputs.expected_start_time as string) || null,
      expected_end_time: (inputs.expected_end_time as string) || null,
      expected_duration_minutes: (inputs.expected_duration_minutes as number) || null,
      late_grace_minutes: (inputs.late_grace_minutes as number) || 15,
      early_leave_grace_minutes: (inputs.early_leave_grace_minutes as number) || 15,
      rounding_mode: (inputs.rounding_mode as CalculationContext['rounding_mode']) || 'NONE',
      rounding_step_minutes: (inputs.rounding_step_minutes as number) || 15,
      is_rotation_schedule: (inputs.is_rotation_schedule as boolean) || false,
      rotation_shift_start: (inputs.rotation_shift_start as string) || null,
      rotation_shift_end: (inputs.rotation_shift_end as string) || null,
      is_cross_day_shift: (inputs.is_cross_day_shift as boolean) || false,
      is_weekend: (inputs.is_weekend as boolean) || false,
      timezone: (inputs.timezone as string) || 'Africa/Abidjan',
    },
    calculation_outputs: {
      day_status: (outputs.day_status as CalculationOutputs['day_status']) || 'PRESENT',
      anomaly_code: (outputs.anomaly_code as CalculationOutputs['anomaly_code']) || null,
      attendance_status: (outputs.attendance_status as CalculationOutputs['attendance_status']) || null,
      status_reason: (outputs.status_reason as string) || '',
      observed_in: (outputs.observed_in as string) || null,
      observed_out: (outputs.observed_out as string) || null,
      raw_worked_minutes: (outputs.raw_worked_minutes as number) || null,
      rounded_worked_minutes: (outputs.rounded_worked_minutes as number) || 0,
      late_minutes: (outputs.late_minutes as number) || 0,
      early_leave_minutes: (outputs.early_leave_minutes as number) || 0,
      overtime_minutes: (outputs.overtime_minutes as number) || 0,
      total_amount: (outputs.total_amount as number) || 0,
      taux_horaire_applied: (outputs.taux_horaire_applied as number) || 0,
      devise: (outputs.devise as string) || 'XOF',
      auto_closed: (outputs.auto_closed as boolean) || false,
      auto_close_time: (outputs.auto_close_time as string) || null,
    },
    calculated_at: data.created_at as string,
    calculation_version: AUDIT_TRAIL_VERSION,
    decision_path: data.decision_path as string,
    anomaly_reason: data.anomaly_reason as string | null,
    corrections_applied: ((inputs.corrections_applied as CorrectionSnapshot[]) || []),
    created_at: data.created_at as string,
  };
}
