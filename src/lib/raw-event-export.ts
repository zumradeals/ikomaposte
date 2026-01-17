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
}

// ============================================================================
// NORMALIZATION MAPPINGS (STRICT)
// ============================================================================

/**
 * Normalizes event_type to action_type
 * TAKE → POINTAGE_ENTREE
 * END → POINTAGE_SORTIE
 * PAUSE → PAUSE
 * RESUME → REPRISE
 */
function normalizeActionType(eventType: string): string {
  switch (eventType) {
    case 'TAKE':
      return 'POINTAGE_ENTREE';
    case 'END':
      return 'POINTAGE_SORTIE';
    case 'PAUSE':
      return 'PAUSE';
    case 'RESUME':
      return 'REPRISE';
    default:
      return eventType; // Preserve unknown values as-is
  }
}

/**
 * Normalizes trust_status to channel_status
 * trusted → NOMINAL
 * untrusted/unknown/other → DEGRADE
 */
function normalizeChannelStatus(trustStatus: string): string {
  if (trustStatus === 'trusted') {
    return 'NOMINAL';
  }
  return 'DEGRADE';
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
 * STRICT RULES:
 * - NO INFERENCE - missing fields are left empty
 * - NULL → empty string (never literal "null")
 * - action_type normalized to POINTAGE_ENTREE/POINTAGE_SORTIE
 * - channel_status normalized to NOMINAL/DEGRADE
 * - event_state defaults to NORMAL
 * - state_set_by defaults to SYSTEM
 */
export function mapEventToRow(source: SourceEventData): RawEventRow {
  return {
    // Direct mappings with null safety
    event_id: safeString(source.id),
    event_timestamp: safeString(source.occurred_at), // Already ISO 8601 from Supabase
    worker_matricule: safeString(source.worker_matricule),
    worker_name: safeString(source.worker_name),
    
    // Normalized action type
    action_type: normalizeActionType(safeString(source.event_type)),
    
    // Device info
    device_id: safeString(source.device_id),
    device_label: safeString(source.device_label),
    
    // No source data - empty string
    capture_mode: '',
    
    // Normalized channel status
    channel_status: normalizeChannelStatus(safeString(source.trust_status)),
    
    // Defaults per contract
    event_state: 'NORMAL',
    state_reason: safeString(source.trust_reason),
    state_set_at: safeString(source.created_at),
    state_set_by: 'SYSTEM',
    
    // Production date as work_date
    work_date: safeString(source.production_date),
    
    // No source data - empty string
    shift_code: '',
    
    // Map incident_flag to sequence_status
    sequence_status: safeString(source.incident_flag),
    
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
