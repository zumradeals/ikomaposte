// ============================================
// IKOMA Working Time Policies Engine v4.0
// Enhanced Model with Audit Replay Support
// ============================================

// ----------------------
// Enums (matching database)
// ----------------------

export type RuleType = 
  | 'SCHEDULE'     // Basic working hours
  | 'ROUNDING'     // Quarter-hour rounding
  | 'TOLERANCE'    // Late/early tolerance  
  | 'OVERTIME'     // Overtime calculation
  | 'NIGHT_SHIFT'  // Cross-day handling
  | 'BREAK'        // Mandatory break rules
  | 'ROTATION';    // Team rotation pattern

export type RoundingMode = 
  | 'NONE'           // Exact time (no rounding)
  | 'NEAREST'        // Round to nearest step
  | 'FLOOR'          // Round down
  | 'CEIL'           // Round up
  // Legacy (still supported)
  | 'QUARTER_CEIL'   
  | 'QUARTER_FLOOR'  
  | 'QUARTER_NEAREST';

export type PolicyStatus = 
  | 'DRAFT'      // Being configured
  | 'ACTIVE'     // Currently in use
  | 'SUPERSEDED' // Replaced by newer version
  | 'ARCHIVED';  // No longer used

export type ShiftPatternType = 
  | 'DAY'        // Standard day shift (8h-17h)
  | 'MORNING'    // Morning shift (6h-14h)
  | 'AFTERNOON'  // Afternoon shift (14h-22h)
  | 'NIGHT'      // Night shift (22h-6h)
  | 'FLEX'       // Flexible hours
  | 'ROTATING';  // Rotating 3x8

export type CrossDayStrategy = 
  | 'MERGE_TO_START_DAY'  // Night shift counts for start day
  | 'MERGE_TO_END_DAY'    // Night shift counts for end day
  | 'SPLIT_AT_MIDNIGHT';  // Split at midnight (not recommended)

export type PolicyScopeType = 
  | 'individual'   // Applies to a specific worker
  | 'team'         // Applies to a team
  | 'category'     // Applies to a worker category
  | 'default';     // Default policy (applies to all)

export type OvertimeMode = 
  | 'DAILY'           // Overtime calculated per day
  | 'WEEKLY'          // Overtime calculated per week
  | 'OUTSIDE_SCHEDULE'; // Any time outside scheduled hours

// ----------------------
// Rule Configuration Types
// ----------------------

/** Schedule rule configuration */
export interface ScheduleRuleConfig {
  days: number[];       // 0=Sun, 1=Mon, ..., 6=Sat
  start_time: string;   // HH:MM format
  end_time: string;     // HH:MM format
  shift_pattern_id?: string;
}

/** Rounding rule configuration */
export interface RoundingRuleConfig {
  checkin_mode: RoundingMode;
  checkout_mode: RoundingMode;
  break_mode?: RoundingMode;
}

/** Tolerance rule configuration */
export interface ToleranceRuleConfig {
  late_minutes: number;          // Minutes allowed late
  early_leave_minutes: number;   // Minutes allowed early leave
  apply_to_all_days: boolean;    // Apply to all working days
  specific_days?: number[];      // Or specific days only
}

/** Overtime rule tier */
export interface OvertimeTier {
  from_minutes: number;
  to_minutes: number | null;  // null = unlimited
  multiplier: number;         // e.g., 1.25, 1.50
}

/** Overtime rule configuration */
export interface OvertimeRuleConfig {
  daily_threshold_minutes: number;
  weekly_threshold_minutes?: number;
  monthly_threshold_minutes?: number;
  tiers: OvertimeTier[];
  include_weekends: boolean;
  include_holidays: boolean;
}

/** Night shift rule configuration */
export interface NightShiftRuleConfig {
  night_start: string;           // HH:MM format (e.g., "22:00")
  night_end: string;             // HH:MM format (e.g., "06:00")
  cross_day_strategy: CrossDayStrategy;
  night_premium_multiplier?: number;
}

