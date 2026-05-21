import { Fetcher } from "./supabaseRest.ts";

export interface TwilioVerifyEnv {
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioVerifyServiceSid: string;
  twilioVerifyApiBaseUrl: string;
}

export interface TwilioVerification {
  sid: string;
  status: string;
  to?: string;
  channel?: string;
}

export interface TwilioVerificationCheck {
  sid: string;
  status: string;
  valid?: boolean;
  to?: string;
}

export async function startTwilioVerification(
  env: TwilioVerifyEnv,
  fetcher: Fetcher,
  phoneE164: string,
) {
  const response = await fetcher(
    `${twilioVerifyBaseUrl(env)}/Services/${
      encodeURIComponent(env.twilioVerifyServiceSid)
    }/Verifications`,
    {
      method: "POST",
      headers: twilioHeaders(env),
      body: formBody({
        To: phoneE164,
        Channel: "sms",
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Twilio Verify start failed: ${response.status} ${await response.text()}`,
    );
  }

  return await response.json() as TwilioVerification;
}

export async function checkTwilioVerification(
  env: TwilioVerifyEnv,
  fetcher: Fetcher,
  phoneE164: string,
  code: string,
) {
  const response = await fetcher(
    `${twilioVerifyBaseUrl(env)}/Services/${
      encodeURIComponent(env.twilioVerifyServiceSid)
    }/VerificationCheck`,
    {
      method: "POST",
      headers: twilioHeaders(env),
      body: formBody({
        To: phoneE164,
        Code: code,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Twilio Verify check failed: ${response.status} ${await response.text()}`,
    );
  }

  return await response.json() as TwilioVerificationCheck;
}

function twilioVerifyBaseUrl(env: TwilioVerifyEnv) {
  return env.twilioVerifyApiBaseUrl.replace(/\/+$/, "");
}

function twilioHeaders(env: TwilioVerifyEnv) {
  return {
    Authorization: `Basic ${
      btoa(`${env.twilioAccountSid}:${env.twilioAuthToken}`)
    }`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
}

function formBody(values: Record<string, string>) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    body.set(key, value);
  }

  return body;
}
