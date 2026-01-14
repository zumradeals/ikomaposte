// ============================================
// Official Export Utilities - IKOMA POSTE Doctrine
// ============================================
// 
// STRICT DOCTRINE:
// - Daily: validation_status = VALIDATED, is_current = true only
// - Monthly: Sum from validated daily rows, never recompute
// - No reason/forensic text
// - Pause excluded from official totals
// ============================================


import {
  DailyExportRow,
  DailyExportMetadata,
  MonthlyExportRow,
  MonthlyExportMetadata,
  OFFICIAL_EXPORT_VERSION,
  generateExportFilename,
} from '@/types/official-exports';
import { WorkSummaryWithWorker } from '@/types/work-summaries';
import { downloadFile } from '@/lib/export-utils';

// ============================================
// DAILY EXPORT (Source of Truth)
// ============================================

/**
 * Generate daily export rows from VALIDATED, is_current summaries
 * DOCTRINE: Never recompute - use stored values only
 */
export function generateDailyExportRows(
  summaries: WorkSummaryWithWorker[]
): DailyExportRow[] {
  // Filter: VALIDATED + is_current only
  const validatedSummaries = summaries.filter(
    s => s.validation_status === 'VALIDATED' && s.is_current
  );

  return validatedSummaries.map(s => {
    // Doctrine: ABSENT and ANOMALIE have total_work_minutes = 0
    // Use stored value directly - never recompute
    const workMinutes = s.day_status === 'PRESENT' || s.day_status === 'RETARD'
      ? s.total_work_minutes
      : 0;

    // Extract late minutes from notes if RETARD
    // Format in notes: "Arrivée avec X minutes de retard"
    let lateMinutes = 0;
    if (s.day_status === 'RETARD' && s.notes) {
      const match = s.notes.match(/(\d+)\s*minutes?\s*de\s*retard/i);
      if (match) {
        lateMinutes = parseInt(match[1], 10);
      }
    }

    return {
      export_version: OFFICIAL_EXPORT_VERSION,
      matricule: s.workers?.matricule || 'N/A',
      nom_affiche: s.workers?.nom_affiche || 'N/A',
      categorie: s.workers?.categories?.nom || 'N/A',
      work_date: s.work_date,
      day_status: s.day_status || 'ANOMALIE',
      total_work_minutes: workMinutes,
      late_minutes: lateMinutes,
      taux_horaire: s.taux_horaire_applied,
      devise: s.devise,
      montant: s.total_amount,
      validated_at: s.validated_at || s.updated_at,
      revision: s.revision,
    };
  });
}

/**
 * Generate daily export CSV
 */
export function generateDailyExportCSV(
  rows: DailyExportRow[],
  metadata: DailyExportMetadata
): string {
  const headers = [
    'export_version',
    'matricule',
    'nom_affiche',
    'categorie',
    'work_date',
    'day_status',
    'total_work_minutes',
    'late_minutes',
    'taux_horaire',
    'devise',
    'montant',
    'validated_at',
    'revision',
  ];

  const csvRows = rows.map(row => [
    row.export_version,
    row.matricule,
    row.nom_affiche,
    row.categorie,
    row.work_date,
    row.day_status,
    row.total_work_minutes,
    row.late_minutes,
    row.taux_horaire,
    row.devise,
    row.montant,
    row.validated_at,
    row.revision,
  ]);

  // Add metadata as comment header
  const metadataLines = [
    `# IKOMA POSTE - ${metadata.export_type}`,
    `# Version: ${metadata.export_version}`,
    `# Generated: ${metadata.generated_at}`,
    `# Period: ${metadata.period_month}`,
    `# Rows: ${metadata.total_rows}`,
    `# Filename: ${metadata.filename}`,
    '',
  ];

  const csvContent = [
    ...metadataLines,
    headers.join(';'),
    ...csvRows.map(row => row.map(cell => `"${cell}"`).join(';')),
  ].join('\n');

  return '\ufeff' + csvContent; // BOM for Excel
}

// ============================================
// MONTHLY EXPORT (Aggregated)
// ============================================

/**
 * Generate monthly export rows by aggregating validated daily rows
 * DOCTRINE: Sum only from VALIDATED daily rows, never recompute from events
 */
