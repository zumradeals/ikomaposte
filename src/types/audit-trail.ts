// ============================================
// IKOMA POSTE - Audit Trail Types
// ============================================
//
// MANDATORY RULES:
// 1. Raw punches are NEVER modified or deleted
// 2. All policy changes generate audit events
// 3. Active policies cannot be edited (only new versions)
// 4. Every calculation stores: policy_id, policy_version, rotation_cycle_id, production_date
//
// REPLAY CAPABILITY:
// The system MUST allow full replay of past periods using exact rules active at that time.
//

import { WorkEventType } from './work-events';
import { AttendanceStatus } from './attendance';
import { DayStatusType, AnomalyCodeType } from './business-rules';
import { PolicyScopeType, RoundingMode } from './policies';

// ============================================
// CALCULATION AUDIT RECORD
// ============================================

/**
 * Immutable record of a calculation result
 * Stores everything needed to replay the exact calculation
 */
export interface CalculationAuditRecord {
  id: string;
  
  // Reference identifiers
  summary_id: string;
  worker_id: string;
  production_date: string;  // YYYY-MM-DD
  work_date: string;        // YYYY-MM-DD (may differ from production_date)
  
  // Policy reference (for replay)
  policy_id: string | null;
  policy_version_id: string | null;
  policy_code: string | null;
  policy_version_number: number | null;
  policy_scope_type: PolicyScopeType | null;
  
  // Rotation reference (for replay)
  rotation_config_id: string | null;
  rotation_cycle_day: number | null;
  rotation_block_number: number | null;
  team_code: string | null;
  shift_code: string | null;
  
  // Immutable input snapshot
  raw_punches: RawPunchSnapshot[];
  
  // Calculation context snapshot
  calculation_context: CalculationContext;
  
  // Calculation results
  calculation_outputs: CalculationOutputs;
  
  // Audit metadata
  calculated_at: string;
  calculation_version: string;
  decision_path: string;
  
  // Optional details
  anomaly_reason: string | null;
  corrections_applied: CorrectionSnapshot[];
  
  created_at: string;
}

/**
 * Immutable snapshot of a raw punch
 */
export interface RawPunchSnapshot {
  event_id: string;
  event_type: WorkEventType;
  occurred_at: string;
  device_id: string;
  trust_status: string;
  trust_reason: string | null;
  snapshot_hash: string | null;
  is_virtual?: boolean;
  virtual_reason?: string;
}

/**
 * Snapshot of calculation context at time of calculation
 */
export interface CalculationContext {
  // Schedule from policy
  expected_start_time: string | null;
  expected_end_time: string | null;
  expected_duration_minutes: number | null;
  
  // Tolerances from policy
  late_grace_minutes: number;
  early_leave_grace_minutes: number;
  
  // Rounding from policy
  rounding_mode: RoundingMode;
  rounding_step_minutes: number;
  
  // Rotation context (if applicable)
  is_rotation_schedule: boolean;
  rotation_shift_start: string | null;
  rotation_shift_end: string | null;
  is_cross_day_shift: boolean;
  is_weekend: boolean;
  
  // Timezone
  timezone: string;
}

/**
 * Outputs from calculation
 */
export interface CalculationOutputs {
  // Status
  day_status: DayStatusType;
  anomaly_code: AnomalyCodeType | null;
  attendance_status: AttendanceStatus | null;
  status_reason: string;
  
  // Timing
  observed_in: string | null;
  observed_out: string | null;
  raw_worked_minutes: number | null;
  rounded_worked_minutes: number;
  
  // Penalties
  late_minutes: number;
  early_leave_minutes: number;
  
  // Overtime
  overtime_minutes: number;
  
  // Financial
  total_amount: number;
  taux_horaire_applied: number;
  devise: string;
  
  // Auto-close
  auto_closed: boolean;
  auto_close_time: string | null;
}

/**
 * Snapshot of correction applied
 */
export interface CorrectionSnapshot {
  correction_id: string;
  anomaly_type: string;
  correction_action: string;
  justification: string;
  admin_id: string;
  applied_at: string;
}

// ============================================
// POLICY AUDIT TYPES
// ============================================

/**
 * Policy change action types
 */
export type PolicyAuditAction = 
  | 'created'
  | 'updated'
  | 'activated'
  | 'deactivated'
  | 'archived'
  | 'version_bumped'
  | 'scope_added'
  | 'scope_removed';

/**
 * Policy audit entry (mirrors policy_audit_trail table)
 */
export interface PolicyAuditEntry {
  id: string;
  policy_id: string;
  action: PolicyAuditAction;
  version_at_change: number;
  status_at_change: string;
  previous_state: Record<string, unknown> | null;
  new_state: Record<string, unknown> | null;
  changed_by: string;
  changed_at: string;
  justification: string | null;
}

// ============================================
// REPLAY TYPES
// ============================================

/**
 * Input for replaying a calculation
 */
export interface ReplayInput {
  worker_id: string;
  production_date: string;
  as_of_timestamp?: string;  // Optional: replay as of specific time
}

/**
 * Result from replaying a calculation
 */
export interface ReplayResult {
  success: boolean;
  original_audit: CalculationAuditRecord | null;
  replayed_result: CalculationOutputs | null;
  differences: ReplayDifference[];
  error?: string;
}

/**
 * Difference found during replay
 */
export interface ReplayDifference {
  field: string;
  original_value: unknown;
  replayed_value: unknown;
  significance: 'info' | 'warning' | 'error';
}

// ============================================
// AUDIT QUERY TYPES
// ============================================

/**
 * Filter for querying audit records
 */
export interface AuditQueryFilter {
  worker_id?: string;
  production_date_from?: string;
  production_date_to?: string;
  policy_id?: string;
  has_anomaly?: boolean;
  day_status?: DayStatusType;
  limit?: number;
  offset?: number;
}

/**
 * Summary of audit for a period
 */
export interface AuditPeriodSummary {
  production_date_from: string;
  production_date_to: string;
  total_calculations: number;
  by_status: Record<DayStatusType, number>;
  anomalies_count: number;
  corrections_count: number;
  unique_workers: number;
  policies_used: string[];
}

// ============================================
// IMMUTABILITY ENFORCEMENT
// ============================================

/**
 * Error thrown when attempting to modify immutable data
 */
export class ImmutabilityViolationError extends Error {
  constructor(
    public readonly table: string,
    public readonly operation: 'UPDATE' | 'DELETE',
    public readonly recordId: string
  ) {
    super(`Immutability violation: Cannot ${operation} ${table} record ${recordId}`);
    this.name = 'ImmutabilityViolationError';
  }
}

/**
 * Error thrown when attempting to modify active policy
 */
export class ActivePolicyModificationError extends Error {
  constructor(
    public readonly policyId: string,
    public readonly policyCode: string
  ) {
    super(`Cannot modify active policy ${policyCode}. Create a new version instead.`);
    this.name = 'ActivePolicyModificationError';
  }
}

// ============================================
// CONSTANTS
// ============================================

/**
 * Version of the audit trail system
 */
export const AUDIT_TRAIL_VERSION = '1.0.0';

/**
 * Tables with immutability rules
 */
export const IMMUTABLE_TABLES = {
  work_events: { allow_update: false, allow_delete: false },
  calculation_traces: { allow_update: false, allow_delete: false },
  policy_audit_trail: { allow_update: false, allow_delete: false },
  correction_events: { allow_update: false, allow_delete: false },
} as const;
