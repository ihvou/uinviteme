import { CORS_HEADERS, jsonResponse } from "../_shared/http.ts";
import { normalizePhoneE164 } from "../_shared/phone.ts";
import {
  Fetcher,
  supabaseRest,
  SupabaseServiceEnv,
} from "../_shared/supabaseRest.ts";
import {
  checkTwilioVerification,
  TwilioVerifyEnv,
} from "../_shared/twilioVerify.ts";

export interface VerifyPhoneOtpEnv
  extends SupabaseServiceEnv, TwilioVerifyEnv {
  phoneVerificationTestCode?: string | null;
}

interface VerifyPhoneOtpBody {
  verificationId?: string;
  phone?: string;
  code?: string;
}

interface PhoneVerificationRecord {
  id: string;
  phone_e164: string;
  status: "pending" | "approved" | "failed" | "expired" | "canceled";
  attempt_count: number | null;
  expires_at: string | null;
}

export async function handleVerifyPhoneOtpRequest(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let env: VerifyPhoneOtpEnv;

  try {
    env = readEnv();
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : "Configuration error",
    }, 500);
  }

  try {
    const body = await req.json() as VerifyPhoneOtpBody;
    const result = await verifyPhoneOtp(body, env, fetch);
    return jsonResponse(result);
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "OTP verification failed";
    const status = [
        "Invalid request",
        "Invalid verification code",
        "Verification not found",
        "Verification expired",
        "Phone number does not match verification",
        "Too many verification attempts",
      ].includes(message) || message.includes("E.164")
      ? 400
      : 500;
    return jsonResponse({ error: message }, status);
  }
}

export async function verifyPhoneOtp(
  body: VerifyPhoneOtpBody,
  env: VerifyPhoneOtpEnv,
  fetcher: Fetcher,
) {
  const verificationId = body.verificationId?.trim();
  const code = body.code?.trim();
  const phone = body.phone?.trim();

  if (!verificationId || !phone || !code || !/^\d{4,10}$/.test(code)) {
    throw new Error("Invalid request");
  }

  const phoneE164 = normalizePhoneE164(phone);
  const verification = await getPhoneVerification(env, fetcher, verificationId);
  if (!verification) throw new Error("Verification not found");
  if (verification.phone_e164 !== phoneE164) {
    throw new Error("Phone number does not match verification");
  }
  if (verification.status === "approved") {
    return { ok: true, verified: true, verificationId };
  }
  if (verification.status !== "pending") {
    throw new Error("Verification expired");
  }
  if (
    verification.expires_at && Date.parse(verification.expires_at) < Date.now()
  ) {
    await updatePhoneVerification(env, fetcher, verificationId, {
      status: "expired",
      provider_status: "expired",
      last_error: "expired locally before provider check",
    });
    throw new Error("Verification expired");
  }

  const nextAttemptCount = (verification.attempt_count ?? 0) + 1;
  if (nextAttemptCount > 5) {
    await updatePhoneVerification(env, fetcher, verificationId, {
      status: "failed",
      attempt_count: nextAttemptCount,
      last_error: "too many attempts",
    });
    throw new Error("Too many verification attempts");
  }

  if (env.phoneVerificationTestCode && code === env.phoneVerificationTestCode) {
    await updatePhoneVerification(env, fetcher, verificationId, {
      status: "approved",
      provider_status: "approved_static_test_code",
      attempt_count: nextAttemptCount,
      verified_at: new Date().toISOString(),
      last_error: null,
    });

    return {
      ok: true,
      verified: true,
      verificationId,
      testOverride: true,
    };
  }

  const check = await checkTwilioVerification(env, fetcher, phoneE164, code);
  const approved = check.status === "approved" || check.valid === true;

  await updatePhoneVerification(env, fetcher, verificationId, {
    status: approved ? "approved" : "pending",
    provider_status: check.status,
    attempt_count: nextAttemptCount,
    verified_at: approved ? new Date().toISOString() : null,
    last_error: approved ? null : "invalid verification code",
  });

  if (!approved) throw new Error("Invalid verification code");

  return {
    ok: true,
    verified: true,
    verificationId,
  };
}

async function getPhoneVerification(
  env: VerifyPhoneOtpEnv,
  fetcher: Fetcher,
  verificationId: string,
) {
  const rows = await supabaseRest<PhoneVerificationRecord[]>(
    env,
    fetcher,
    `/rest/v1/phone_verifications?id=eq.${
      encodeURIComponent(verificationId)
    }&select=id,phone_e164,status,attempt_count,expires_at&limit=1`,
  );

  return rows[0] ?? null;
}

async function updatePhoneVerification(
  env: VerifyPhoneOtpEnv,
  fetcher: Fetcher,
  verificationId: string,
  data: Record<string, unknown>,
) {
  await supabaseRest(
    env,
    fetcher,
    `/rest/v1/phone_verifications?id=eq.${encodeURIComponent(verificationId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        ...data,
        updated_at: new Date().toISOString(),
      }),
    },
  );
}

function readEnv(): VerifyPhoneOtpEnv {
  return {
    supabaseUrl: requiredEnv("SUPABASE_URL"),
    supabaseServiceRoleKey: requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    twilioAccountSid: requiredEnv("TWILIO_ACCOUNT_SID"),
    twilioAuthToken: requiredEnv("TWILIO_AUTH_TOKEN"),
    twilioVerifyServiceSid: requiredEnv("TWILIO_VERIFY_SERVICE_SID"),
    twilioVerifyApiBaseUrl: Deno.env.get("TWILIO_VERIFY_API_BASE_URL") ||
      "https://verify.twilio.com/v2",
    phoneVerificationTestCode: Deno.env.get("PHONE_VERIFICATION_TEST_CODE")
      ?.trim() || null,
  };
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}
