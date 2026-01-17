/**
 * IKOMA POSTE - Raw Event CSV Export
 * 
 * STRICT CONTRACT:
 * - One CSV row = one raw work_event
 * - No aggregation, no payroll logic, no time calculations
 * - Events are immutable
 * - UTF-8 encoding, ISO 8601 timestamps with timezone
 * - NULL values → empty string (never literal "null")
 */

// ============================================================================
// COLUMN SCHEMA (IMMUTABLE - DO NOT CHANGE ORDER)
// ============================================================================
export const RAW_EVENT_COLUMNS = [
  'event_id',
  'event_timestamp',
  'worker_matricule',
  'worker_name',
  'action_type',
  'device_id',
  'device_label',
  'capture_mode',
  'channel_status',
  'event_state',
  'state_reason',
  'state_set_at',
  'state_set_by',
  'work_date',
  'shift_code',
  'sequence_status',
  'hr_decision',
  'decision_reason',
  'decision_effect',
  'decision_at',
  'decision_by',
] as const;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================
export interface RawEventRow {
  event_id: string;
  event_timestamp: string; // ISO 8601 with timezone
  worker_matricule: string;
  worker_name: string;
  action_type: string; // POINTAGE_ENTREE | POINTAGE_SORTIE | PAUSE | REPRISE
  device_id: string;
  device_label: string;
  capture_mode: string;
  channel_status: string; // NOMINAL | DEGRADE
  event_state: string; // Default: NORMAL
  state_reason: string;
  state_set_at: string;
  state_set_by: string; // Default: SYSTEM
  work_date: string;
  shift_code: string;
  sequence_status: string;
  hr_decision: string;
  decision_reason: string;
  decision_effect: string;
  decision_at: string;
  decision_by: string;
}

// Source data structure from database query
export interface SourceEventData {
  // work_events fields
  id: string;
  occurred_at: string;
  event_type: string; // TAKE | END | PAUSE | RESUME
  device_id: string;
  trust_status: string;
  trust_reason: string | null;
  production_date: string | null;
  incident_flag: string | null;
  created_at: string;
  // Joined worker fields
  worker_matricule: string;
  worker_name: string;
  // Joined device fields
  device_label: string | null;
  // Export context (set by caller)
  export_date?: string; // YYYY-MM-DD fallback for work_date
}

// ============================================================================
// NORMALIZATION MAPPINGS (STRICT COMPLIANCE)
// ============================================================================

/**
 * Normalizes event_type to action_type
 * STRICT: Only POINTAGE_ENTREE and POINTAGE_SORTIE are valid
 * All other values → empty string
 * 
 * TAKE → POINTAGE_ENTREE
 * END → POINTAGE_SORTIE
 * PAUSE, RESUME, other → "" (empty)
 */
function normalizeActionType(eventType: string): string {
  const normalized = eventType.toUpperCase().trim();
  switch (normalized) {
    case 'TAKE':
      return 'POINTAGE_ENTREE';
    case 'END':
      return 'POINTAGE_SORTIE';
    default:
      return ''; // Strict: only entry/exit allowed
  }
}

/**
 * Normalizes trust_status to channel_status (CASE-INSENSITIVE)
 * trusted/TRUSTED/Trusted → NOMINAL
 * All other values → DEGRADE
 */
function normalizeChannelStatus(trustStatus: string): string {
  const normalized = trustStatus.toLowerCase().trim();
  if (normalized === 'trusted') {
    return 'NOMINAL';
  }
  return 'DEGRADE';
}

/**
 * Normalizes incident_flag to sequence_status
 * STRICT: Only COHERENT, INCOMPLET, INATTENDU are valid outputs
 * 
 * Mapping:
 * - null/empty/undefined → COHERENT (default)
 * - NO_CHECKOUT, NO_CHECKIN, missing_end, missing_take → INCOMPLET
 * - OUTLIER_DURATION, WEEKEND_PUNCH, invalid_sequence → INATTENDU
 * - Other flags → INATTENDU
 */
function normalizeSequenceStatus(incidentFlag: string | null): string {
  if (!incidentFlag || incidentFlag.trim() === '') {
    return 'COHERENT';
  }
  
  const normalized = incidentFlag.toUpperCase().trim();
  
  // INCOMPLET: Missing events
  const incompletFlags = [
    'NO_CHECKOUT',
    'NO_CHECKIN',
    'MISSING_END',
    'MISSING_TAKE',
    'DUPLICATE_CHECKIN',
    'DUPLICATE_CHECKOUT',
  ];
  if (incompletFlags.includes(normalized)) {
    return 'INCOMPLET';
  }
  
  // INATTENDU: Unexpected/anomalous events
  const inattenduFlags = [
    'OUTLIER_DURATION',
    'WEEKEND_PUNCH',
    'INVALID_SEQUENCE',
    'TIME_OVERLAP',
    'FUTURE_EVENT',
    'IMPOSSIBLE_DURATION',
  ];
  if (inattenduFlags.includes(normalized)) {
    return 'INATTENDU';
  }
  
  // Any other flag → INATTENDU (unexpected)
  return 'INATTENDU';
}

