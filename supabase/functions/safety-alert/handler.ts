import {
  SafetyEnv,
  SafetyEscalationReason,
  sendSafetyAlertForPack,
} from "../_shared/safety.ts";
import { CORS_HEADERS, jsonResponse } from "../_shared/http.ts";

export async function handleSafetyAlertRequest(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const userId = getVerifiedUserId(req);
  if (!userId) return jsonResponse({ error: "Unauthorized" }, 401);

  try {
    const env = readEnv();
    const body = await req.json() as {
      packId?: string;
      reason?: SafetyEscalationReason;
    };

    if (!body.packId || !isReason(body.reason)) {
      return jsonResponse({ error: "packId and reason are required" }, 400);
    }

    const result = await sendSafetyAlertForPack(env, fetch, {
      packId: body.packId,
      reason: body.reason,
      userId,
    });

    return jsonResponse({ ok: true, ...result });
  } catch (error) {
    console.error("safety-alert failed", error);
    const message = error instanceof Error ? error.message : "Alert failed";
    return jsonResponse({ error: message }, message === "Forbidden" ? 403 : 500);
  }
}

function readEnv(): SafetyEnv {
  return {
    supabaseUrl: requiredEnv("SUPABASE_URL"),
    supabaseServiceRoleKey: requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    twilioAccountSid: requiredEnv("TWILIO_ACCOUNT_SID"),
    twilioAuthToken: requiredEnv("TWILIO_AUTH_TOKEN"),
    twilioMessagingServiceSid: requiredEnv("TWILIO_MESSAGING_SERVICE_SID"),
    twilioApiBaseUrl: Deno.env.get("TWILIO_API_BASE_URL") ||
      "https://api.twilio.com/2010-04-01",
  };
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function isReason(value: unknown): value is SafetyEscalationReason {
  return value === "emergency" || value === "missed_checkin";
}

function getVerifiedUserId(req: Request) {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  try {
    const [, payload] = token.split(".");
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + (4 - normalized.length % 4) % 4,
      "=",
    );
    const decoded = JSON.parse(atob(padded));
    return typeof decoded.sub === "string" ? decoded.sub : null;
  } catch {
    return null;
  }
}
