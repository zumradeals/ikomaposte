import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RotatePinRequest {
  current_pin: string;
  new_pin: string;
  scope?: string;
}

interface RotatePinResponse {
  ok: boolean;
  reason?: string;
}

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
      return new Response(
        JSON.stringify({ ok: false, reason: "UNAUTHORIZED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create service client to verify user and check admin role
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await serviceClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ ok: false, reason: "INVALID_TOKEN" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;

    // Check if user is admin
    const { data: roleData } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ ok: false, reason: "NOT_ADMIN" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request
    const body: RotatePinRequest = await req.json();
    const { current_pin, new_pin, scope = "global" } = body;

    // Validate PINs
    if (!current_pin || !/^\d{4}$/.test(current_pin)) {
      return new Response(
        JSON.stringify({ ok: false, reason: "INVALID_CURRENT_PIN_FORMAT" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!new_pin || !/^\d{4}$/.test(new_pin)) {
      return new Response(
        JSON.stringify({ ok: false, reason: "INVALID_NEW_PIN_FORMAT" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (current_pin === new_pin) {
      return new Response(
        JSON.stringify({ ok: false, reason: "PIN_UNCHANGED" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get current active PIN
    const { data: currentSecret } = await serviceClient
      .from("admin_secrets")
      .select("id, pin_hash")
      .eq("is_active", true)
      .eq("scope", scope)
      .single();

    if (!currentSecret) {
      return new Response(
        JSON.stringify({ ok: false, reason: "NO_PIN_CONFIGURED" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify current PIN
    const isCurrentValid = await bcrypt.compare(current_pin, currentSecret.pin_hash);
    if (!isCurrentValid) {
      return new Response(
        JSON.stringify({ ok: false, reason: "CURRENT_PIN_INCORRECT" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Hash new PIN with bcrypt (cost 10)
    const salt = await bcrypt.genSalt(10);
    const newPinHash = await bcrypt.hash(new_pin, salt);

    // Deactivate old PIN
    await serviceClient
      .from("admin_secrets")
      .update({
        is_active: false,
        rotated_at: new Date().toISOString(),
        rotated_by: userId,
      })
      .eq("id", currentSecret.id);

    // Insert new PIN
    await serviceClient.from("admin_secrets").insert({
      scope,
      pin_hash: newPinHash,
      is_active: true,
      created_by: userId,
    });

    // Log the rotation
    await serviceClient.from("admin_audit").insert({
      device_id: "admin-rotation",
      event: "ADMIN_PIN_ROTATED",
      reason: `scope=${scope}, by=${userId}`,
      ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
      user_agent: req.headers.get("user-agent") || "unknown",
    });

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[rotate-admin-pin] Error:", error);
    return new Response(
      JSON.stringify({ ok: false, reason: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
