// Phase 6: Export utilities

import { WorkSummaryWithWorker } from '@/types/work-summaries';
import { WorkEvent } from '@/types/work-events';
import { CorrectionEvent, DaySummary } from '@/types/corrections';
import { format } from 'date-fns';

// ============================================
// CSV PAIE EXPORT
// ============================================

export interface PayrollExportRow {
  matricule: string;
  nom_affiche: string;
  categorie: string;
  date: string;
  heures_travail: number;
  minutes_pause: number;
  taux_horaire: number;
  devise: string;
  montant: number;
  statut_journee: 'SAIN' | 'INCOHERENT' | 'CORRIGE' | 'INCOMPLET';
}

export function generatePayrollCSV(
  summaries: WorkSummaryWithWorker[],
  daySummaries: DaySummary[]
): string {
  const headers = [
    'matricule',
    'nom_affiche',
    'categorie',
    'date',
    'heures_travail',
    'minutes_pause',
    'taux_horaire',
    'devise',
    'montant',
    'statut_journee',
  ];

  const rows = summaries.map(s => {
    // Find matching day summary for status
    const daySummary = daySummaries.find(
      ds => ds.worker_id === s.worker_id && ds.work_date === s.work_date
    );
    
    let status: PayrollExportRow['statut_journee'] = 'SAIN';
    if (daySummary) {
      if (daySummary.status === 'incoherent') status = 'INCOHERENT';
      else if (daySummary.status === 'corrected') status = 'CORRIGE';
    }
    
    // Mark as incomplete if no summary data
    if (s.total_work_minutes === 0 && s.total_amount === 0) {
      status = 'INCOMPLET';
    }

    const hoursWorked = Math.round((s.total_work_minutes / 60) * 100) / 100;

    return [
      s.workers?.matricule || 'N/A',
      s.workers?.nom_affiche || 'N/A',
      s.workers?.categories?.nom || 'N/A',
      s.work_date,
      hoursWorked.toString().replace('.', ','),
      s.total_pause_minutes,
      s.taux_horaire_applied,
      s.devise,
      s.total_amount,
      status,
    ];
  });

  const csvContent = [
    headers.join(';'),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(';'))
  ].join('\n');

  return '\ufeff' + csvContent; // BOM for Excel
}

// ============================================
// JSON AUDIT EXPORT
// ============================================

export interface AuditExportData {
  export_metadata: {
    type: 'audit';
    generated_at: string;
    period: { from: string; to: string };
    total_events: number;
    total_corrections: number;
    total_summaries: number;
  };
  raw_events: WorkEvent[];
  corrections: CorrectionEvent[];
  calculated_summaries: WorkSummaryWithWorker[];
}

export function generateAuditJSON(
  events: WorkEvent[],
  corrections: CorrectionEvent[],
  summaries: WorkSummaryWithWorker[],
  periodFrom: string,
  periodTo: string
): string {
  const data: AuditExportData = {
    export_metadata: {
      type: 'audit',
      generated_at: new Date().toISOString(),
      period: { from: periodFrom, to: periodTo },
      total_events: events.length,
      total_corrections: corrections.length,
      total_summaries: summaries.length,
    },
    raw_events: events,
    corrections: corrections,
    calculated_summaries: summaries,
  };

  return JSON.stringify(data, null, 2);
}

// ============================================
// NDJSON SYNC EXPORT
// ============================================

export type SyncRecordKind = 'work_event' | 'correction_event' | 'work_summary' | 'device_enrollment';

export interface SyncRecord {
  kind: SyncRecordKind;
  id: string;
  created_at: string;
  payload: Record<string, unknown>;
  checksum: string;
}

// Simple hash function for checksum
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export function generateSyncNDJSON(
  events: WorkEvent[],
  corrections: CorrectionEvent[],
  summaries: WorkSummaryWithWorker[]
): string {
  const lines: string[] = [];

  // Work events
  for (const event of events) {
    const payload = { ...event };
    const record: SyncRecord = {
      kind: 'work_event',
      id: event.id,
      created_at: event.created_at,
      payload,
      checksum: simpleHash(JSON.stringify(payload)),
    };
    lines.push(JSON.stringify(record));
  }

  // Correction events
  for (const correction of corrections) {
    const payload = { ...correction };
    const record: SyncRecord = {
      kind: 'correction_event',
      id: correction.id,
      created_at: correction.created_at,
      payload,
      checksum: simpleHash(JSON.stringify(payload)),
    };
    lines.push(JSON.stringify(record));
  }

  // Work summaries
  for (const summary of summaries) {
    const payload = { ...summary };
    const record: SyncRecord = {
      kind: 'work_summary',
      id: summary.id,
      created_at: summary.created_at,
      payload,
      checksum: simpleHash(JSON.stringify(payload)),
    };
    lines.push(JSON.stringify(record));
  }

  return lines.join('\n');
}

