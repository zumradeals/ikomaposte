import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyPinRequest {
  pin: string;
  device_id: string;
  device_secret?: string;
  scope?: string;
}

interface VerifyPinResponse {
  ok: boolean;
  reason?: string;
  session_duration_ms?: number;
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
    const body: VerifyPinRequest = await req.json();
    const { pin, device_id, device_secret, scope = "global" } = body;

    // Validation
    if (!pin || typeof pin !== "string" || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return new Response(
        JSON.stringify({ ok: false, reason: "INVALID_PIN_FORMAT" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!device_id || typeof device_id !== "string") {
      return new Response(
        JSON.stringify({ ok: false, reason: "MISSING_DEVICE_ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get client info for audit
    const userAgent = req.headers.get("user-agent") || "unknown";
    const forwardedFor = req.headers.get("x-forwarded-for");
    const realIp = req.headers.get("x-real-ip");
    const ipAddress = forwardedFor?.split(",")[0]?.trim() || realIp || "unknown";

    // Log the attempt
    await supabase.from("admin_audit").insert({
      device_id,
      event: "ADMIN_LOGIN_ATTEMPT",
      reason: `scope=${scope}`,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    // Fetch active PIN hash for the scope
    // Try specific scope first, then fall back to global
    let { data: secretData, error: secretError } = await supabase
      .from("admin_secrets")
      .select("id, pin_hash, scope")
      .eq("is_active", true)
      .eq("scope", scope)
      .single();

    // If no specific scope found and we're not already looking for global, try global
    if (!secretData && scope !== "global") {
      const globalResult = await supabase
        .from("admin_secrets")
        .select("id, pin_hash, scope")
        .eq("is_active", true)
        .eq("scope", "global")
        .single();
      
      secretData = globalResult.data;
      secretError = globalResult.error;
    }

    if (!secretData) {
      // No PIN configured - this is a setup issue
      // Log failure
      await supabase.from("admin_audit").insert({
        device_id,
        event: "ADMIN_LOGIN_FAIL",
        reason: "NO_PIN_CONFIGURED",
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      console.error("[verify-admin-pin] No active PIN found for scope:", scope);
      return new Response(
        JSON.stringify({ ok: false, reason: "NO_PIN_CONFIGURED" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify PIN using bcrypt
    const isValid = await bcrypt.compare(pin, secretData.pin_hash);

    if (!isValid) {
      // Log failure
      await supabase.from("admin_audit").insert({
        device_id,
        event: "ADMIN_LOGIN_FAIL",
        reason: "INVALID_PIN",
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      return new Response(
        JSON.stringify({ ok: false, reason: "INVALID_PIN" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Optional: Verify device trust if device_secret provided
    if (device_secret) {
      const { data: deviceData } = await supabase
        .from("devices")
        .select("id, device_secret")
        .eq("device_id", device_id)
        .eq("actif", true)
        .single();

      if (!deviceData || deviceData.device_secret !== device_secret) {
        await supabase.from("admin_audit").insert({
          device_id,
          event: "ADMIN_LOGIN_FAIL",
          reason: "DEVICE_SECRET_MISMATCH",
          ip_address: ipAddress,
          user_agent: userAgent,
        });

        return new Response(
          JSON.stringify({ ok: false, reason: "DEVICE_NOT_TRUSTED" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Success! Log it
    await supabase.from("admin_audit").insert({
      device_id,
      event: "ADMIN_LOGIN_SUCCESS",
      reason: `scope=${secretData.scope}`,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    // Return success with session duration (10 minutes)
    const response: VerifyPinResponse = {
      ok: true,
      session_duration_ms: 10 * 60 * 1000, // 10 minutes
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[verify-admin-pin] Error:", error);
    return new Response(
      JSON.stringify({ ok: false, reason: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
