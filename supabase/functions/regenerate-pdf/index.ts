// ============================================
// IKOMA POSTE - PDF Regenerator
// ============================================
// Regenerates existing documents with valid PDF format
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

// Calculate SHA-256 hash
async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Generate a minimal valid PDF from text content
function generatePDFBytes(textContent: string): Uint8Array {
  const sanitizedText = textContent
    .replace(/[✓✗⏰⚠]/g, (match) => {
      switch (match) {
        case "✓": return "[OK]";
        case "✗": return "[X]";
        case "⏰": return "[R]";
        case "⚠": return "[!]";
        default: return match;
      }
    });
  
  const lines = sanitizedText.split("\n");
  const fontSize = 9;
  const lineHeight = 12;
  const marginLeft = 40;
  const marginTop = 750;
  const pageWidth = 595;
  const pageHeight = 842;
  
  let textOps = `BT\n/F1 ${fontSize} Tf\n`;
  let currentY = marginTop;
  
  for (const line of lines) {
    if (currentY < 50) break;
    const escapedLine = line
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)");
    
    textOps += `1 0 0 1 ${marginLeft} ${currentY} Tm\n(${escapedLine}) Tj\n`;
    currentY -= lineHeight;
  }
  textOps += "ET";
  
  const objects: string[] = [];
  let objectCount = 0;
  const objectOffsets: number[] = [];
  
  objectCount++;
  objects.push(`${objectCount} 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  
  objectCount++;
  objects.push(`${objectCount} 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`);
  
  objectCount++;
  objects.push(`${objectCount} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n`);
  
  objectCount++;
  const streamContent = textOps;
  objects.push(`${objectCount} 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream\nendobj\n`);
  
  objectCount++;
  objects.push(`${objectCount} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n`);
  
  let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  
  for (let i = 0; i < objects.length; i++) {
    objectOffsets.push(pdf.length);
    pdf += objects[i];
  }
  
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

function formatMinutesToHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h${mins.toString().padStart(2, "0")}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function generateDailyExportRows(summaries: any[]): DailyExportRow[] {
  return summaries
    .filter((s) => s.validation_status === "VALIDATED" && s.is_current)
    .map((s) => {
      const workMinutes =
        s.day_status === "PRESENT" || s.day_status === "RETARD"
          ? s.total_work_minutes
          : 0;

      let lateMinutes = 0;
      if (s.day_status === "RETARD" && s.notes) {
        const match = s.notes.match(/(\d+)\s*minutes?\s*de\s*retard/i);
        if (match) lateMinutes = parseInt(match[1], 10);
      }

      return {
        export_version: "1.0",
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
      export_version: "1.0",
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

function generateVerificationUrl(documentCode: string): string {
  return `https://ikomaposte.lovable.app/verify/${encodeURIComponent(documentCode)}`;
}

function generateRAPContent(
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
): string {
  const totalMinutes = rows.reduce((sum, r) => sum + r.total_work_minutes, 0);
  const totalAmount = rows.reduce((sum, r) => sum + r.montant, 0);
  const presentDays = rows.filter((r) => r.day_status === "PRESENT").length;
  const lateDays = rows.filter((r) => r.day_status === "RETARD").length;
  const absentDays = rows.filter((r) => r.day_status === "ABSENT").length;
  const anomalyDays = rows.filter((r) => r.day_status === "ANOMALIE").length;
  const verificationUrl = generateVerificationUrl(metadata.documentCode);

  let content = `
================================================================================
                           IKOMA POSTE - RAPPORT INDIVIDUEL
================================================================================

Document: ${metadata.documentCode}
Version: ${metadata.exportVersion}
Genere le: ${new Date(metadata.generatedAt).toLocaleString("fr-FR")}
Genere par: ${metadata.generatedBy}

--------------------------------------------------------------------------------
                              INFORMATIONS SALARIE
--------------------------------------------------------------------------------
Nom: ${metadata.workerName}
Matricule: ${metadata.matricule}
Categorie: ${metadata.categorie}
Periode: ${metadata.periodMonth}

--------------------------------------------------------------------------------
                                RESUME MENSUEL
--------------------------------------------------------------------------------
Total travaille: ${formatMinutesToHours(totalMinutes)} (${totalMinutes} minutes)
Montant total: ${totalAmount.toLocaleString("fr-FR")} ${rows[0]?.devise || "XOF"}

Jours present: ${presentDays}
Jours en retard: ${lateDays}
Jours absent: ${absentDays}
Jours anomalie: ${anomalyDays}

--------------------------------------------------------------------------------
                              DETAIL JOURNALIER
--------------------------------------------------------------------------------
`;

  const sortedRows = [...rows].sort((a, b) =>
    a.work_date.localeCompare(b.work_date)
  );

  for (const row of sortedRows) {
    const statusIcon =
      row.day_status === "PRESENT"
        ? "[OK]"
        : row.day_status === "RETARD"
        ? "[R]"
        : row.day_status === "ABSENT"
        ? "[X]"
        : "[!]";

    content += `${formatDate(row.work_date)} | ${statusIcon} ${row.day_status.padEnd(8)} | ${formatMinutesToHours(row.total_work_minutes).padStart(6)} | ${row.montant.toLocaleString("fr-FR").padStart(8)} ${row.devise}\n`;
  }

  content += `
--------------------------------------------------------------------------------
                              TRACABILITE OPPOSABLE
--------------------------------------------------------------------------------
Hash source (SHA-256): ${metadata.sourceHash}
Ce document est genere a partir des donnees validees et verrouillees.
Toute modification des donnees source invaliderait ce hash.

--------------------------------------------------------------------------------
                           VERIFICATION D'AUTHENTICITE
--------------------------------------------------------------------------------
Pour verifier l'authenticite de ce document, scannez le QR code ou visitez:
${verificationUrl}

================================================================================
                         FIN DU RAPPORT - ${metadata.documentCode}
================================================================================
`;

  return content;
}

