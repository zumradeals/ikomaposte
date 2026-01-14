import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InitPinRequest {
  pin: string;
  scope?: string;
  force?: boolean;
}

// Note: device_secret removed from PIN verification flow
// Device trust is managed separately via the devices table

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, reason: "METHOD_NOT_ALLOWED" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Verify admin authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      // Return 200 so the web client can handle the error as a normal response
      // (supabase-js treats non-2xx as an exception-like error)
      return new Response(
        JSON.stringify({ ok: false, reason: "UNAUTHORIZED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create service client
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await serviceClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ ok: false, reason: "INVALID_TOKEN" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;

    // Bootstrap rule: if NO admin exists yet, allow the first authenticated user
    // to initialize the PIN and grant themselves the admin role.
    const { data: anyAdmin, error: anyAdminError } = await serviceClient
      .from("user_roles")
      .select("id")
      .eq("role", "admin")
      .limit(1);

    const hasAnyAdmin = !anyAdminError && Array.isArray(anyAdmin) && anyAdmin.length > 0;

    if (hasAnyAdmin) {
      // Normal mode: require admin role
      const { data: roleData } = await serviceClient
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .single();

      if (!roleData) {
        return new Response(
          JSON.stringify({ ok: false, reason: "NOT_ADMIN" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // First install: grant admin to current user
      const { error: grantError } = await serviceClient
        .from("user_roles")
        .insert({ user_id: userId, role: "admin" });

      if (grantError) {
        console.error("[init-admin-pin] Failed to bootstrap admin role:", grantError);
        return new Response(
          JSON.stringify({ ok: false, reason: "BOOTSTRAP_FAILED" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await serviceClient.from("admin_audit").insert({
        device_id: "admin-bootstrap",
        event: "ADMIN_BOOTSTRAPPED",
        reason: `first_admin=${userId}`,
        ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
        user_agent: req.headers.get("user-agent") || "unknown",
      });
    }

    // Parse request
    const body: InitPinRequest = await req.json();
    const { pin, scope = "global", force = false } = body;

    // Validate PIN
    if (!pin || !/^\d{4}$/.test(pin)) {
      return new Response(
        JSON.stringify({ ok: false, reason: "INVALID_PIN_FORMAT" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if PIN already exists for this scope
    const { data: existingSecret } = await serviceClient
      .from("admin_secrets")
      .select("id")
      .eq("is_active", true)
      .eq("scope", scope)
      .single();

    if (existingSecret && !force) {
      return new Response(
        JSON.stringify({ ok: false, reason: "PIN_ALREADY_EXISTS", hint: "Use rotate-admin-pin to change existing PIN" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If force and existing, deactivate old one
    if (existingSecret && force) {
      await serviceClient
        .from("admin_secrets")
        .update({
          is_active: false,
          rotated_at: new Date().toISOString(),
          rotated_by: userId,
        })
        .eq("id", existingSecret.id);
    }

    // Hash PIN with bcrypt (cost 10)
    const salt = await bcrypt.genSalt(10);
    const pinHash = await bcrypt.hash(pin, salt);

    // Insert new PIN
    await serviceClient.from("admin_secrets").insert({
      scope,
      pin_hash: pinHash,
      is_active: true,
      created_by: userId,
    });

    // Log the initialization
    await serviceClient.from("admin_audit").insert({
      device_id: "admin-init",
      event: "ADMIN_PIN_INITIALIZED",
      reason: `scope=${scope}, by=${userId}`,
      ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
      user_agent: req.headers.get("user-agent") || "unknown",
    });

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[init-admin-pin] Error:", error);
    return new Response(
      JSON.stringify({ ok: false, reason: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
