// ============================================
// IKOMA POSTE - PDF Document Generator v1.1
// ============================================
// Generates IKP-RAP (Individual Report) and IKP-PTG (Global Attendance)
// Based on VALIDATED daily/monthly export data
// Now generates valid PDF files
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
  periodMonth: string; // YYYY-MM
  workerId?: string; // Required for RAP
  categoryId?: string; // Optional filter
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
  // Remove special characters that may cause issues in PDF
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
  
  // Split text into lines
  const lines = sanitizedText.split("\n");
  
  // Calculate positions and build content stream
  const fontSize = 9;
  const lineHeight = 12;
  const marginLeft = 40;
  const marginTop = 750;
  const pageWidth = 595;
  const pageHeight = 842;
  
  // Build text operations for PDF
  let textOps = `BT\n/F1 ${fontSize} Tf\n`;
  let currentY = marginTop;
  let pageContent = "";
  
  for (const line of lines) {
    if (currentY < 50) {
      // Would need pagination for very long docs
      break;
    }
    // Escape special PDF characters
    const escapedLine = line
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)");
    
    textOps += `1 0 0 1 ${marginLeft} ${currentY} Tm\n(${escapedLine}) Tj\n`;
    currentY -= lineHeight;
  }
  textOps += "ET";
  
  // Build PDF structure
  const objects: string[] = [];
  let objectCount = 0;
  const objectOffsets: number[] = [];
  
  // Object 1: Catalog
  objectCount++;
  objects.push(`${objectCount} 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  
  // Object 2: Pages
  objectCount++;
  objects.push(`${objectCount} 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`);
  
  // Object 3: Page
  objectCount++;
  objects.push(`${objectCount} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n`);
  
  // Object 4: Content stream
  objectCount++;
  const streamContent = textOps;
  objects.push(`${objectCount} 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream\nendobj\n`);
  
  // Object 5: Font
  objectCount++;
  objects.push(`${objectCount} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n`);
  
  // Build the PDF
  let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  
  for (let i = 0; i < objects.length; i++) {
    objectOffsets.push(pdf.length);
    pdf += objects[i];
  }
  
  // Cross-reference table
  const xrefOffset = pdf.length;
  pdf += "xref\n";
  pdf += `0 ${objectCount + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of objectOffsets) {
    pdf += offset.toString().padStart(10, "0") + " 00000 n \n";
  }
  
  // Trailer
  pdf += "trailer\n";
  pdf += `<< /Size ${objectCount + 1} /Root 1 0 R >>\n`;
  pdf += "startxref\n";
  pdf += `${xrefOffset}\n`;
  pdf += "%%EOF";
  
  // Convert to bytes
  const encoder = new TextEncoder();
  return encoder.encode(pdf);
}

// Format minutes to hours display
function formatMinutesToHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h${mins.toString().padStart(2, "0")}`;
}

// Format date for display
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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

// Generate verification URL (DOCTRINE: Only URL in QR, no sensitive data)
function generateVerificationUrl(documentCode: string): string {
  // Production URL for IKOMA POSTE
  return `https://ikomaposte.lovable.app/verify/${encodeURIComponent(documentCode)}`;
}

// Generate PDF content for Individual Report (IKP-RAP)
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
Généré le: ${new Date(metadata.generatedAt).toLocaleString("fr-FR")}
Généré par: ${metadata.generatedBy}

--------------------------------------------------------------------------------
                              INFORMATIONS SALARIÉ
--------------------------------------------------------------------------------
Nom: ${metadata.workerName}
Matricule: ${metadata.matricule}
Catégorie: ${metadata.categorie}
Période: ${metadata.periodMonth}

--------------------------------------------------------------------------------
                                RÉSUMÉ MENSUEL
--------------------------------------------------------------------------------
Total travaillé: ${formatMinutesToHours(totalMinutes)} (${totalMinutes} minutes)
Montant total: ${totalAmount.toLocaleString("fr-FR")} ${rows[0]?.devise || "XOF"}

Jours présent: ${presentDays}
Jours en retard: ${lateDays}
Jours absent: ${absentDays}
Jours anomalie: ${anomalyDays}

--------------------------------------------------------------------------------
                              DÉTAIL JOURNALIER
--------------------------------------------------------------------------------
`;

  // Sort by date
  const sortedRows = [...rows].sort((a, b) =>
    a.work_date.localeCompare(b.work_date)
  );

  for (const row of sortedRows) {
    const statusIcon =
      row.day_status === "PRESENT"
        ? "✓"
        : row.day_status === "RETARD"
        ? "⏰"
        : row.day_status === "ABSENT"
        ? "✗"
        : "⚠";

    content += `${formatDate(row.work_date)} | ${statusIcon} ${row.day_status.padEnd(8)} | ${formatMinutesToHours(row.total_work_minutes).padStart(6)} | ${row.montant.toLocaleString("fr-FR").padStart(8)} ${row.devise}\n`;
  }

  content += `
--------------------------------------------------------------------------------
                              TRAÇABILITÉ OPPOSABLE
--------------------------------------------------------------------------------
Hash source (SHA-256): ${metadata.sourceHash}
Ce document est généré à partir des données validées et verrouillées.
Toute modification des données source invaliderait ce hash.

--------------------------------------------------------------------------------
                           VÉRIFICATION D'AUTHENTICITÉ
--------------------------------------------------------------------------------
Pour vérifier l'authenticité de ce document, scannez le QR code ou visitez:
${verificationUrl}

================================================================================
                         FIN DU RAPPORT - ${metadata.documentCode}