/**
 * Ensures timestamp is ISO 8601 with timezone
 * If no timezone present, appends 'Z' (UTC)
 */
function normalizeTimestamp(timestamp: string): string {
  if (!timestamp) return '';
  
  // Check if already has timezone indicator
  const hasTimezone = /[Zz]$/.test(timestamp) || /[+-]\d{2}:\d{2}$/.test(timestamp);
  
  if (hasTimezone) {
    return timestamp;
  }
  
  // Append Z for UTC if no timezone
  return timestamp + 'Z';
}

/**
 * Safely converts any value to string, converting null/undefined to empty string
 * NEVER outputs literal "null"
 */
function safeString(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  // Extra safety: if somehow we get literal "null" string, return empty
  if (str === 'null' || str === 'undefined') {
    return '';
  }
  return str;
}

// ============================================================================
// DATA MAPPING (NO INFERENCE, NO CALCULATION)
// ============================================================================

/**
 * Maps a single source event to the export row format
 * 
 * STRICT COMPLIANCE RULES:
 * - action_type: Only POINTAGE_ENTREE or POINTAGE_SORTIE (others → empty)
 * - work_date: Never empty (fallback to export_date)
 * - sequence_status: Only COHERENT, INCOMPLET, INATTENDU
 * - event_timestamp: ISO 8601 with timezone
 * - channel_status: Case-insensitive trusted check
 * - event_state: Default NORMAL
 * - state_set_by: Default SYSTEM
 * - NULL → empty string (never literal "null")
 */
export function mapEventToRow(source: SourceEventData): RawEventRow {
  // Determine work_date: production_date if available, else export_date
  const workDate = safeString(source.production_date) || safeString(source.export_date);
  
  return {
    // Direct mappings with null safety
    event_id: safeString(source.id),
    event_timestamp: normalizeTimestamp(safeString(source.occurred_at)),
    worker_matricule: safeString(source.worker_matricule),
    worker_name: safeString(source.worker_name),
    
    // STRICT: Only POINTAGE_ENTREE or POINTAGE_SORTIE
    action_type: normalizeActionType(safeString(source.event_type)),
    
    // Device info
    device_id: safeString(source.device_id),
    device_label: safeString(source.device_label),
    
    // No source data - empty string
    capture_mode: '',
    
    // Case-insensitive channel status
    channel_status: normalizeChannelStatus(safeString(source.trust_status)),
    
    // Defaults per contract
    event_state: 'NORMAL',
    state_reason: safeString(source.trust_reason),
    state_set_at: normalizeTimestamp(safeString(source.created_at)),
    state_set_by: 'SYSTEM',
    
    // Work date: never empty
    work_date: workDate,
    
    // No source data - empty string
    shift_code: '',
    
    // STRICT: Normalized sequence status
    sequence_status: normalizeSequenceStatus(source.incident_flag),
    
    // HR decision fields - no source, empty string
    hr_decision: '',
    decision_reason: '',
    decision_effect: '',
    decision_at: '',
    decision_by: '',
  };
}

// ============================================================================
// CSV GENERATION
// ============================================================================

/**
 * Escapes a CSV field value according to RFC 4180
 * - Fields containing comma, quote, or newline are quoted
 * - Quotes within fields are doubled
 * - Empty strings remain empty (not quoted)
 */
function escapeCSVField(value: string): string {
  // Ensure we never output literal "null"
  if (value === 'null' || value === 'undefined') {
    return '';
  }
  
  if (value === '') {
    return '';
  }
  
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  
  return value;
}

/**
 * Generates CSV content from mapped rows
 * 
 * STRICT RULES:
 * - UTF-8 encoding with BOM for Excel compatibility
 * - Column order as defined in RAW_EVENT_COLUMNS (immutable)
 * - CRLF line endings per RFC 4180
 * - Empty fields output as empty (not "null")
 */
export function generateRawEventCSV(rows: RawEventRow[]): string {
  // Header row - exact column order
  const header = RAW_EVENT_COLUMNS.join(',');
  
  // Data rows - strict column order
  const dataRows = rows.map(row => {
    return RAW_EVENT_COLUMNS.map(col => {
      const value = row[col];
      return escapeCSVField(safeString(value));
    }).join(',');
  });
  
  // Combine with BOM for Excel UTF-8 compatibility
  // CRLF line endings per RFC 4180
  const BOM = '\uFEFF';
  return BOM + [header, ...dataRows].join('\r\n');
}

/**
 * Triggers download of the CSV file
 */
export function downloadRawEventCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
