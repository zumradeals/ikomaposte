// ============================================
// IKOMA Attendance Engine Types v1.0
// ============================================
//
// Unified types for daily attendance calculation
// Integrates with policy-selector and rotation-engine
//

import { RoundingMode, PolicyScopeType } from './policies';

// ----------------------
// Attendance Status
// ----------------------

/**
 * All possible daily attendance statuses
 * Each status MUST be explainable with a reason
 */
export type AttendanceStatus =
  | 'OK'                  // Normal day, within tolerances
  | 'LATE'                // Arrived after grace period
  | 'EARLY_LEAVE'         // Left before grace period
  | 'ABSENT'              // No punches on a working day
  | 'NON_WORKING_DAY'     // Weekend or not scheduled to work
  | 'INCOMPLETE_PUNCH'    // Missing IN or OUT punch
  | 'POLICY_CONFLICT'     // Multiple policies matched at same priority
  | 'CONFIG_ERROR';       // No policy found or invalid configuration

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  OK: 'Présent',
  LATE: 'Retard',
  EARLY_LEAVE: 'Départ anticipé',
  ABSENT: 'Absent',
  NON_WORKING_DAY: 'Jour non travaillé',
  INCOMPLETE_PUNCH: 'Pointage incomplet',
  POLICY_CONFLICT: 'Conflit de politique',
  CONFIG_ERROR: 'Erreur de configuration',
};

export const ATTENDANCE_STATUS_COLORS: Record<AttendanceStatus, string> = {
  OK: 'bg-success/20 text-success border-success/30',
  LATE: 'bg-warning/20 text-warning border-warning/30',
  EARLY_LEAVE: 'bg-warning/20 text-warning border-warning/30',
  ABSENT: 'bg-destructive/20 text-destructive border-destructive/30',
  NON_WORKING_DAY: 'bg-muted text-muted-foreground border-muted',
  INCOMPLETE_PUNCH: 'bg-destructive/20 text-destructive border-destructive/30',
  POLICY_CONFLICT: 'bg-destructive/20 text-destructive border-destructive/30',
  CONFIG_ERROR: 'bg-destructive/20 text-destructive border-destructive/30',
};

// ----------------------
// Expected Schedule
// ----------------------

/** Time slot extracted from policy */
export interface ExpectedTimeSlot {
  start_time: string;   // HH:MM format
  end_time: string;     // HH:MM format
  duration_minutes: number;
  is_cross_day: boolean;
}

/** Expected schedule for a day */
export interface ExpectedSchedule {
  is_working_day: boolean;
  time_slots: ExpectedTimeSlot[];
  total_expected_minutes: number;
  earliest_start: string | null;  // First slot start
  latest_end: string | null;      // Last slot end
}

// ----------------------
// Observed Punches
// ----------------------

/** Punch window boundaries */
export interface PunchWindow {
  window_start: Date;   // Earliest valid punch time
  window_end: Date;     // Latest valid punch time
}

/** Observed punch data */
export interface ObservedPunch {
  event_id: string;
  event_type: 'TAKE' | 'END';
  occurred_at: string;
  is_trusted: boolean;
}

/** Observed attendance from punches */
export interface ObservedAttendance {
  in_punch: ObservedPunch | null;
  out_punch: ObservedPunch | null;
  raw_worked_minutes: number | null;  // Before rounding
  all_punches: ObservedPunch[];       // For audit
}

// ----------------------
// Tolerance & Rounding
// ----------------------

/** Tolerances applied to calculation */
export interface AppliedTolerances {
  late_grace_minutes: number;
  early_leave_grace_minutes: number;
  source: 'policy' | 'day_override' | 'default';
}

/** Rounding applied to calculation */
export interface AppliedRounding {
  mode: RoundingMode;
  step_minutes: number;
  original_minutes: number;
  rounded_minutes: number;
  adjustment_minutes: number;
}

// ----------------------
// Calculation Result
// ----------------------

/** Policy reference used in calculation */
export interface PolicyReference {
  policy_id: string;
  policy_code: string;
  policy_name: string;
  version: number;
  scope_type: PolicyScopeType;
}

/** Full attendance calculation result */
export interface AttendanceResult {
  // Core status
  status: AttendanceStatus;
  status_reason: string;  // Human-readable explanation
  
  // Worker & date context
  worker_id: string;
  production_date: string;
  day_of_week: number;    // 0=Sunday, 6=Saturday
  
  // Expected schedule (from policy)
  expected: ExpectedSchedule;
  
  // Observed punches
  observed: ObservedAttendance;
  
  // Calculated durations (in minutes, after rounding)
  worked_duration_minutes: number;
  overtime_minutes: number;
  
  // Penalties (after tolerance applied)
  late_minutes: number;           // 0 if within tolerance
  early_leave_minutes: number;    // 0 if within tolerance
  
  // Tolerance & rounding audit
  tolerances_applied: AppliedTolerances;
  rounding_applied: AppliedRounding | null;
  
  // Policy used
  policy: PolicyReference | null;
  
  // Calculation metadata
  calculated_at: string;
  calculation_version: string;
  decision_path: string[];  // Step-by-step trace
}

/** Input for attendance calculation */
export interface AttendanceCalculationInput {
  worker_id: string;
  production_date: string;  // YYYY-MM-DD
  worker_category_id?: string;
  worker_team_id?: string;
}

/** Punch event for calculation */
export interface PunchEvent {
  id: string;
  event_type: 'TAKE' | 'PAUSE' | 'RESUME' | 'END';
  occurred_at: string;
  trust_status: string;
}

// ----------------------
// Engine Configuration
// ----------------------

/** Engine configuration options */
export interface AttendanceEngineConfig {
  /** Default late grace if no policy specified */
  default_late_grace_minutes: number;
  /** Default early leave grace if no policy specified */
  default_early_leave_grace_minutes: number;
  /** Default rounding mode */
  default_rounding_mode: RoundingMode;
  /** Default rounding step */
  default_rounding_step_minutes: number;
  /** Punch window padding (hours before/after schedule) */
  punch_window_padding_hours: number;
}

export const DEFAULT_ENGINE_CONFIG: AttendanceEngineConfig = {
  default_late_grace_minutes: 15,
  default_early_leave_grace_minutes: 15,
  default_rounding_mode: 'NONE',
  default_rounding_step_minutes: 15,
  punch_window_padding_hours: 2,
};