/** Break rule configuration */
export interface BreakRuleConfig {
  mandatory_break_after_minutes: number;
  break_duration_minutes: number;
  is_paid: boolean;
  auto_deduct: boolean;
}

/** Rotation rule configuration */
export interface RotationRuleConfig {
  pattern_weeks: number;         // e.g., 3 for 3-week rotation
  team_count: number;            // Number of teams
  shift_sequence: string[];      // e.g., ["MORNING", "AFTERNOON", "NIGHT"]
}

/** Union type for all rule configs */
export type RuleConfig = 
  | ScheduleRuleConfig 
  | RoundingRuleConfig 
  | ToleranceRuleConfig
  | OvertimeRuleConfig
  | NightShiftRuleConfig
  | BreakRuleConfig
  | RotationRuleConfig;

// ----------------------
// v4.0 Enhanced Types
// ----------------------

/** Time slot within a weekday pattern */
export interface TimeSlot {
  start_time: string;         // HH:MM format
  end_time: string;           // HH:MM format
  allow_cross_day: boolean;   // Allows end_time < start_time (night shift)
}

/** Weekday configuration in week pattern */
export interface WeekdayConfig {
  working_day: boolean;
  time_slots: TimeSlot[];
}

/** Week pattern - defines working hours for each day */
export interface WeekPattern {
  monday: WeekdayConfig;
  tuesday: WeekdayConfig;
  wednesday: WeekdayConfig;
  thursday: WeekdayConfig;
  friday: WeekdayConfig;
  saturday: WeekdayConfig;
  sunday: WeekdayConfig;
}

/** Per-day tolerance override */
export interface DayToleranceOverride {
  day: keyof WeekPattern;
  late_grace_minutes: number;
  early_leave_grace_minutes: number;
}

/** Tolerances configuration */
export interface TolerancesConfig {
  late_grace_minutes: number;
  early_leave_grace_minutes: number;
  day_overrides: Record<string, DayToleranceOverride>;
}

/** Rounding rules configuration */
export interface RoundingRulesConfig {
  mode: RoundingMode;
  step_minutes: number;               // e.g., 15
  apply_to: ('worked_time' | 'overtime_time')[];
}

/** Overtime rules configuration */
export interface OvertimeRulesConfig {
  mode: OvertimeMode;
  threshold_hours: number;
  approval_required: boolean;
}

/** Policy scope - defines who this policy applies to */
export interface PolicyScope {
  id: string;
  policy_id: string;
  scope_type: PolicyScopeType;
  target_id: string | null;   // NULL for 'default' scope
  priority: number;           // Higher priority wins in conflicts
  created_at: string;
}

/** Policy audit trail entry */
export interface PolicyAuditEntry {
  id: string;
  policy_id: string;
  action: 'created' | 'activated' | 'archived' | 'version_bumped';
  previous_state: Record<string, unknown> | null;
  new_state: Record<string, unknown>;
  changed_by: string;
  changed_at: string;
  justification: string | null;
  version_at_change: number;
  status_at_change: PolicyStatus;
}

// ----------------------
// Entity Types
// ----------------------

/** Time Policy v4.0 (comprehensive model) */
export interface TimePolicy {
  id: string;
  code: string;
  name: string;
  description: string | null;
  // v4.0 fields
  version: number;
  status: PolicyStatus;
  timezone: string;
  valid_from: string | null;
  valid_to: string | null;
  week_pattern: WeekPattern;
  tolerances: TolerancesConfig;
  rounding_rules: RoundingRulesConfig;
  overtime_rules: OvertimeRulesConfig;
  justification: string | null;
  immutable_when_active: boolean;
  // Legacy compatibility
  applies_to_category_id: string | null;
  is_active: boolean;
  // Audit
  created_at: string;
  created_by: string;
  updated_at: string;
  // Relations (optional, loaded separately)
  scopes?: PolicyScope[];
}

