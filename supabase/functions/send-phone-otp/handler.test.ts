import { sendPhoneOtp, SendPhoneOtpEnv } from "./handler.ts";

const env: SendPhoneOtpEnv = {
  supabaseUrl: "https://example.supabase.co",
  supabaseServiceRoleKey: "service-role-key",
  twilioAccountSid: "AC123",
  twilioAuthToken: "auth-token",
  twilioVerifyServiceSid: "VA123",
  twilioVerifyApiBaseUrl: "https://verify.example/v2",
};

Deno.test("sendPhoneOtp starts Twilio Verify and records challenge", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  const result = await sendPhoneOtp(
    {
      phone: "+65 9123 4567",
      purpose: "web_invite",
      metadata: { slotId: "slot-1" },
    },
    env,
    createMockFetcher(calls) as typeof fetch,
  );

  if (!result.ok || !result.verificationId) {
    throw new Error("verification id was not returned");
  }

  const twilioCall = calls.find((call) =>
    call.url.includes("/Services/VA123/Verifications")
  );
  if (!twilioCall?.init?.body) {
    throw new Error("Twilio verification was not started");
  }

  const twilioBody = twilioCall.init.body as URLSearchParams;
  if (
    twilioBody.get("To") !== "+6591234567" ||
    twilioBody.get("Channel") !== "sms"
  ) {
    throw new Error("Twilio verification body was incorrect");
  }

  const insert = calls.find((call) =>
    call.url.endsWith("/rest/v1/phone_verifications") &&
    call.init?.method === "POST"
  );
  if (!insert?.init?.body) {
    throw new Error("phone verification row was not inserted");
  }

  const row = JSON.parse(insert.init.body.toString());
  if (
    row.phone_e164 !== "+6591234567" ||
    row.country_code !== "SG" ||
    row.provider_verification_sid !== "VE123" ||
    row.metadata.slotId !== "slot-1"
  ) {
    throw new Error(
      `unexpected phone verification row: ${JSON.stringify(row)}`,
    );
  }
});

Deno.test("sendPhoneOtp rejects unsupported countries before provider call", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  try {
    await sendPhoneOtp(
      { phone: "+1 555 123 4567" },
      env,
      createMockFetcher(calls) as typeof fetch,
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("supports UAE, Turkey, and Singapore")
    ) {
      if (calls.length === 0) return;
      throw new Error("unsupported phone should not call Twilio");
    }
  }

  throw new Error("expected unsupported country error");
});

function createMockFetcher(calls: Array<{ url: string; init?: RequestInit }>) {
  return async (url: string | URL | Request, init?: RequestInit) => {
    const normalizedUrl = typeof url === "string"
      ? url
      : url instanceof URL
      ? url.toString()
      : url.url;
    calls.push({ url: normalizedUrl, init });

    if (normalizedUrl.includes("/Services/VA123/Verifications")) {
      return json({
        sid: "VE123",
        status: "pending",
        to: "+6591234567",
        channel: "sms",
      });
    }

    if (normalizedUrl.endsWith("/rest/v1/phone_verifications")) {
      return json({});
    }

    return new Response("not found", { status: 404 });
  };
}

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