// ============================================
// HTML LITIGE (DISPUTE) EXPORT
// ============================================

export function generateDisputeHTML(
  workerName: string,
  matricule: string,
  date: string,
  events: WorkEvent[],
  corrections: CorrectionEvent[],
  summary: WorkSummaryWithWorker | null
): string {
  const formatTime = (iso: string) => {
    try {
      return format(new Date(iso), 'HH:mm:ss');
    } catch {
      return iso;
    }
  };

  const eventTypeLabels: Record<string, string> = {
    TAKE: 'Prise de poste',
    PAUSE: 'Pause',
    RESUME: 'Reprise',
    END: 'Fin de poste',
  };

  const eventsHTML = events.map(e => `
    <tr>
      <td>${formatTime(e.occurred_at)}</td>
      <td>${eventTypeLabels[e.event_type] || e.event_type}</td>
      <td>${e.trust_status}</td>
      <td>${e.device_id}</td>
      <td>${e.snapshot_url ? `<a href="${e.snapshot_url}" target="_blank">Voir</a>` : '-'}</td>
    </tr>
  `).join('');

  const correctionsHTML = corrections.length > 0 
    ? corrections.map(c => `
        <tr>
          <td>${format(new Date(c.created_at), 'dd/MM/yyyy HH:mm')}</td>
          <td>${c.anomaly_type}</td>
          <td>${c.correction_action}</td>
          <td>${c.justification}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="4">Aucune correction</td></tr>';

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rapport de litige - ${workerName} - ${date}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; padding: 20px; max-width: 900px; margin: 0 auto; }
    h1 { font-size: 24px; margin-bottom: 10px; color: #333; }
    h2 { font-size: 18px; margin: 20px 0 10px; color: #555; border-bottom: 2px solid #eee; padding-bottom: 5px; }
    .header-info { background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
    .header-info p { margin: 5px 0; }
    .header-info strong { color: #333; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
    th { background: #f0f0f0; font-weight: bold; }
    tr:nth-child(even) { background: #fafafa; }
    .summary-box { background: #e8f4e8; padding: 15px; border-radius: 8px; margin-top: 20px; }
    .summary-box.incomplete { background: #fff3cd; }
    .print-date { color: #888; font-size: 12px; margin-top: 30px; text-align: center; }
    @media print {
      body { padding: 10px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <h1>🔍 Rapport de Litige - IKOMA POSTE</h1>
  
  <div class="header-info">
    <p><strong>Travailleur:</strong> ${workerName} (${matricule})</p>
    <p><strong>Date:</strong> ${format(new Date(date), 'dd/MM/yyyy')}</p>
    <p><strong>Généré le:</strong> ${format(new Date(), 'dd/MM/yyyy à HH:mm')}</p>
  </div>

  <h2>📋 Événements bruts (RAW)</h2>
  <table>
    <thead>
      <tr>
        <th>Heure</th>
        <th>Type</th>
        <th>Trust Status</th>
        <th>Device ID</th>
        <th>Snapshot</th>
      </tr>
    </thead>
    <tbody>
      ${eventsHTML || '<tr><td colspan="5">Aucun événement</td></tr>'}
    </tbody>
  </table>

  <h2>✏️ Corrections appliquées</h2>
  <table>
    <thead>
      <tr>
        <th>Date correction</th>
        <th>Type anomalie</th>
        <th>Action</th>
        <th>Justification</th>
      </tr>
    </thead>
    <tbody>
      ${correctionsHTML}
    </tbody>
  </table>

  <h2>📊 Résumé calculé (FINAL)</h2>
  ${summary ? `
    <div class="summary-box ${summary.auto_closed ? 'incomplete' : ''}">
      <p><strong>Temps travaillé:</strong> ${Math.floor(summary.total_work_minutes / 60)}h ${summary.total_work_minutes % 60}min</p>
      <p><strong>Pauses:</strong> ${summary.total_pause_minutes} minutes</p>
      <p><strong>Taux horaire:</strong> ${summary.taux_horaire_applied} ${summary.devise}</p>
      <p><strong>Montant total:</strong> ${summary.total_amount.toLocaleString()} ${summary.devise}</p>
      <p><strong>Auto-clôturé:</strong> ${summary.auto_closed ? 'Oui' : 'Non'}</p>
      <p><strong>Version calcul:</strong> ${summary.calculation_version}</p>
    </div>
  ` : '<p>Aucun résumé calculé disponible</p>'}

  <p class="print-date">Document généré automatiquement par IKOMA POSTE</p>
  
  <button class="no-print" onclick="window.print()" style="margin-top: 20px; padding: 10px 20px; cursor: pointer;">
    Imprimer / Sauvegarder en PDF
  </button>
</body>
</html>
  `.trim();
}

// ============================================
// DOWNLOAD HELPERS
// ============================================

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

export function openHTMLInNewTab(htmlContent: string) {
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}