================================================================================
`;

  return content;
}

// Generate PDF content for Global Attendance (IKP-PTG)
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
Généré le: ${new Date(metadata.generatedAt).toLocaleString("fr-FR")}
Généré par: ${metadata.generatedBy}

--------------------------------------------------------------------------------
                              PARAMÈTRES DU RAPPORT
--------------------------------------------------------------------------------
Période: ${metadata.periodMonth}
Filtre catégorie: ${metadata.categoryFilter || "Toutes"}
Nombre de salariés: ${rows.length}

--------------------------------------------------------------------------------
                                 TOTAUX GLOBAUX
--------------------------------------------------------------------------------
Total heures travaillées: ${formatMinutesToHours(totalMinutes)} (${totalMinutes} minutes)
Total montant: ${totalAmount.toLocaleString("fr-FR")} ${rows[0]?.devise || "XOF"}

Total jours travaillés: ${totalWorkedDays}
Total jours retard: ${totalLateDays}
Total jours absence: ${totalAbsentDays}
Total jours anomalie: ${totalAnomalyDays}
Salariés avec anomalies: ${workersWithAnomalies}

--------------------------------------------------------------------------------
                              DÉTAIL PAR SALARIÉ
--------------------------------------------------------------------------------
`;

  content += "Matricule   | Nom                          | Heures    | Jours | Retards | Absences | Montant\n";
  content += "------------|------------------------------|-----------|-------|---------|----------|----------------\n";

  for (const row of rows) {
    const anomalyFlag = row.has_anomalies ? "*" : " ";
    content += `${row.matricule.padEnd(11)} | ${row.nom_affiche.substring(0, 28).padEnd(28)} | ${formatMinutesToHours(row.total_work_minutes).padStart(9)} | ${row.worked_days.toString().padStart(5)} | ${row.late_days.toString().padStart(7)} | ${row.absent_days.toString().padStart(8)} | ${row.montant_total.toLocaleString("fr-FR").padStart(12)} ${row.devise}${anomalyFlag}\n`;
  }

  content += `
* = Salarié avec au moins un jour en anomalie

--------------------------------------------------------------------------------
                              TRAÇABILITÉ OPPOSABLE
--------------------------------------------------------------------------------
Hash source (SHA-256): ${metadata.sourceHash}
Ce document est généré à partir des données validées et verrouillées.
Toute modification des données source invaliderait ce hash.

--------------------------------------------------------------------------------
                           VÉRIFICATION D'AUTHENTICITÉ
--------------------------------------------------------------------------------
Pour vérifier l'authenticité de ce document, scannez le QR code ou visitez:
${verificationUrl}

================================================================================
                       FIN DU RAPPORT - ${metadata.documentCode}
================================================================================
`;

  return content;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    // Create Supabase clients
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      throw new Error("Not authenticated");
    }

    // Check admin role
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!roles) {
      throw new Error("Admin role required");
    }

    // Parse request
    const body: GenerateRequest = await req.json();
    const { type, periodMonth, workerId, categoryId } = body;

    if (!type || !periodMonth) {
      throw new Error("Missing type or periodMonth");
    }

    if (type === "RAP" && !workerId) {
      throw new Error("workerId required for RAP");
    }

    // Calculate month boundaries
    const [year, month] = periodMonth.split("-").map(Number);
    const monthStart = `${periodMonth}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const monthEnd = `${periodMonth}-${lastDay.toString().padStart(2, "0")}`;

    // Fetch summaries
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

    const { data: summaries, error: summariesError } = await query.order(
      "work_date"
    );

    if (summariesError) {
      throw summariesError;
    }

    if (!summaries || summaries.length === 0) {
      throw new Error("No validated data found for this period");
    }

    // Generate export data
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

    // Calculate source hash
    const sourceHash = await sha256(sourceJson);

    // Get next sequence number
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

    // Get worker info for RAP
    let workerInfo = { name: "", matricule: "", categorie: "" };
    if (type === "RAP" && dailyRows.length > 0) {
      workerInfo = {
        name: dailyRows[0].nom_affiche,
        matricule: dailyRows[0].matricule,
        categorie: dailyRows[0].categorie,
      };
    }

    // Get category name if filtered
    let categoryName: string | undefined;
    if (categoryId) {
      const { data: cat } = await supabaseAdmin
        .from("categories")
        .select("nom")
        .eq("id", categoryId)
        .single();
      categoryName = cat?.nom;
    }

    // Generate PDF content
    let pdfContent: string;
    if (type === "RAP") {
      pdfContent = generateRAPContent(dailyRows, {
        documentCode,
        exportVersion: "1.0",
        generatedAt,
        generatedBy: user.email || user.id,
        sourceHash,
        periodMonth,
        workerName: workerInfo.name,
        matricule: workerInfo.matricule,
        categorie: workerInfo.categorie,
      });
    } else {
      pdfContent = generatePTGContent(exportData as MonthlyExportRow[], {
        documentCode,
        exportVersion: "1.0",
        generatedAt,
        generatedBy: user.email || user.id,
        sourceHash,
        periodMonth,
        categoryFilter: categoryName,
      });
    }

    // Convert text content to valid PDF binary
    const pdfBytes = generatePDFBytes(pdfContent);

    // Store in storage
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

    // Store document record
    const { data: docRecord, error: docError } = await supabaseAdmin
      .from("documents")
      .insert({
        document_code: documentCode,
        document_type: type,
        period_month: periodMonth,
        worker_id: type === "RAP" ? workerId : null,
        category_id: categoryId || null,
        export_version: "1.0",
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

    // Log to audit
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
