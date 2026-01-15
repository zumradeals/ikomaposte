// ============================================
// IKOMA POSTE - PDF Document Generator v2.0
// ============================================
// Generates IKP-RAP (Individual Report) and IKP-PTG (Global Attendance)
// Based on VALIDATED daily/monthly export data
// Professional PDF layout with improved formatting
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DailyExportRow {
  export_version: string;
  matricule: string;
  nom_affiche: string;
  categorie: string;
  work_date: string;
  day_status: string;
  total_work_minutes: number;
  late_minutes: number;
  taux_horaire: number;
  devise: string;
  montant: number;
  validated_at: string;
  revision: number;
}

interface MonthlyExportRow {
  export_version: string;
  matricule: string;
  nom_affiche: string;
  categorie: string;
  month: string;
  total_work_minutes: number;
  worked_days: number;
  late_days: number;
  absent_days: number;
  anomaly_days: number;
  has_anomalies: boolean;
  total_late_minutes: number;
  taux_horaire: number;
  devise: string;
  montant_total: number;
}

interface GenerateRequest {
  type: "RAP" | "PTG";
  periodMonth: string;
  workerId?: string;
  categoryId?: string;
}

// Calculate SHA-256 hash
async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Encode text to PDF string with proper escaping
function pdfEncode(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[àâä]/g, "a")
    .replace(/[éèêë]/g, "e")
    .replace(/[îï]/g, "i")
    .replace(/[ôö]/g, "o")
    .replace(/[ùûü]/g, "u")
    .replace(/[ç]/g, "c")
    .replace(/[ÀÂÄÁÃ]/g, "A")
    .replace(/[ÉÈÊË]/g, "E")
    .replace(/[ÎÏÍÌ]/g, "I")
    .replace(/[ÔÖÓÒ]/g, "O")
    .replace(/[ÙÛÜÚ]/g, "U")
    .replace(/[Ç]/g, "C");
}

// PDF Page Builder class for multi-page support
class PDFBuilder {
  private pages: string[] = [];
  private currentPageContent: string[] = [];
  private currentY: number;
  private readonly pageWidth = 595;
  private readonly pageHeight = 842;
  private readonly marginLeft = 50;
  private readonly marginRight = 50;
  private readonly marginTop = 780;
  private readonly marginBottom = 60;
  private readonly lineHeight = 14;
  private readonly titleSize = 16;
  private readonly headerSize = 12;
  private readonly bodySize = 9;
  private readonly smallSize = 7;

  constructor() {
    this.currentY = this.marginTop;
  }

  private newPage(): void {
    if (this.currentPageContent.length > 0) {
      this.pages.push(this.currentPageContent.join("\n"));
    }
    this.currentPageContent = [];
    this.currentY = this.marginTop;
  }

  private checkSpace(lines: number): void {
    const needed = lines * this.lineHeight;
    if (this.currentY - needed < this.marginBottom) {
      this.newPage();
    }
  }

  addTitle(text: string): void {
    this.checkSpace(3);
    const encoded = pdfEncode(text);
    this.currentPageContent.push(`BT /F1 ${this.titleSize} Tf 1 0 0 1 ${this.marginLeft} ${this.currentY} Tm (${encoded}) Tj ET`);
    this.currentY -= this.lineHeight * 2;
  }

  addSubtitle(text: string): void {
    this.checkSpace(2);
    const encoded = pdfEncode(text);
    this.currentPageContent.push(`BT /F1 ${this.headerSize} Tf 1 0 0 1 ${this.marginLeft} ${this.currentY} Tm (${encoded}) Tj ET`);
    this.currentY -= this.lineHeight * 1.5;
  }

  addLine(text: string, indent: number = 0): void {
    this.checkSpace(1);
    const encoded = pdfEncode(text);
    const x = this.marginLeft + indent;
    this.currentPageContent.push(`BT /F1 ${this.bodySize} Tf 1 0 0 1 ${x} ${this.currentY} Tm (${encoded}) Tj ET`);
    this.currentY -= this.lineHeight;
  }

