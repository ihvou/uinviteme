import { verifyPhoneOtp, VerifyPhoneOtpEnv } from "./handler.ts";

const env: VerifyPhoneOtpEnv = {
  supabaseUrl: "https://example.supabase.co",
  supabaseServiceRoleKey: "service-role-key",
  twilioAccountSid: "AC123",
  twilioAuthToken: "auth-token",
  twilioVerifyServiceSid: "VA123",
  twilioVerifyApiBaseUrl: "https://verify.example/v2",
};

Deno.test("verifyPhoneOtp approves Twilio checks and updates challenge", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  const result = await verifyPhoneOtp(
    {
      verificationId: "11111111-1111-4111-8111-111111111111",
      phone: "+65 9123 4567",
      code: "123456",
    },
    env,
    createMockFetcher(calls, { approved: true }) as typeof fetch,
  );

  if (!result.verified) {
    throw new Error("phone was not verified");
  }

  const twilioCall = calls.find((call) =>
    call.url.includes("/Services/VA123/VerificationCheck")
  );
  if (!twilioCall?.init?.body) {
    throw new Error("Twilio verification check was not called");
  }

  const twilioBody = twilioCall.init.body as URLSearchParams;
  if (
    twilioBody.get("To") !== "+6591234567" ||
    twilioBody.get("Code") !== "123456"
  ) {
    throw new Error("Twilio verification check body was incorrect");
  }

  const patch = calls.find((call) =>
    call.url.includes("/rest/v1/phone_verifications?id=eq.") &&
    call.init?.method === "PATCH"
  );
  if (!patch?.init?.body) {
    throw new Error("phone verification row was not updated");
  }

  const row = JSON.parse(patch.init.body.toString());
  if (row.status !== "approved" || !row.verified_at) {
    throw new Error(`unexpected verification patch: ${JSON.stringify(row)}`);
  }
});

Deno.test("verifyPhoneOtp rejects invalid Twilio checks", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  try {
    await verifyPhoneOtp(
      {
        verificationId: "11111111-1111-4111-8111-111111111111",
        phone: "+65 9123 4567",
        code: "999999",
      },
      env,
      createMockFetcher(calls, { approved: false }) as typeof fetch,
    );
  } catch (error) {
    if (
      error instanceof Error && error.message === "Invalid verification code"
    ) {
      const patch = calls.find((call) =>
        call.url.includes("/rest/v1/phone_verifications?id=eq.") &&
        call.init?.method === "PATCH"
      );
      const row = JSON.parse(patch?.init?.body?.toString() || "{}");
      if (row.status === "pending" && row.attempt_count === 1) return;
    }
  }

  throw new Error("expected invalid code error");
});

Deno.test("verifyPhoneOtp rejects expired local challenges before provider call", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  try {
    await verifyPhoneOtp(
      {
        verificationId: "11111111-1111-4111-8111-111111111111",
        phone: "+65 9123 4567",
        code: "123456",
      },
      env,
      createMockFetcher(calls, {
        approved: true,
        expired: true,
      }) as typeof fetch,
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Verification expired") {
      if (!calls.some((call) => call.url.includes("/VerificationCheck"))) {
        return;
      }
    }
  }

  throw new Error("expected expired verification error");
});

function createMockFetcher(
  calls: Array<{ url: string; init?: RequestInit }>,
  options: { approved: boolean; expired?: boolean },
) {
  return async (url: string | URL | Request, init?: RequestInit) => {
    const normalizedUrl = typeof url === "string"
      ? url
      : url instanceof URL
      ? url.toString()
      : url.url;
    calls.push({ url: normalizedUrl, init });

    if (
      normalizedUrl.includes("/rest/v1/phone_verifications?id=eq.") &&
      init?.method !== "PATCH"
    ) {
      return json([{
        id: "11111111-1111-4111-8111-111111111111",
        phone_e164: "+6591234567",
        status: "pending",
        attempt_count: 0,
        expires_at: options.expired
          ? "2026-01-01T00:00:00.000Z"
          : "2999-01-01T00:00:00.000Z",
      }]);
    }

    if (
      normalizedUrl.includes("/rest/v1/phone_verifications?id=eq.") &&
      init?.method === "PATCH"
    ) {
      return json({});
    }

    if (normalizedUrl.includes("/Services/VA123/VerificationCheck")) {
      return json({
        sid: "VE123",
        status: options.approved ? "approved" : "pending",
        valid: options.approved,
        to: "+6591234567",
      });
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
