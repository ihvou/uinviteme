import { CORS_HEADERS, jsonResponse } from "../_shared/http.ts";
import {
  assertSupportedPhoneCountry,
  maskPhone,
  normalizePhoneE164,
} from "../_shared/phone.ts";
import {
  Fetcher,
  supabaseRest,
  SupabaseServiceEnv,
} from "../_shared/supabaseRest.ts";
import {
  startTwilioVerification,
  TwilioVerifyEnv,
} from "../_shared/twilioVerify.ts";

export type PhoneVerificationPurpose = "web_invite" | "telegram_discovery";

export interface SendPhoneOtpEnv extends SupabaseServiceEnv, TwilioVerifyEnv {}

interface SendPhoneOtpBody {
  phone?: string;
  purpose?: PhoneVerificationPurpose;
  metadata?: Record<string, unknown>;
}

export async function handleSendPhoneOtpRequest(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let env: SendPhoneOtpEnv;

  try {
    env = readEnv();
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : "Configuration error",
    }, 500);
  }

  try {
    const body = await req.json() as SendPhoneOtpBody;
    const result = await sendPhoneOtp(body, env, fetch);
    return jsonResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "OTP send failed";
    const status = message.includes("supports") ||
        message.includes("E.164") ||
        message === "Invalid request"
      ? 400
      : 500;
    return jsonResponse({ error: message }, status);
  }
}

export async function sendPhoneOtp(
  body: SendPhoneOtpBody,
  env: SendPhoneOtpEnv,
  fetcher: Fetcher,
) {
  const phone = body.phone?.trim();
  if (!phone) throw new Error("Invalid request");

  const phoneE164 = normalizePhoneE164(phone);
  const countryCode = assertSupportedPhoneCountry(phoneE164);
  const purpose = body.purpose ?? "web_invite";
  const verificationId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const verification = await startTwilioVerification(env, fetcher, phoneE164);

  await supabaseRest(env, fetcher, "/rest/v1/phone_verifications", {
    method: "POST",
    body: JSON.stringify({
      id: verificationId,
      phone_e164: phoneE164,
      country_code: countryCode,
      channel: "sms",
      purpose,
      status: "pending",
      provider: "twilio_verify",
      provider_service_sid: env.twilioVerifyServiceSid,
      provider_verification_sid: verification.sid,
      provider_status: verification.status,
      expires_at: expiresAt,
      metadata: body.metadata ?? {},
    }),
  });

  return {
    ok: true,
    verificationId,
    phoneE164: maskPhone(phoneE164),
    expiresAt,
  };
}

function readEnv(): SendPhoneOtpEnv {
  return {
    supabaseUrl: requiredEnv("SUPABASE_URL"),
    supabaseServiceRoleKey: requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    twilioAccountSid: requiredEnv("TWILIO_ACCOUNT_SID"),
    twilioAuthToken: requiredEnv("TWILIO_AUTH_TOKEN"),
    twilioVerifyServiceSid: requiredEnv("TWILIO_VERIFY_SERVICE_SID"),
    twilioVerifyApiBaseUrl: Deno.env.get("TWILIO_VERIFY_API_BASE_URL") ||
      "https://verify.twilio.com/v2",
  };
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}