  addSmallLine(text: string, indent: number = 0): void {
    this.checkSpace(1);
    const encoded = pdfEncode(text);
    const x = this.marginLeft + indent;
    this.currentPageContent.push(`BT /F1 ${this.smallSize} Tf 1 0 0 1 ${x} ${this.currentY} Tm (${encoded}) Tj ET`);
    this.currentY -= this.lineHeight * 0.9;
  }

  addSpacer(lines: number = 1): void {
    this.currentY -= this.lineHeight * lines;
  }

  addHorizontalLine(): void {
    this.checkSpace(1);
    const lineY = this.currentY + 5;
    this.currentPageContent.push(`q 0.7 G 0.5 w ${this.marginLeft} ${lineY} m ${this.pageWidth - this.marginRight} ${lineY} l S Q`);
    this.currentY -= this.lineHeight * 0.5;
  }

  addHeader(companyName: string, reportType: string, documentCode: string): void {
    this.currentPageContent.push(`BT /F1 ${this.titleSize} Tf 1 0 0 1 ${this.marginLeft} ${this.currentY} Tm (${pdfEncode(companyName)}) Tj ET`);
    const rightX = this.pageWidth - this.marginRight - 150;
    this.currentPageContent.push(`BT /F1 ${this.headerSize} Tf 1 0 0 1 ${rightX} ${this.currentY} Tm (${pdfEncode(reportType)}) Tj ET`);
    this.currentY -= this.lineHeight * 1.5;
    this.currentPageContent.push(`BT /F1 ${this.bodySize} Tf 1 0 0 1 ${rightX} ${this.currentY} Tm (${pdfEncode(documentCode)}) Tj ET`);
    this.currentY -= this.lineHeight * 2;
    this.addHorizontalLine();
  }

  addInfoBlock(title: string, items: { label: string; value: string }[]): void {
    this.checkSpace(items.length + 2);
    this.addSubtitle(title);
    for (const item of items) {
      const labelText = `${item.label}:`;
      const valueText = item.value;
      this.currentPageContent.push(`BT /F1 ${this.bodySize} Tf 1 0 0 1 ${this.marginLeft} ${this.currentY} Tm (${pdfEncode(labelText)}) Tj ET`);
      this.currentPageContent.push(`BT /F1 ${this.bodySize} Tf 1 0 0 1 ${this.marginLeft + 120} ${this.currentY} Tm (${pdfEncode(valueText)}) Tj ET`);
      this.currentY -= this.lineHeight;
    }
    this.addSpacer(0.5);
  }

  addStatsBox(stats: { label: string; value: string | number }[]): void {
    this.checkSpace(3);
    const boxWidth = (this.pageWidth - this.marginLeft - this.marginRight) / stats.length;
    const startY = this.currentY;
    stats.forEach((stat, index) => {
      const x = this.marginLeft + (index * boxWidth);
      const centerX = x + (boxWidth / 2) - 30;
      this.currentPageContent.push(`BT /F1 ${this.headerSize} Tf 1 0 0 1 ${centerX} ${startY} Tm (${pdfEncode(String(stat.value))}) Tj ET`);
      this.currentPageContent.push(`BT /F1 ${this.smallSize} Tf 1 0 0 1 ${centerX} ${startY - 12} Tm (${pdfEncode(stat.label)}) Tj ET`);
    });
    this.currentY -= this.lineHeight * 3;
  }

  addTableHeader(columns: { label: string; width: number }[]): void {
    this.checkSpace(2);
    const lineY = this.currentY + 10;
    this.currentPageContent.push(`q 0.9 G ${this.marginLeft} ${lineY - 15} ${this.pageWidth - this.marginLeft - this.marginRight} 18 re f Q`);
    let x = this.marginLeft + 5;
    for (const col of columns) {
      this.currentPageContent.push(`BT /F1 ${this.smallSize} Tf 1 0 0 1 ${x} ${this.currentY} Tm (${pdfEncode(col.label)}) Tj ET`);
      x += col.width;
    }
    this.currentY -= this.lineHeight * 1.2;
  }

