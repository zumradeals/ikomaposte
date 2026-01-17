/**
 * IKOMA POSTE - Raw Event CSV Export
 * 
 * STRICT CONTRACT:
 * - One CSV row = one raw work_event
 * - No aggregation, no payroll logic, no time calculations
 * - Events are immutable
 * - UTF-8 encoding, ISO 8601 timestamps with timezone
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
  action_type: string;
  device_id: string;
  device_label: string;
  capture_mode: string;
  channel_status: string;
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
  event_type: string;
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
// DATA MAPPING (NO INFERENCE, NO CALCULATION)
// ============================================================================

/**
 * Maps trust_status to channel_status
 * TRUSTED → NOMINAL
 * Other values mapped directly
 */
function mapChannelStatus(trustStatus: string): string {
  if (trustStatus === 'trusted') return 'NOMINAL';
  if (trustStatus === 'untrusted') return 'DEGRADED';
  if (trustStatus === 'unknown') return 'UNKNOWN';
  return trustStatus.toUpperCase();
}

/**
 * Maps a single source event to the export row format
 * NO INFERENCE - missing fields are left empty
 */
export function mapEventToRow(source: SourceEventData): RawEventRow {
  return {
    // Direct mappings
    event_id: source.id,
    event_timestamp: source.occurred_at, // Already ISO 8601 from Supabase
    worker_matricule: source.worker_matricule,
    worker_name: source.worker_name,
    action_type: source.event_type,
    device_id: source.device_id,
    device_label: source.device_label ?? '',
    
    // No source data - leave empty
    capture_mode: '',
    
    // Mapped value
    channel_status: mapChannelStatus(source.trust_status),
    
    // Defaults per contract
    event_state: 'NORMAL',
    state_reason: source.trust_reason ?? '',
    state_set_at: source.created_at,
    state_set_by: 'SYSTEM',
    
    // Direct mapping
    work_date: source.production_date ?? '',
    
    // No source data - leave empty
    shift_code: '',
    
    // Map incident_flag to sequence_status
    sequence_status: source.incident_flag ?? '',
    
    // HR decision fields - no source, leave empty
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
 * Escapes a CSV field value
 */
function escapeCSVField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Generates CSV content from mapped rows
 * UTF-8 encoding, strict column order
 */
export function generateRawEventCSV(rows: RawEventRow[]): string {
  // Header row
  const header = RAW_EVENT_COLUMNS.join(',');
  
  // Data rows
  const dataRows = rows.map(row => {
    return RAW_EVENT_COLUMNS.map(col => escapeCSVField(row[col])).join(',');
  });
  
  // Combine with BOM for Excel UTF-8 compatibility
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
