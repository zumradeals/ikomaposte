// ============================================
// Official Exports Types - IKOMA POSTE Doctrine
// ============================================
// 
// STRICT RULES:
// - Daily Export: Source of truth, one row per worker/date
// - Monthly Export: Aggregation of VALIDATED daily rows only
// - Never recompute from events
// - No reason/forensic text in official exports
// - Pause excluded from official totals
// ============================================

export const OFFICIAL_EXPORT_VERSION = '1.0';

// ============================================
// Daily Export (Source of Truth)
// ============================================

export interface DailyExportRow {
  /** Export format version */
  export_version: string;
  /** Worker matricule */
  matricule: string;
  /** Worker display name */
  nom_affiche: string;
  /** Category name */
  categorie: string;
  /** Work date YYYY-MM-DD */
  work_date: string;
  /** Day status: PRESENT | RETARD | ABSENT | ANOMALIE */
  day_status: string;
  /** Total work minutes (0 if ABSENT or ANOMALIE) */
  total_work_minutes: number;
  /** Late minutes (only if RETARD) */
  late_minutes: number;
  /** Hourly rate applied */
  taux_horaire: number;
  /** Currency */
  devise: string;
  /** Calculated amount (work_minutes * rate / 60) */
  montant: number;
  /** Validation timestamp */
  validated_at: string;
  /** Summary revision number */
  revision: number;
}

export interface DailyExportMetadata {
  export_type: 'IKP-DAILY';
  export_version: string;
  generated_at: string;
  period_month: string; // YYYY-MM
  total_rows: number;
  filename: string;
}

// ============================================
// Monthly Export (Aggregated)
// ============================================

export interface MonthlyExportRow {
  /** Export format version */
  export_version: string;
  /** Worker matricule */
  matricule: string;
  /** Worker display name */
  nom_affiche: string;
  /** Category name */
  categorie: string;
  /** Month YYYY-MM */
  month: string;
  /** Total work minutes (sum of PRESENT + RETARD days only) */
  total_work_minutes: number;
  /** Days worked (PRESENT + RETARD) */
  worked_days: number;
  /** Days late (RETARD only) */
  late_days: number;
  /** Days absent (ABSENT only) */
  absent_days: number;
  /** Days with anomaly (ANOMALIE only) */
  anomaly_days: number;
  /** Has any anomaly day */
  has_anomalies: boolean;
  /** Total late minutes across all RETARD days */
  total_late_minutes: number;
  /** Hourly rate applied */
  taux_horaire: number;
  /** Currency */
  devise: string;
  /** Total calculated amount */
  montant_total: number;
}

export interface MonthlyExportMetadata {
  export_type: 'IKP-MONTH';
  export_version: string;
  generated_at: string;
  period_month: string; // YYYY-MM
  total_workers: number;
  total_validated_days: number;
  filename: string;
}

// ============================================
// Sequence Counter (for immutable filenames)
// ============================================

export interface ExportSequence {
  daily: Map<string, number>; // YYYYMM -> sequence
  monthly: Map<string, number>; // YYYYMM -> sequence
}

// Generate immutable filename
export function generateExportFilename(
  type: 'DAILY' | 'MONTH',
  periodMonth: string, // YYYY-MM
  sequence: number
): string {
  const monthCode = periodMonth.replace('-', '');
  const seqPadded = sequence.toString().padStart(3, '0');
  return `IKP-${type}-${monthCode}-${seqPadded}`;
}