  addTableRow(values: string[], widths: number[], highlight?: boolean): void {
    this.checkSpace(1);
    if (highlight) {
      const lineY = this.currentY + 8;
      this.currentPageContent.push(`q 0.95 G ${this.marginLeft} ${lineY - 12} ${this.pageWidth - this.marginLeft - this.marginRight} 14 re f Q`);
    }
    let x = this.marginLeft + 5;
    for (let i = 0; i < values.length; i++) {
      const truncated = values[i].length > 25 ? values[i].substring(0, 22) + "..." : values[i];
      this.currentPageContent.push(`BT /F1 ${this.smallSize} Tf 1 0 0 1 ${x} ${this.currentY} Tm (${pdfEncode(truncated)}) Tj ET`);
      x += widths[i];
    }
    this.currentY -= this.lineHeight;
  }

  addVerificationBlock(hash: string, url: string): void {
    this.checkSpace(6);
    this.addHorizontalLine();
    this.addSpacer(0.5);
    this.addSubtitle("Verification et Tracabilite");
    this.addSmallLine(`Hash SHA-256: ${hash.substring(0, 32)}...`);
    this.addSmallLine(`Verification: ${url}`);
    this.addSpacer(0.5);
    this.addSmallLine("Ce document est genere a partir des donnees validees.");
    this.addSmallLine("Toute modification des donnees source invaliderait ce hash.");
  }

  build(): Uint8Array {
    if (this.currentPageContent.length > 0) {
      this.pages.push(this.currentPageContent.join("\n"));
    }

    if (this.pages.length === 0) {
      this.pages.push("BT /F1 12 Tf 1 0 0 1 50 750 Tm (Document vide) Tj ET");
    }

    const objects: string[] = [];
    const objectOffsets: number[] = [];
    
    // Object 1: Catalog
    objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
    
    // Object 2: Pages
    const pageRefs = this.pages.map((_, i) => `${3 + i} 0 R`).join(" ");
    objects.push(`2 0 obj\n<< /Type /Pages /Kids [${pageRefs}] /Count ${this.pages.length} >>\nendobj\n`);
    
    // Page objects (3, 4, 5, ...)
    const contentStartIndex = 3 + this.pages.length;
    for (let i = 0; i < this.pages.length; i++) {
      const pageObjNum = 3 + i;
      const contentObjNum = contentStartIndex + i;
      const fontObjNum = contentStartIndex + this.pages.length;
      objects.push(`${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.pageWidth} ${this.pageHeight}] /Contents ${contentObjNum} 0 R /Resources << /Font << /F1 ${fontObjNum} 0 R >> >> >>\nendobj\n`);
    }
    
    // Content stream objects
    for (let i = 0; i < this.pages.length; i++) {
      const contentObjNum = contentStartIndex + i;
      const streamContent = this.pages[i];
      objects.push(`${contentObjNum} 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream\nendobj\n`);
    }
    
    // Font object
    const fontObjNum = contentStartIndex + this.pages.length;
    objects.push(`${fontObjNum} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n`);

    // Build PDF
    let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
    for (const obj of objects) {
      objectOffsets.push(pdf.length);
      pdf += obj;
    }

    const objectCount = objects.length;
    const xrefOffset = pdf.length;
    pdf += "xref\n";
    pdf += `0 ${objectCount + 1}\n`;
    pdf += "0000000000 65535 f \n";
    for (const offset of objectOffsets) {
      pdf += offset.toString().padStart(10, "0") + " 00000 n \n";
    }

    pdf += "trailer\n";
    pdf += `<< /Size ${objectCount + 1} /Root 1 0 R >>\n`;
    pdf += "startxref\n";
    pdf += `${xrefOffset}\n`;
    pdf += "%%EOF";

    const encoder = new TextEncoder();
    return encoder.encode(pdf);
  }
}

