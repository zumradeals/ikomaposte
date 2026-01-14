// ============================================
// IKOMA POSTE - Document Signing Edge Function v1.0
// ============================================
// Signs a PDF document with visual seal/signature and/or cryptographic hash
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SignRequest {
  documentId: string;
  signatureLevel: "VISUAL" | "SEALED" | "BOTH";
}

// Calculate SHA-256 hash
async function sha256(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Generate a visual seal block as text (appended to PDF content)
function generateVisualSealBlock(
  documentCode: string,
  sourceHash: string,
  pdfHash: string,
  signedAt: string,
  signedBy: string
): string {
  return `
================================================================================
                        CACHET ÉLECTRONIQUE IKOMA POSTE
================================================================================

  ┌─────────────────────────────────────────────────────────────────────────┐
  │                                                                         │
  │   ██╗██╗  ██╗ ██████╗ ███╗   ███╗ █████╗     ██████╗  ██████╗ ███████╗  │
  │   ██║██║ ██╔╝██╔═══██╗████╗ ████║██╔══██╗    ██╔══██╗██╔═══██╗██╔════╝  │
  │   ██║█████╔╝ ██║   ██║██╔████╔██║███████║    ██████╔╝██║   ██║███████╗  │
  │   ██║██╔═██╗ ██║   ██║██║╚██╔╝██║██╔══██║    ██╔═══╝ ██║   ██║╚════██║  │
  │   ██║██║  ██╗╚██████╔╝██║ ╚═╝ ██║██║  ██║    ██║     ╚██████╔╝███████║  │
  │   ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═╝    ╚═╝      ╚═════╝ ╚══════╝  │
  │                                                                         │
  │                        DOCUMENT SIGNÉ ET SCELLÉ                         │
  │                                                                         │
  └─────────────────────────────────────────────────────────────────────────┘

  Document:     ${documentCode}
  Signé le:     ${new Date(signedAt).toLocaleString("fr-FR", { 
    dateStyle: "full", 
    timeStyle: "medium" 
  })}
  Signé par:    ${signedBy}

  ─────────────────────────────────────────────────────────────────────────────
  EMPREINTES CRYPTOGRAPHIQUES (SHA-256)
  ─────────────────────────────────────────────────────────────────────────────
  
  Source Data Hash:  ${sourceHash}
  PDF Document Hash: ${pdfHash}

  ─────────────────────────────────────────────────────────────────────────────
  VÉRIFICATION D'INTÉGRITÉ
  ─────────────────────────────────────────────────────────────────────────────
  
  Ce document a été signé électroniquement par IKOMA POSTE.
  Pour vérifier son intégrité, utilisez l'outil de vérification avec le code:
  
  ${documentCode}
  
  Toute modification du contenu invalide cette signature.

================================================================================
`;
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
    const body: SignRequest = await req.json();
    const { documentId, signatureLevel } = body;

    if (!documentId || !signatureLevel) {
      throw new Error("Missing documentId or signatureLevel");
    }

    // Fetch document
    const { data: doc, error: docError } = await supabaseAdmin
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (docError || !doc) {
      throw new Error("Document not found");
    }

    if (doc.status === "SIGNED") {
      throw new Error("Document already signed");
    }

    if (doc.status === "REVOKED") {
      throw new Error("Cannot sign revoked document");
    }

    // Download original PDF
    const { data: pdfData, error: downloadError } = await supabaseAdmin.storage
      .from("documents")
      .download(doc.storage_path);

    if (downloadError || !pdfData) {
      throw new Error("Failed to download PDF");
    }

    const originalPdfBytes = new Uint8Array(await pdfData.arrayBuffer());
    const signedAt = new Date().toISOString();

    let finalPdfBytes: Uint8Array;
    let pdfHash: string;

    if (signatureLevel === "VISUAL" || signatureLevel === "BOTH") {
      // Add visual seal block to PDF content
      const decoder = new TextDecoder();
      const originalContent = decoder.decode(originalPdfBytes);

      // Generate seal block with placeholder hash (will be calculated after)
      const tempHash = "CALCULATING...";
      const sealBlock = generateVisualSealBlock(
        doc.document_code,
        doc.source_hash,
        tempHash,
        signedAt,
        user.email || user.id
      );

      // Combine content
      const signedContent = originalContent + sealBlock;
      const encoder = new TextEncoder();
      const signedBytes = encoder.encode(signedContent);

      // Calculate hash of signed PDF
      pdfHash = await sha256(signedBytes.buffer as ArrayBuffer);

      // Now regenerate seal block with actual hash
      const finalSealBlock = generateVisualSealBlock(
        doc.document_code,
        doc.source_hash,
        pdfHash,
        signedAt,
        user.email || user.id
      );

      const finalContent = originalContent + finalSealBlock;
      finalPdfBytes = encoder.encode(finalContent);

      // Recalculate final hash (should match)
      pdfHash = await sha256(finalPdfBytes.buffer as ArrayBuffer);
    } else {
      // SEALED only - just calculate hash of original PDF
      finalPdfBytes = originalPdfBytes;
      pdfHash = await sha256(originalPdfBytes.buffer as ArrayBuffer);
    }

    // Create seal block JSON
    const sealBlock = {
      document_code: doc.document_code,
      source_hash: doc.source_hash,
      pdf_hash: pdfHash,
      signed_at: signedAt,
      signed_by: user.id,
      signature_level: signatureLevel,
    };

    // Upload signed PDF (replace original)
    const signedPath = doc.storage_path.replace(".pdf", "-signed.pdf");
    const { error: uploadError } = await supabaseAdmin.storage
      .from("documents")
      .upload(signedPath, finalPdfBytes, {
        contentType: "text/plain",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw new Error("Failed to upload signed PDF");
    }

    // Update document record using RPC
    const { data: signedDoc, error: signError } = await supabaseAdmin.rpc(
      "sign_document",
      {
        p_document_id: documentId,
        p_signature_level: signatureLevel,
        p_pdf_hash: pdfHash,
        p_seal_block: sealBlock,
      }
    );

    if (signError) {
      console.error("Sign error:", signError);
      throw new Error(signError.message || "Failed to sign document");
    }

    // Update storage path
    await supabaseAdmin
      .from("documents")
      .update({
        storage_path: signedPath,
        file_size_bytes: finalPdfBytes.length,
      })
      .eq("id", documentId);

    // Log to audit
    await supabaseAdmin.from("admin_audit").insert({
      device_id: "edge-function",
      actor_user_id: user.id,
      event: "DOCUMENT_SIGNED",
      reason: `Signed ${doc.document_code} with level ${signatureLevel}. Hash: ${pdfHash.substring(0, 16)}...`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        document: {
          id: documentId,
          documentCode: doc.document_code,
          status: "SIGNED",
          signatureLevel,
          pdfHash,
          signedAt,
          signedBy: user.email || user.id,
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
