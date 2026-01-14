// ============================================
// IKOMA POSTE - Document Verification Edge Function v1.0
// ============================================
// Verifies the integrity of a signed PDF document
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyRequest {
  documentId?: string;
  documentCode?: string;
}

interface VerificationResult {
  valid: boolean;
  status: "OK" | "HASH_MISMATCH" | "NOT_SIGNED" | "REVOKED" | "NOT_FOUND" | "ERROR";
  message: string;
  document?: {
    documentCode: string;
    status: string;
    signedAt: string | null;
    signedBy: string | null;
    signatureLevel: string | null;
    storedHash: string | null;
    calculatedHash: string | null;
    sourceHash: string;
    revocationReason?: string;
  };
}

// Calculate SHA-256 hash
async function sha256(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client (no auth required for verification)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request
    const body: VerifyRequest = await req.json();
    const { documentId, documentCode } = body;

    if (!documentId && !documentCode) {
      throw new Error("Missing documentId or documentCode");
    }

    // Fetch document
    let query = supabaseAdmin.from("documents").select("*");
    
    if (documentId) {
      query = query.eq("id", documentId);
    } else if (documentCode) {
      query = query.eq("document_code", documentCode);
    }

    const { data: doc, error: docError } = await query.single();

    if (docError || !doc) {
      const result: VerificationResult = {
        valid: false,
        status: "NOT_FOUND",
        message: "Document introuvable",
      };
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if document is revoked
    if (doc.status === "REVOKED") {
      const result: VerificationResult = {
        valid: false,
        status: "REVOKED",
        message: "Document révoqué",
        document: {
          documentCode: doc.document_code,
          status: doc.status,
          signedAt: doc.signed_at,
          signedBy: doc.signed_by,
          signatureLevel: doc.signature_level,
          storedHash: doc.pdf_hash,
          calculatedHash: null,
          sourceHash: doc.source_hash,
          revocationReason: doc.revocation_reason,
        },
      };
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if document is signed
    if (doc.status !== "SIGNED") {
      const result: VerificationResult = {
        valid: false,
        status: "NOT_SIGNED",
        message: "Document non signé (brouillon)",
        document: {
          documentCode: doc.document_code,
          status: doc.status,
          signedAt: null,
          signedBy: null,
          signatureLevel: null,
          storedHash: null,
          calculatedHash: null,
          sourceHash: doc.source_hash,
        },
      };
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download PDF and calculate hash
    const { data: pdfData, error: downloadError } = await supabaseAdmin.storage
      .from("documents")
      .download(doc.storage_path);

    if (downloadError || !pdfData) {
      const result: VerificationResult = {
        valid: false,
        status: "ERROR",
        message: "Impossible de télécharger le PDF pour vérification",
        document: {
          documentCode: doc.document_code,
          status: doc.status,
          signedAt: doc.signed_at,
          signedBy: doc.signed_by,
          signatureLevel: doc.signature_level,
          storedHash: doc.pdf_hash,
          calculatedHash: null,
          sourceHash: doc.source_hash,
        },
      };
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pdfBytes = new Uint8Array(await pdfData.arrayBuffer());
    const calculatedHash = await sha256(pdfBytes.buffer as ArrayBuffer);

    // Compare hashes
    const hashesMatch = calculatedHash === doc.pdf_hash;

    if (hashesMatch) {
      const result: VerificationResult = {
        valid: true,
        status: "OK",
        message: "Document intègre et authentique",
        document: {
          documentCode: doc.document_code,
          status: doc.status,
          signedAt: doc.signed_at,
          signedBy: doc.signed_by,
          signatureLevel: doc.signature_level,
          storedHash: doc.pdf_hash,
          calculatedHash: calculatedHash,
          sourceHash: doc.source_hash,
        },
      };

      // Log verification
      await supabaseAdmin.from("admin_audit").insert({
        device_id: "edge-function",
        actor_user_id: doc.generated_by, // Use document generator as actor
        event: "DOCUMENT_VERIFIED",
        reason: `Verification OK for ${doc.document_code}`,
      });

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      const result: VerificationResult = {
        valid: false,
        status: "HASH_MISMATCH",
        message: "ALERTE: Le document a été modifié! Intégrité compromise.",
        document: {
          documentCode: doc.document_code,
          status: doc.status,
          signedAt: doc.signed_at,
          signedBy: doc.signed_by,
          signatureLevel: doc.signature_level,
          storedHash: doc.pdf_hash,
          calculatedHash: calculatedHash,
          sourceHash: doc.source_hash,
        },
      };

      // Log tampering alert
      await supabaseAdmin.from("admin_audit").insert({
        device_id: "edge-function",
        actor_user_id: doc.generated_by,
        event: "DOCUMENT_TAMPERED",
        reason: `TAMPERING DETECTED for ${doc.document_code}! Stored: ${doc.pdf_hash.substring(0, 16)}... Calculated: ${calculatedHash.substring(0, 16)}...`,
      });

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        valid: false,
        status: "ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
