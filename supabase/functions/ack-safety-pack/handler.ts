import { handleSafetyAction, SafetyAction, SafetyEnv } from "../_shared/safety.ts";
import { CORS_HEADERS, jsonResponse } from "../_shared/http.ts";

export async function handleAckSafetyPackRequest(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST" && req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const env = readEnv();
    const url = new URL(req.url);
    const body = req.method === "POST"
      ? await req.json().catch(() => ({})) as Record<string, unknown>
      : {};
    const action = String(body.action ?? url.searchParams.get("action") ?? "");
    const token = String(body.token ?? url.searchParams.get("token") ?? "");

    if (!isSafetyAction(action) || !token) {
      return jsonResponse({ error: "Valid action and token are required" }, 400);
    }

    const result = await handleSafetyAction(env, fetch, { action, token });
    return jsonResponse(result);
  } catch (error) {
    console.error("ack-safety-pack failed", error);
    const message = error instanceof Error ? error.message : "Safety action failed";
    return jsonResponse({ error: message }, message.includes("not found") ? 404 : 500);
  }
}

function readEnv(): SafetyEnv {
  return {
    supabaseUrl: requiredEnv("SUPABASE_URL"),
    supabaseServiceRoleKey: requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    twilioAccountSid: Deno.env.get("TWILIO_ACCOUNT_SID")?.trim(),
    twilioAuthToken: Deno.env.get("TWILIO_AUTH_TOKEN")?.trim(),
    twilioMessagingServiceSid: Deno.env.get("TWILIO_MESSAGING_SERVICE_SID")?.trim(),
    twilioApiBaseUrl: Deno.env.get("TWILIO_API_BASE_URL") ||
      "https://api.twilio.com/2010-04-01",
  };
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function isSafetyAction(value: string): value is SafetyAction {
  return value === "ok" || value === "call" || value === "emergency";
}