// Format minutes to hours display
function formatMinutesToHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h${mins.toString().padStart(2, "0")}`;
}

// Format date for short display
function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDate().toString().padStart(2, "0");
  const months = ["Jan", "Fev", "Mar", "Avr", "Mai", "Jun", "Jul", "Aou", "Sep", "Oct", "Nov", "Dec"];
  const month = months[date.getMonth()];
  const weekdays = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  const weekday = weekdays[date.getDay()];
  return `${weekday} ${day} ${month}`;
}

// Get month name in French
function getMonthName(periodMonth: string): string {
  const [year, month] = periodMonth.split("-");
  const months = [
    "Janvier", "Fevrier", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Aout", "Septembre", "Octobre", "Novembre", "Decembre"
  ];
  return `${months[parseInt(month) - 1]} ${year}`;
}

// Generate daily export rows from summaries
function generateDailyExportRows(summaries: any[]): DailyExportRow[] {
  return summaries
    .filter((s) => s.validation_status === "VALIDATED" && s.is_current)
    .map((s) => {
      const workMinutes =
        s.day_status === "PRESENT" || s.day_status === "RETARD"
          ? s.total_work_minutes
          : 0;

      let lateMinutes = 0;
      if (s.day_status === "RETARD" && s.late_minutes) {
        lateMinutes = s.late_minutes;
      } else if (s.day_status === "RETARD" && s.notes) {
        const match = s.notes.match(/(\d+)\s*minutes?\s*de\s*retard/i);
        if (match) lateMinutes = parseInt(match[1], 10);
      }

      return {
        export_version: "2.0",
        matricule: s.workers?.matricule || "N/A",
        nom_affiche: s.workers?.nom_affiche || "N/A",
        categorie: s.workers?.categories?.nom || "N/A",
        work_date: s.work_date,
        day_status: s.day_status || "ANOMALIE",
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

// Generate monthly export rows from daily rows
function generateMonthlyExportRows(
  dailyRows: DailyExportRow[],
  periodMonth: string
): MonthlyExportRow[] {
  const workerGroups = new Map<string, DailyExportRow[]>();

  for (const row of dailyRows) {
    if (!row.work_date.startsWith(periodMonth)) continue;
    const key = row.matricule;
    if (!workerGroups.has(key)) workerGroups.set(key, []);
    workerGroups.get(key)!.push(row);
  }

  const monthlyRows: MonthlyExportRow[] = [];

  for (const [matricule, rows] of workerGroups) {
    if (rows.length === 0) continue;
    const firstRow = rows[0];

    const presentDays = rows.filter((r) => r.day_status === "PRESENT").length;
    const lateDays = rows.filter((r) => r.day_status === "RETARD").length;
    const absentDays = rows.filter((r) => r.day_status === "ABSENT").length;
    const anomalyDays = rows.filter((r) => r.day_status === "ANOMALIE").length;

    const totalWorkMinutes = rows
      .filter((r) => r.day_status === "PRESENT" || r.day_status === "RETARD")
      .reduce((sum, r) => sum + r.total_work_minutes, 0);

    const totalLateMinutes = rows
      .filter((r) => r.day_status === "RETARD")
      .reduce((sum, r) => sum + r.late_minutes, 0);

    const montantTotal = rows.reduce((sum, r) => sum + r.montant, 0);

    monthlyRows.push({
      export_version: "2.0",
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

  monthlyRows.sort((a, b) => a.matricule.localeCompare(b.matricule));
  return monthlyRows;
}

// Generate verification URL
function generateVerificationUrl(documentCode: string): string {
  return `https://ikomaposte.lovable.app/verify/${encodeURIComponent(documentCode)}`;
}