function generatePTGContent(
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
): string {
  const totalMinutes = rows.reduce((sum, r) => sum + r.total_work_minutes, 0);
  const totalAmount = rows.reduce((sum, r) => sum + r.montant_total, 0);
  const totalWorkedDays = rows.reduce((sum, r) => sum + r.worked_days, 0);
  const totalLateDays = rows.reduce((sum, r) => sum + r.late_days, 0);
  const totalAbsentDays = rows.reduce((sum, r) => sum + r.absent_days, 0);
  const totalAnomalyDays = rows.reduce((sum, r) => sum + r.anomaly_days, 0);
  const workersWithAnomalies = rows.filter((r) => r.has_anomalies).length;
  const verificationUrl = generateVerificationUrl(metadata.documentCode);

  let content = `
================================================================================
                         IKOMA POSTE - POINTAGE GLOBAL
================================================================================

Document: ${metadata.documentCode}
Version: ${metadata.exportVersion}
Genere le: ${new Date(metadata.generatedAt).toLocaleString("fr-FR")}
Genere par: ${metadata.generatedBy}

--------------------------------------------------------------------------------
                              PARAMETRES DU RAPPORT
--------------------------------------------------------------------------------
Periode: ${metadata.periodMonth}
Filtre categorie: ${metadata.categoryFilter || "Toutes"}
Nombre de salaries: ${rows.length}

--------------------------------------------------------------------------------
                                 TOTAUX GLOBAUX
--------------------------------------------------------------------------------
Total heures travaillees: ${formatMinutesToHours(totalMinutes)} (${totalMinutes} minutes)
Total montant: ${totalAmount.toLocaleString("fr-FR")} ${rows[0]?.devise || "XOF"}

Total jours travailles: ${totalWorkedDays}
Total jours retard: ${totalLateDays}
Total jours absence: ${totalAbsentDays}
Total jours anomalie: ${totalAnomalyDays}
Salaries avec anomalies: ${workersWithAnomalies}

--------------------------------------------------------------------------------
                              DETAIL PAR SALARIE
--------------------------------------------------------------------------------
`;

  content += "Matricule   | Nom                          | Heures    | Jours | Retards | Absences | Montant\n";
  content += "------------|------------------------------|-----------|-------|---------|----------|----------------\n";

  for (const row of rows) {
    const anomalyFlag = row.has_anomalies ? "*" : " ";
    content += `${row.matricule.padEnd(11)} | ${row.nom_affiche.substring(0, 28).padEnd(28)} | ${formatMinutesToHours(row.total_work_minutes).padStart(9)} | ${row.worked_days.toString().padStart(5)} | ${row.late_days.toString().padStart(7)} | ${row.absent_days.toString().padStart(8)} | ${row.montant_total.toLocaleString("fr-FR").padStart(12)} ${row.devise}${anomalyFlag}\n`;
  }

  content += `
* = Salarie avec au moins un jour en anomalie

--------------------------------------------------------------------------------
                              TRACABILITE OPPOSABLE
--------------------------------------------------------------------------------
Hash source (SHA-256): ${metadata.sourceHash}
Ce document est genere a partir des donnees validees et verrouillees.
Toute modification des donnees source invaliderait ce hash.

--------------------------------------------------------------------------------
                           VERIFICATION D'AUTHENTICITE
--------------------------------------------------------------------------------
Pour verifier l'authenticite de ce document, scannez le QR code ou visitez:
${verificationUrl}

================================================================================
                       FIN DU RAPPORT - ${metadata.documentCode}
================================================================================
`;

  return content;
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

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
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

    // Get all DRAFT_PDF documents (skip SIGNED ones as they shouldn't change)
    const { data: documents, error: docsError } = await supabaseAdmin
      .from("documents")
      .select("*")
      .eq("status", "DRAFT_PDF");

    if (docsError) {
      throw docsError;
    }

    if (!documents || documents.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No draft documents to regenerate",
          regenerated: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let regeneratedCount = 0;
    const errors: string[] = [];

    for (const doc of documents) {
      try {
        const periodMonth = doc.period_month;
        const [year, month] = periodMonth.split("-").map(Number);
        const monthStart = `${periodMonth}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const monthEnd = `${periodMonth}-${lastDay.toString().padStart(2, "0")}`;

        let query = supabaseAdmin
          .from("work_summaries")
          .select(`
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
          `)
          .eq("validation_status", "VALIDATED")
          .eq("is_current", true)
          .gte("work_date", monthStart)
          .lte("work_date", monthEnd);

        if (doc.document_type === "RAP" && doc.worker_id) {
          query = query.eq("worker_id", doc.worker_id);
        }

        if (doc.category_id) {
          query = query.eq("workers.category_id", doc.category_id);
        }

        const { data: summaries, error: summariesError } = await query.order("work_date");

        if (summariesError || !summaries || summaries.length === 0) {
          errors.push(`${doc.document_code}: No data found`);
          continue;
        }

        const dailyRows = generateDailyExportRows(summaries);
        let sourceJson: string;
        let pdfContent: string;

        if (doc.document_type === "RAP") {
          sourceJson = JSON.stringify({ type: "RAP", rows: dailyRows });
          const sourceHash = await sha256(sourceJson);

          pdfContent = generateRAPContent(dailyRows, {
            documentCode: doc.document_code,
            exportVersion: "1.1",
            generatedAt: new Date().toISOString(),
            generatedBy: user.email || user.id,
            sourceHash,
            periodMonth,
            workerName: dailyRows[0]?.nom_affiche || "N/A",
            matricule: dailyRows[0]?.matricule || "N/A",
            categorie: dailyRows[0]?.categorie || "N/A",
          });
        } else {
          const monthlyRows = generateMonthlyExportRows(dailyRows, periodMonth);
          sourceJson = JSON.stringify({ type: "PTG", rows: monthlyRows });
          const sourceHash = await sha256(sourceJson);

          let categoryName: string | undefined;
          if (doc.category_id) {
            const { data: cat } = await supabaseAdmin
              .from("categories")
              .select("nom")
              .eq("id", doc.category_id)
              .single();
            categoryName = cat?.nom;
          }

          pdfContent = generatePTGContent(monthlyRows, {
            documentCode: doc.document_code,
            exportVersion: "1.1",
            generatedAt: new Date().toISOString(),
            generatedBy: user.email || user.id,
            sourceHash: await sha256(sourceJson),
            periodMonth,
            categoryFilter: categoryName,
          });
        }

        const pdfBytes = generatePDFBytes(pdfContent);

        // Delete old file
        await supabaseAdmin.storage
          .from("documents")
          .remove([doc.storage_path]);

        // Upload new PDF
        const { error: uploadError } = await supabaseAdmin.storage
          .from("documents")
          .upload(doc.storage_path, pdfBytes, {
            contentType: "application/pdf",
            upsert: true,
          });

        if (uploadError) {
          errors.push(`${doc.document_code}: Upload failed - ${uploadError.message}`);
          continue;
        }

        // Update file size
        await supabaseAdmin
          .from("documents")
          .update({
            file_size_bytes: pdfBytes.length,
            export_version: "1.1",
          })
          .eq("id", doc.id);

        regeneratedCount++;
      } catch (err) {
        errors.push(`${doc.document_code}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    // Log to audit
    await supabaseAdmin.from("admin_audit").insert({
      device_id: "edge-function",
      actor_user_id: user.id,
      event: "PDF_REGENERATED_BATCH",
      reason: `Regenerated ${regeneratedCount} documents to valid PDF format`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        regenerated: regeneratedCount,
        total: documents.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
