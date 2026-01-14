import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============ RATE LIMITING (in-memory, per-instance) ============
// In production with multiple instances, use Redis/KV store instead
interface RateLimitEntry {
  attempts: number;
  lastAttempt: number;
  lockedUntil: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const RATE_LIMIT_CONFIG = {
  maxAttempts: 5,           // Max failed attempts before lockout
  windowMs: 5 * 60 * 1000,  // 5 minute window
  lockoutMs: 15 * 60 * 1000, // 15 minute lockout after max attempts
  cleanupIntervalMs: 60 * 1000, // Cleanup old entries every minute
};

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    // Remove entries that are past their lockout and window
    if (now > entry.lockedUntil && now - entry.lastAttempt > RATE_LIMIT_CONFIG.windowMs) {
      rateLimitStore.delete(key);
    }
  }
}, RATE_LIMIT_CONFIG.cleanupIntervalMs);

function checkRateLimit(key: string): { allowed: boolean; retryAfterMs?: number; attemptsRemaining?: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry) {
    return { allowed: true, attemptsRemaining: RATE_LIMIT_CONFIG.maxAttempts };
  }

  // Check if currently locked out
  if (entry.lockedUntil > now) {
    return { 
      allowed: false, 
      retryAfterMs: entry.lockedUntil - now 
    };
  }

  // Check if window has expired - reset counter
  if (now - entry.lastAttempt > RATE_LIMIT_CONFIG.windowMs) {
    rateLimitStore.delete(key);
    return { allowed: true, attemptsRemaining: RATE_LIMIT_CONFIG.maxAttempts };
  }

  // Check attempts within window
  if (entry.attempts >= RATE_LIMIT_CONFIG.maxAttempts) {
    // Trigger lockout
    entry.lockedUntil = now + RATE_LIMIT_CONFIG.lockoutMs;
    return { 
      allowed: false, 
      retryAfterMs: RATE_LIMIT_CONFIG.lockoutMs 
    };
  }

  return { 
    allowed: true, 
    attemptsRemaining: RATE_LIMIT_CONFIG.maxAttempts - entry.attempts 
  };
}

function recordFailedAttempt(key: string): void {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry) {
    rateLimitStore.set(key, {
      attempts: 1,
      lastAttempt: now,
      lockedUntil: 0,
    });
    return;
  }

  // Reset if window expired
  if (now - entry.lastAttempt > RATE_LIMIT_CONFIG.windowMs) {
    entry.attempts = 1;
    entry.lastAttempt = now;
    entry.lockedUntil = 0;
    return;
  }

  entry.attempts++;
  entry.lastAttempt = now;

  // Apply lockout if max attempts reached
  if (entry.attempts >= RATE_LIMIT_CONFIG.maxAttempts) {
    entry.lockedUntil = now + RATE_LIMIT_CONFIG.lockoutMs;
  }
}

function resetRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

// ============ END RATE LIMITING ============

interface VerifyPinRequest {
  pin: string;
  device_id: string;
  scope?: string;
}

interface VerifyPinResponse {
  ok: boolean;
  reason?: string;
  session_duration_ms?: number;
  retry_after_ms?: number;
  attempts_remaining?: number;
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
    const { pin, device_id, scope = "global" } = body;

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

    // Get client info for rate limiting key and audit
    const forwardedFor = req.headers.get("x-forwarded-for");
    const realIp = req.headers.get("x-real-ip");
    const ipAddress = forwardedFor?.split(",")[0]?.trim() || realIp || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    // Rate limit key: combine device_id and IP for stronger protection
    const rateLimitKey = `${device_id}:${ipAddress}`;

    // Check rate limit BEFORE any processing
    const rateLimitCheck = checkRateLimit(rateLimitKey);
    if (!rateLimitCheck.allowed) {
      // Create Supabase client for audit logging
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Log rate limit hit
      await supabase.from("admin_audit").insert({
        device_id,
        event: "ADMIN_LOGIN_RATE_LIMITED",
        reason: `retry_after_ms=${rateLimitCheck.retryAfterMs}`,
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      const retryAfterSec = Math.ceil((rateLimitCheck.retryAfterMs || 0) / 1000);
      
      return new Response(
        JSON.stringify({ 
          ok: false, 
          reason: "RATE_LIMITED",
          retry_after_ms: rateLimitCheck.retryAfterMs,
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "Retry-After": String(retryAfterSec),
          } 
        }
      );
    }

    // Create Supabase client with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
      // No PIN configured - expected during initial setup. Do NOT count against rate limit.
      await supabase.from("admin_audit").insert({
        device_id,
        event: "ADMIN_LOGIN_FAIL",
        reason: "NO_PIN_CONFIGURED",
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      // Return 200 so clients can handle the state (avoids blank screens from treated-as-exception 5xx)
      return new Response(
        JSON.stringify({ ok: false, reason: "NO_PIN_CONFIGURED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify PIN using bcrypt
    const isValid = await bcrypt.compare(pin, secretData.pin_hash);

    if (!isValid) {
      // Record failed attempt for rate limiting
      recordFailedAttempt(rateLimitKey);
      
      // Get updated attempts remaining
      const updatedCheck = checkRateLimit(rateLimitKey);

      // Log failure
      await supabase.from("admin_audit").insert({
        device_id,
        event: "ADMIN_LOGIN_FAIL",
        reason: `INVALID_PIN, attempts_remaining=${updatedCheck.attemptsRemaining || 0}`,
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      const response: VerifyPinResponse = {
        ok: false,
        reason: "INVALID_PIN",
        attempts_remaining: updatedCheck.attemptsRemaining,
      };

      // If now locked out, include retry info
      if (!updatedCheck.allowed && updatedCheck.retryAfterMs) {
        response.retry_after_ms = updatedCheck.retryAfterMs;
      }

      return new Response(
        JSON.stringify(response),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Success! Reset rate limit counter for this key
    resetRateLimit(rateLimitKey);

    // Log success
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