export function generateMonthlyExportRows(
  dailyRows: DailyExportRow[],
  periodMonth: string
): MonthlyExportRow[] {
  // Group by worker (matricule)
  const workerGroups = new Map<string, DailyExportRow[]>();
  
  for (const row of dailyRows) {
    // Only include rows from the target month
    if (!row.work_date.startsWith(periodMonth)) continue;
    
    const key = row.matricule;
    if (!workerGroups.has(key)) {
      workerGroups.set(key, []);
    }
    workerGroups.get(key)!.push(row);
  }

  const monthlyRows: MonthlyExportRow[] = [];

  for (const [matricule, rows] of workerGroups) {
    if (rows.length === 0) continue;

    const firstRow = rows[0];
    
    // Count by status
    const presentDays = rows.filter(r => r.day_status === 'PRESENT').length;
    const lateDays = rows.filter(r => r.day_status === 'RETARD').length;
    const absentDays = rows.filter(r => r.day_status === 'ABSENT').length;
    const anomalyDays = rows.filter(r => r.day_status === 'ANOMALIE').length;

    // Sum work minutes (PRESENT + RETARD only - doctrine)
    const totalWorkMinutes = rows
      .filter(r => r.day_status === 'PRESENT' || r.day_status === 'RETARD')
      .reduce((sum, r) => sum + r.total_work_minutes, 0);

    // Sum late minutes
    const totalLateMinutes = rows
      .filter(r => r.day_status === 'RETARD')
      .reduce((sum, r) => sum + r.late_minutes, 0);

    // Sum amounts
    const montantTotal = rows.reduce((sum, r) => sum + r.montant, 0);

    monthlyRows.push({
      export_version: OFFICIAL_EXPORT_VERSION,
      matricule,
      nom_affiche: firstRow.nom_affiche,
      categorie: firstRow.categorie,
      month: periodMonth,
      total_work_minutes: totalWorkMinutes,
      worked_days: presentDays + lateDays,
      late_days: lateDays,
      absent_days: absentDays,
      anomaly_days: anomalyDays,
      has_anomalies: anomalyDays > 0,
      total_late_minutes: totalLateMinutes,
      taux_horaire: firstRow.taux_horaire,
      devise: firstRow.devise,
      montant_total: montantTotal,
    });
  }

  // Sort by matricule
  monthlyRows.sort((a, b) => a.matricule.localeCompare(b.matricule));

  return monthlyRows;
}

/**
 * Generate monthly export CSV
 */
export function generateMonthlyExportCSV(
  rows: MonthlyExportRow[],
  metadata: MonthlyExportMetadata
): string {
  const headers = [
    'export_version',
    'matricule',
    'nom_affiche',
    'categorie',
    'month',
    'total_work_minutes',
    'worked_days',
    'late_days',
    'absent_days',
    'anomaly_days',
    'has_anomalies',
    'total_late_minutes',
    'taux_horaire',
    'devise',
    'montant_total',
  ];

  const csvRows = rows.map(row => [
    row.export_version,
    row.matricule,
    row.nom_affiche,
    row.categorie,
    row.month,
    row.total_work_minutes,
    row.worked_days,
    row.late_days,
    row.absent_days,
    row.anomaly_days,
    row.has_anomalies ? 'OUI' : 'NON',
    row.total_late_minutes,
    row.taux_horaire,
    row.devise,
    row.montant_total,
  ]);

  // Add metadata as comment header
  const metadataLines = [
    `# IKOMA POSTE - ${metadata.export_type}`,
    `# Version: ${metadata.export_version}`,
    `# Generated: ${metadata.generated_at}`,
    `# Period: ${metadata.period_month}`,
    `# Workers: ${metadata.total_workers}`,
    `# Validated Days: ${metadata.total_validated_days}`,
    `# Filename: ${metadata.filename}`,
    '',
  ];

  const csvContent = [
    ...metadataLines,
    headers.join(';'),
    ...csvRows.map(row => row.map(cell => `"${cell}"`).join(';')),
  ].join('\n');

  return '\ufeff' + csvContent; // BOM for Excel
}

// ============================================
// EXPORT EXECUTION
// ============================================

/**
 * Execute daily export with immutable filename
 */
export function executeDailyExport(
  summaries: WorkSummaryWithWorker[],
  periodMonth: string,
  sequence: number
): { filename: string; rowCount: number } {
  const rows = generateDailyExportRows(summaries);
  const filename = generateExportFilename('DAILY', periodMonth, sequence);
  
  const metadata: DailyExportMetadata = {
    export_type: 'IKP-DAILY',
    export_version: OFFICIAL_EXPORT_VERSION,
    generated_at: new Date().toISOString(),
    period_month: periodMonth,
    total_rows: rows.length,
    filename,
  };

  const csv = generateDailyExportCSV(rows, metadata);
  downloadFile(csv, `${filename}.csv`, 'text/csv;charset=utf-8;');

  return { filename, rowCount: rows.length };
}

/**
 * Execute monthly export with immutable filename
 */
export function executeMonthlyExport(
  summaries: WorkSummaryWithWorker[],
  periodMonth: string,
  sequence: number
): { filename: string; workerCount: number; dayCount: number } {
  // First generate daily rows (source of truth)
  const dailyRows = generateDailyExportRows(summaries);
  
  // Then aggregate into monthly
  const monthlyRows = generateMonthlyExportRows(dailyRows, periodMonth);
  const filename = generateExportFilename('MONTH', periodMonth, sequence);
  
  const metadata: MonthlyExportMetadata = {
    export_type: 'IKP-MONTH',
    export_version: OFFICIAL_EXPORT_VERSION,
    generated_at: new Date().toISOString(),
    period_month: periodMonth,
    total_workers: monthlyRows.length,
    total_validated_days: dailyRows.filter(r => r.work_date.startsWith(periodMonth)).length,
    filename,
  };

  const csv = generateMonthlyExportCSV(monthlyRows, metadata);
  downloadFile(csv, `${filename}.csv`, 'text/csv;charset=utf-8;');

  return { 
    filename, 
    workerCount: monthlyRows.length, 
    dayCount: metadata.total_validated_days,
  };
}