// Generate PDF for Individual Report (IKP-RAP)
function generateRAPPDF(
  rows: DailyExportRow[],
  metadata: {
    documentCode: string;
    exportVersion: string;
    generatedAt: string;
    generatedBy: string;
    sourceHash: string;
    periodMonth: string;
    workerName: string;
    matricule: string;
    categorie: string;
  }
): Uint8Array {
  const pdf = new PDFBuilder();
  const verificationUrl = generateVerificationUrl(metadata.documentCode);
  
  const totalMinutes = rows.reduce((sum, r) => sum + r.total_work_minutes, 0);
  const totalAmount = rows.reduce((sum, r) => sum + r.montant, 0);
  const presentDays = rows.filter((r) => r.day_status === "PRESENT").length;
  const lateDays = rows.filter((r) => r.day_status === "RETARD").length;
  const absentDays = rows.filter((r) => r.day_status === "ABSENT").length;
  const anomalyDays = rows.filter((r) => r.day_status === "ANOMALIE").length;
  const devise = rows[0]?.devise || "XOF";
  
  // Header
  pdf.addHeader("IKOMA POSTE", "RAPPORT INDIVIDUEL", metadata.documentCode);
  
  // Worker info
  pdf.addInfoBlock("Informations Salarie", [
    { label: "Nom complet", value: metadata.workerName },
    { label: "Matricule", value: metadata.matricule },
    { label: "Categorie", value: metadata.categorie },
    { label: "Periode", value: getMonthName(metadata.periodMonth) },
  ]);
  
  pdf.addSpacer(0.5);
  
  // Summary stats
  pdf.addSubtitle("Resume Mensuel");
  pdf.addStatsBox([
    { label: "Heures", value: formatMinutesToHours(totalMinutes) },
    { label: "Present", value: presentDays },
    { label: "Retard", value: lateDays },
    { label: "Absent", value: absentDays },
  ]);
  
  pdf.addLine(`Montant total: ${totalAmount.toLocaleString("fr-FR")} ${devise}`);
  if (anomalyDays > 0) {
    pdf.addLine(`Jours avec anomalie: ${anomalyDays}`);
  }
  
  pdf.addSpacer(1);
  pdf.addHorizontalLine();
  pdf.addSpacer(0.5);
  
  // Daily details table
  pdf.addSubtitle("Detail Journalier");
  
  const columns = [
    { label: "Date", width: 80 },
    { label: "Statut", width: 80 },
    { label: "Heures", width: 60 },
    { label: "Retard", width: 50 },
    { label: "Montant", width: 100 },
  ];
  const widths = columns.map(c => c.width);
  
  pdf.addTableHeader(columns);
  
  const sortedRows = [...rows].sort((a, b) => a.work_date.localeCompare(b.work_date));
  
  for (let i = 0; i < sortedRows.length; i++) {
    const row = sortedRows[i];
    const statusDisplay = row.day_status === "PRESENT" ? "[V] PRESENT" 
      : row.day_status === "RETARD" ? "[R] RETARD"
      : row.day_status === "ABSENT" ? "[X] ABSENT"
      : "[!] ANOMALIE";
    
    pdf.addTableRow([
      formatShortDate(row.work_date),
      statusDisplay,
      formatMinutesToHours(row.total_work_minutes),
      row.late_minutes > 0 ? `${row.late_minutes}min` : "-",
      `${row.montant.toLocaleString("fr-FR")} ${row.devise}`,
    ], widths, i % 2 === 0);
  }
  
  pdf.addSpacer(1);
  pdf.addVerificationBlock(metadata.sourceHash, verificationUrl);
  pdf.addSpacer(1);
  pdf.addSmallLine(`Genere le ${new Date(metadata.generatedAt).toLocaleString("fr-FR")} par ${metadata.generatedBy}`);
  
  return pdf.build();
}