/** Policy Version (immutable snapshot) */
export interface PolicyVersion {
  id: string;
  policy_id: string;
  version_number: number;
  valid_from: string;
  valid_to: string | null;
  status: PolicyStatus;
  rules_snapshot: PolicyRule[];
  change_reason: string | null;
  created_at: string;
  created_by: string;
  superseded_by: string | null;
}

/** Policy Rule */
export interface PolicyRule {
  id: string;
  policy_version_id: string;
  rule_type: RuleType;
  priority: number;
  name: string;
  config: RuleConfig;
  shift_pattern_id: string | null;
  is_active: boolean;
  created_at: string;
}

/** Shift Pattern */
export interface ShiftPattern {
  id: string;
  code: string;
  name: string;
  pattern_type: ShiftPatternType;
  shifts: ShiftDefinition[];
  cross_day: boolean;
  cross_day_strategy: CrossDayStrategy | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Individual shift within a pattern */
export interface ShiftDefinition {
  name: string;
  start_time: string;  // HH:MM
  end_time: string;    // HH:MM
  days: number[];      // Days this shift applies
}

/** Rotation Calendar */
export interface RotationCalendar {
  id: string;
  name: string;
  policy_id: string;
  rotation_pattern: RotationPattern;
  team_assignments: TeamAssignment[];
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Rotation pattern definition */
export interface RotationPattern {
  cycle_weeks: number;
  shifts_per_cycle: ShiftAssignment[];
}

/** Shift assignment in rotation */
export interface ShiftAssignment {
  week: number;        // Week in cycle (1-based)
  team: string;        // Team identifier
  shift_type: ShiftPatternType;
}

/** Team assignment */
export interface TeamAssignment {
  team_id: string;
  team_name: string;
  worker_ids: string[];
}

// ----------------------
// Calculation Trace Types
// ----------------------

/** Raw punch data (immutable) */
export interface RawPunch {
  event_id: string;
  event_type: string;
  occurred_at: string;
  device_id: string;
  trust_status: string;
}

/** Rounded punch data */
export interface RoundedPunch extends RawPunch {
  original_time: string;
  rounded_time: string;
  rounding_rule_id: string;
  rounding_mode: RoundingMode;
  adjustment_minutes: number;
}

/** Rule application record */
export interface AppliedRule {
  rule_id: string;
  rule_type: RuleType;
  rule_name: string;
  priority: number;
  applied_at: string;
  result: string;        // What the rule produced
  details: Record<string, unknown>;
}

/** Overtime breakdown */
export interface OvertimeBreakdown {
  tier_index: number;
  from_minutes: number;
  to_minutes: number;
  minutes_worked: number;
  multiplier: number;
  equivalent_minutes: number;  // minutes_worked * multiplier
}

/** Calculation trace (full audit) */
export interface CalculationTrace {
  id: string;
  summary_id: string;
  policy_version_id: string | null;
  worker_id: string;
  work_date: string;
  raw_punches: RawPunch[];
  rounded_punches: RoundedPunch[] | null;
  rounding_details: Record<string, unknown> | null;
  rules_applied: AppliedRule[];
  decision_path: string;
  calculation_inputs: CalculationInputs;
  calculation_outputs: CalculationOutputs;
  overtime_breakdown: OvertimeBreakdown[] | null;
  conflicts_detected: PolicyConflict[] | null;
  anomaly_reason: string | null;
  created_at: string;
}

/** Calculation inputs */
export interface CalculationInputs {
  worker_id: string;
  work_date: string;
  category_id: string;
  policy_version_id: string | null;
  schedule: {
    start_time: string;
    end_time: string;
    tolerance_late: number;
    tolerance_early: number;
  } | null;
  corrections_count: number;
}

/** Calculation outputs */
export interface CalculationOutputs {
  day_status: string;
  anomaly_code: string | null;
  total_work_minutes: number;
  total_pause_minutes: number;
  late_minutes: number;
  overtime_minutes: number;
  total_amount: number;
  devise: string;
}

/** Policy conflict */
export interface PolicyConflict {
  id?: string;
  worker_id: string;
  work_date: string;
  conflict_type: string;
  conflicting_policies: string[];
  description: string;
  resolution: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at?: string;
}

// ----------------------
// Engine Result Types
// ----------------------

/** Result of policy lookup */
export interface ApplicablePolicyResult {
  policy_id: string;
  policy_version_id: string;
  policy_code: string;
  version_number: number;
  rules_snapshot: PolicyRule[];
}

/** Conflict check result */
export interface ConflictCheckResult {
  has_conflict: boolean;
  conflicts: PolicyConflict[];
}

/** Rounding result */
export interface RoundingResult {
  original_time: Date;
  rounded_time: Date;
  adjustment_minutes: number;
  mode: RoundingMode;
}

/** Overtime calculation result */
export interface OvertimeResult {
  has_overtime: boolean;
  regular_minutes: number;
  overtime_minutes: number;
  breakdown: OvertimeBreakdown[];
  total_equivalent_minutes: number;  // Including multipliers
}

// ----------------------
// UI Labels
// ----------------------

export const RULE_TYPE_LABELS: Record<RuleType, string> = {
  SCHEDULE: 'Horaires',
  ROUNDING: 'Arrondi',
  TOLERANCE: 'Tolérance',
  OVERTIME: 'Heures supplémentaires',
  NIGHT_SHIFT: 'Poste de nuit',
  BREAK: 'Pause',
  ROTATION: 'Rotation',
};

export const POLICY_STATUS_LABELS: Record<PolicyStatus, string> = {
  DRAFT: 'Brouillon',
  ACTIVE: 'Actif',
  SUPERSEDED: 'Remplacé',
  ARCHIVED: 'Archivé',
};

export const SHIFT_PATTERN_LABELS: Record<ShiftPatternType, string> = {
  DAY: 'Journée',
  MORNING: 'Matin',
  AFTERNOON: 'Après-midi',
  NIGHT: 'Nuit',
  FLEX: 'Flexible',
  ROTATING: 'Rotation 3x8',
};

export const ROUNDING_MODE_LABELS: Record<RoundingMode, string> = {
  NONE: 'Aucun',
  NEAREST: 'Arrondi au plus proche',
  FLOOR: 'Arrondi inférieur',
  CEIL: 'Arrondi supérieur',
  // Legacy support
  QUARTER_CEIL: 'Arrondi supérieur (15min)',
  QUARTER_FLOOR: 'Arrondi inférieur (15min)',
  QUARTER_NEAREST: 'Arrondi au plus proche (15min)',
};

export const OVERTIME_MODE_LABELS: Record<OvertimeMode, string> = {
  DAILY: 'Journalier',
  WEEKLY: 'Hebdomadaire',
  OUTSIDE_SCHEDULE: 'Hors horaire planifié',
};

export const SCOPE_TYPE_LABELS: Record<PolicyScopeType, string> = {
  individual: 'Individuel',
  team: 'Équipe',
  category: 'Catégorie',
  default: 'Par défaut',
};

export const SCOPE_TYPE_PRIORITY: Record<PolicyScopeType, number> = {
  individual: 100,
  team: 75,
  category: 50,
  default: 0,
};

export const CROSS_DAY_STRATEGY_LABELS: Record<CrossDayStrategy, string> = {
  MERGE_TO_START_DAY: 'Compte sur jour de début',
  MERGE_TO_END_DAY: 'Compte sur jour de fin',
  SPLIT_AT_MIDNIGHT: 'Diviser à minuit',
};

export const POLICY_STATUS_COLORS: Record<PolicyStatus, string> = {
  DRAFT: 'bg-muted text-muted-foreground border-muted',
  ACTIVE: 'bg-success/20 text-success border-success/30',
  SUPERSEDED: 'bg-warning/20 text-warning border-warning/30',
  ARCHIVED: 'bg-destructive/20 text-destructive border-destructive/30',
};
