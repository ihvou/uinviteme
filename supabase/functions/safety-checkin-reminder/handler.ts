import { processSafetyCheckins, SafetyEnv } from "../_shared/safety.ts";
import { CORS_HEADERS, jsonResponse } from "../_shared/http.ts";

export async function handleSafetyCheckinReminderRequest(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const configuredSecret = Deno.env.get("SAFETY_CRON_SECRET")?.trim();
  if (configuredSecret) {
    const provided = req.headers.get("x-safety-cron-secret")?.trim();
    if (provided !== configuredSecret) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
  }

  try {
    const result = await processSafetyCheckins(readEnv(), fetch);
    return jsonResponse(result);
  } catch (error) {
    console.error("safety-checkin-reminder failed", error);
    return jsonResponse({
      error: error instanceof Error ? error.message : "Check-in processing failed",
    }, 500);
  }
}

function readEnv(): SafetyEnv {
  return {
    supabaseUrl: requiredEnv("SUPABASE_URL"),
    supabaseServiceRoleKey: requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    telegramBotToken: requiredEnv("TELEGRAM_BOT_TOKEN"),
    telegramApiBaseUrl: Deno.env.get("TELEGRAM_API_BASE_URL") ||
      "https://api.telegram.org",
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