// Generate PDF for Global Attendance (IKP-PTG)
function generatePTGPDF(
  rows: MonthlyExportRow[],
  metadata: {
    documentCode: string;
    exportVersion: string;
    generatedAt: string;
    generatedBy: string;
    sourceHash: string;
    periodMonth: string;
    categoryFilter?: string;
  }
): Uint8Array {
  const pdf = new PDFBuilder();
  const verificationUrl = generateVerificationUrl(metadata.documentCode);
  
  const totalMinutes = rows.reduce((sum, r) => sum + r.total_work_minutes, 0);
  const totalAmount = rows.reduce((sum, r) => sum + r.montant_total, 0);
  const totalWorkedDays = rows.reduce((sum, r) => sum + r.worked_days, 0);
  const totalLateDays = rows.reduce((sum, r) => sum + r.late_days, 0);
  const totalAbsentDays = rows.reduce((sum, r) => sum + r.absent_days, 0);
  const totalAnomalyDays = rows.reduce((sum, r) => sum + r.anomaly_days, 0);
  const workersWithAnomalies = rows.filter((r) => r.has_anomalies).length;
  const devise = rows[0]?.devise || "XOF";
  
  // Header
  pdf.addHeader("IKOMA POSTE", "POINTAGE GLOBAL", metadata.documentCode);
  
  // Report info
  pdf.addInfoBlock("Parametres du Rapport", [
    { label: "Periode", value: getMonthName(metadata.periodMonth) },
    { label: "Categorie", value: metadata.categoryFilter || "Toutes categories" },
    { label: "Nombre de salaries", value: String(rows.length) },
  ]);
  
  pdf.addSpacer(0.5);
  
  // Global stats
  pdf.addSubtitle("Totaux Globaux");
  pdf.addStatsBox([
    { label: "Heures", value: formatMinutesToHours(totalMinutes) },
    { label: "Jours", value: totalWorkedDays },
    { label: "Retards", value: totalLateDays },
    { label: "Absences", value: totalAbsentDays },
  ]);
  
  pdf.addLine(`Montant total: ${totalAmount.toLocaleString("fr-FR")} ${devise}`);
  if (totalAnomalyDays > 0) {
    pdf.addLine(`Jours avec anomalie: ${totalAnomalyDays} (${workersWithAnomalies} salaries)`);
  }
  
  pdf.addSpacer(1);
  pdf.addHorizontalLine();
  pdf.addSpacer(0.5);
  
  // Worker details table
  pdf.addSubtitle("Detail par Salarie");
  
  const columns = [
    { label: "Matricule", width: 60 },
    { label: "Nom", width: 115 },
    { label: "Heures", width: 55 },
    { label: "Jours", width: 40 },
    { label: "Retards", width: 45 },
    { label: "Absences", width: 50 },
    { label: "Montant", width: 80 },
  ];
  const widths = columns.map(c => c.width);
  
  pdf.addTableHeader(columns);
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const anomalyFlag = row.has_anomalies ? " *" : "";
    
    pdf.addTableRow([
      row.matricule,
      row.nom_affiche + anomalyFlag,
      formatMinutesToHours(row.total_work_minutes),
      String(row.worked_days),
      String(row.late_days),
      String(row.absent_days),
      `${row.montant_total.toLocaleString("fr-FR")}`,
    ], widths, i % 2 === 0);
  }
  
  pdf.addSpacer(0.5);
  pdf.addSmallLine("* = Salarie avec au moins un jour en anomalie");
  
  pdf.addSpacer(1);
  pdf.addVerificationBlock(metadata.sourceHash, verificationUrl);
  pdf.addSpacer(1);
  pdf.addSmallLine(`Genere le ${new Date(metadata.generatedAt).toLocaleString("fr-FR")} par ${metadata.generatedBy}`);
  
  return pdf.build();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      throw new Error("Not authenticated");
    }

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!roles) {
      throw new Error("Admin role required");
    }

    const body: GenerateRequest = await req.json();
    const { type, periodMonth, workerId, categoryId } = body;

    if (!type || !periodMonth) {
      throw new Error("Missing type or periodMonth");
    }

    if (type === "RAP" && !workerId) {
      throw new Error("workerId required for RAP");
    }

    const [year, month] = periodMonth.split("-").map(Number);
    const monthStart = `${periodMonth}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const monthEnd = `${periodMonth}-${lastDay.toString().padStart(2, "0")}`;

    let query = supabaseAdmin
      .from("work_summaries")
      .select(
        `
        *,
        workers (
          id,
          nom_affiche,
          matricule,
          categories (
            id,
            nom,
            taux_horaire,
            devise
          )
        )
      `
      )
      .eq("validation_status", "VALIDATED")
      .eq("is_current", true)
      .gte("work_date", monthStart)
      .lte("work_date", monthEnd);

    if (type === "RAP") {
      query = query.eq("worker_id", workerId);
    }

    if (categoryId) {
      query = query.eq("workers.category_id", categoryId);
    }

    const { data: summaries, error: summariesError } = await query.order("work_date");

    if (summariesError) {
      throw summariesError;
    }

    if (!summaries || summaries.length === 0) {
      throw new Error("No validated data found for this period");
    }

    const dailyRows = generateDailyExportRows(summaries);
    let exportData: DailyExportRow[] | MonthlyExportRow[];
    let sourceJson: string;

    if (type === "RAP") {
      exportData = dailyRows;
      sourceJson = JSON.stringify({ type: "RAP", rows: dailyRows });
    } else {
      const monthlyRows = generateMonthlyExportRows(dailyRows, periodMonth);
      exportData = monthlyRows;
      sourceJson = JSON.stringify({ type: "PTG", rows: monthlyRows });
    }

    const sourceHash = await sha256(sourceJson);

    const monthKey = periodMonth.replace("-", "");
    const { data: seqResult, error: seqError } = await supabaseAdmin.rpc(
      "get_next_document_sequence",
      {
        p_document_type: type,
        p_period_month: monthKey,
      }
    );

    if (seqError) {
      console.error("Sequence error:", seqError);
      throw new Error("Failed to get sequence number");
    }

    const sequence = seqResult as number;
    const documentCode = `IKP-${type}-${monthKey}-${sequence.toString().padStart(3, "0")}`;
    const generatedAt = new Date().toISOString();

    let workerInfo = { name: "", matricule: "", categorie: "" };
    if (type === "RAP" && dailyRows.length > 0) {
      workerInfo = {
        name: dailyRows[0].nom_affiche,
        matricule: dailyRows[0].matricule,
        categorie: dailyRows[0].categorie,
      };
    }

    let categoryName: string | undefined;
    if (categoryId) {
      const { data: cat } = await supabaseAdmin
        .from("categories")
        .select("nom")
        .eq("id", categoryId)
        .single();
      categoryName = cat?.nom;
    }

    // Generate PDF bytes using PDFBuilder
    let pdfBytes: Uint8Array;
    if (type === "RAP") {
      pdfBytes = generateRAPPDF(dailyRows, {
        documentCode,
        exportVersion: "2.0",
        generatedAt,
        generatedBy: user.email || user.id,
        sourceHash,
        periodMonth,
        workerName: workerInfo.name,
        matricule: workerInfo.matricule,
        categorie: workerInfo.categorie,
      });
    } else {
      pdfBytes = generatePTGPDF(exportData as MonthlyExportRow[], {
        documentCode,
        exportVersion: "2.0",
        generatedAt,
        generatedBy: user.email || user.id,
        sourceHash,
        periodMonth,
        categoryFilter: categoryName,
      });
    }

    const storagePath = `${periodMonth}/${documentCode}.pdf`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("documents")
      .upload(storagePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw new Error("Failed to upload document");
    }

    const { data: docRecord, error: docError } = await supabaseAdmin
      .from("documents")
      .insert({
        document_code: documentCode,
        document_type: type,
        period_month: periodMonth,
        worker_id: type === "RAP" ? workerId : null,
        category_id: categoryId || null,
        export_version: "2.0",
        source_hash: sourceHash,
        source_row_count: exportData.length,
        storage_path: storagePath,
        file_size_bytes: pdfBytes.length,
        generated_by: user.id,
        filters_json: {
          type,
          periodMonth,
          workerId: workerId || null,
          categoryId: categoryId || null,
        },
      })
      .select()
      .single();

    if (docError) {
      console.error("Document insert error:", docError);
      throw new Error("Failed to save document record");
    }

    await supabaseAdmin.from("admin_audit").insert({
      device_id: "edge-function",
      actor_user_id: user.id,
      event: `PDF_GENERATED_${type}`,
      reason: `Generated ${documentCode} for ${periodMonth}`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        document: {
          id: docRecord.id,
          documentCode,
          storagePath,
          sourceHash,
          rowCount: exportData.length,
          generatedAt,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
