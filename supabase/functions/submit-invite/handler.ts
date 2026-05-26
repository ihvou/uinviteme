import { CORS_HEADERS, jsonResponse } from "../_shared/http.ts";
import { normalizePhoneE164 } from "../_shared/phone.ts";
import {
  Fetcher,
  supabaseRest,
  SupabaseServiceEnv,
} from "../_shared/supabaseRest.ts";

type PhoneVerificationMode = "mock" | "twilio";
type TelegramParseMode = "HTML";

export interface SubmitInviteEnv extends SupabaseServiceEnv {
  phoneVerificationMode: PhoneVerificationMode;
  mockPhoneCode: string;
  telegramBotToken: string | null;
  telegramApiBaseUrl: string;
}

interface SubmitInviteBody {
  scheduleId?: string;
  inviteLinkId?: string;
  slotId?: string;
  targetDate?: string;
  inviteeData?: {
    name?: string;
    phone_e164?: string;
    email?: string;
    instagram_handle?: string;
    telegram_username?: string;
  };
  answers?: Record<string, unknown>;
  inviteeNote?: string;
  phoneVerificationId?: string;
  phoneVerificationCode?: string;
}

interface InviteLinkRecord {
  id: string;
  schedule_id: string;
  expires_at: string | null;
  used_at: string | null;
}

interface ScheduleRecord {
  id: string;
  user_id: string;
  is_active: boolean | null;
}

interface ProfileRecord {
  id: string;
  public_profile_enabled: boolean | null;
}

interface SlotRecord {
  id: string;
  schedule_id: string;
  is_active: boolean | null;
  weekday: number | null;
  time_bucket: string | null;
  area_label: string | null;
}

interface ScreeningConfigRecord {
  require_phone: boolean | null;
  require_instagram: boolean | null;
  require_telegram: boolean | null;
}

interface InviteeIdRecord {
  id: string;
}

interface InviteIdRecord {
  id: string;
}

interface PhoneVerificationRecord {
  id: string;
  phone_e164: string;
  status: "pending" | "approved" | "failed" | "expired" | "canceled";
  expires_at: string | null;
}

interface HostTelegramConnectionRecord {
  telegram_chat_id: string;
  telegram_username: string | null;
}

export async function handleSubmitInviteRequest(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let env: SubmitInviteEnv;

  try {
    env = readEnv();
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : "Configuration error",
    }, 500);
  }

  try {
    const body = await req.json() as SubmitInviteBody;
    const result = await submitInvite(body, env, fetch);
    return jsonResponse(result);
  } catch (error) {
    console.error("submit-invite failed", error);
    const message = error instanceof Error
      ? error.message
      : "Invite submission failed";
    return jsonResponse({ error: message }, statusForError(message));
  }
}

export async function submitInvite(
  body: SubmitInviteBody,
  env: SubmitInviteEnv,
  fetcher: Fetcher,
) {
  const slotId = body.slotId?.trim();
  const targetDate = body.targetDate?.trim();
  const name = body.inviteeData?.name?.trim();

  if (
    !slotId || !targetDate || !name || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)
  ) {
    throw new Error("Invalid request");
  }

  const inviteLink = await resolveInviteLink(body, env, fetcher);
  const scheduleId = inviteLink?.schedule_id ?? body.scheduleId?.trim();
  if (!scheduleId) throw new Error("Invalid request");

  const [schedule, slot, screeningConfig] = await Promise.all([
    getOne<ScheduleRecord>(
      env,
      fetcher,
      `/rest/v1/schedules?id=eq.${
        encodeURIComponent(scheduleId)
      }&select=id,user_id,is_active`,
    ),
    getOne<SlotRecord>(
      env,
      fetcher,
      `/rest/v1/slots?id=eq.${
        encodeURIComponent(slotId)
      }&select=id,schedule_id,is_active,weekday,time_bucket,area_label`,
    ),
    getOne<ScreeningConfigRecord>(
      env,
      fetcher,
      `/rest/v1/screening_configs?schedule_id=eq.${
        encodeURIComponent(scheduleId)
      }&select=require_phone,require_instagram,require_telegram&limit=1`,
    ),
  ]);

  if (!schedule || !schedule.is_active) {
    throw new Error("Invite page is not accepting invites");
  }
  if (!slot || slot.schedule_id !== schedule.id || !slot.is_active) {
    throw new Error("Invite option is not available");
  }

  if (!inviteLink) {
    const profile = await getOne<ProfileRecord>(
      env,
      fetcher,
      `/rest/v1/profiles?id=eq.${
        encodeURIComponent(schedule.user_id)
      }&select=id,public_profile_enabled`,
    );
    if (!profile?.public_profile_enabled) {
      throw new Error("Invite page is not accepting invites");
    }
  }

  const phoneResult = await verifyPhoneIfNeeded(
    body,
    screeningConfig,
    env,
    fetcher,
  );

  validateRequiredSocials(body, screeningConfig);

  if (phoneResult.phoneE164 && phoneResult.verified) {
    await assertNoPendingInviteForPhone(
      env,
      fetcher,
      schedule.id,
      phoneResult.phoneE164,
    );
  }

  const inviteeId = crypto.randomUUID();
  const inviteId = crypto.randomUUID();

  await supabaseRest(env, fetcher, "/rest/v1/invitees", {
    method: "POST",
    body: JSON.stringify({
      id: inviteeId,
      name,
      phone_e164: phoneResult.phoneE164,
      phone_verified: phoneResult.verified,
      email: optionalText(body.inviteeData?.email),
      instagram_handle: optionalText(body.inviteeData?.instagram_handle),
      telegram_username: optionalText(body.inviteeData?.telegram_username),
    }),
  });

  try {
    await supabaseRest(env, fetcher, "/rest/v1/invites", {
      method: "POST",
      body: JSON.stringify({
        id: inviteId,
        schedule_id: schedule.id,
        slot_id: slot.id,
        invite_link_id: inviteLink?.id ?? null,
        invitee_id: inviteeId,
        target_date: targetDate,
        answers: body.answers ?? {},
        invitee_note: optionalText(body.inviteeNote),
        status: "pending",
      }),
    });
  } catch (error) {
    await supabaseRest(
      env,
      fetcher,
      `/rest/v1/invitees?id=eq.${encodeURIComponent(inviteeId)}`,
      { method: "DELETE" },
    ).catch(() => null);
    throw error;
  }

  const hostNotification = await notifyHostIfLinked(env, fetcher, {
    inviteId,
    inviteeName: name,
    inviteePhone: phoneResult.phoneE164,
    inviteeInstagram: optionalText(body.inviteeData?.instagram_handle),
    inviteeTelegram: optionalText(body.inviteeData?.telegram_username),
    inviteeNote: optionalText(body.inviteeNote),
    schedule,
    slot,
    targetDate,
  });

  return {
    ok: true,
    success: true,
    inviteId,
    inviteeId,
    hostNotification,
  };
}

async function resolveInviteLink(
  body: SubmitInviteBody,
  env: SubmitInviteEnv,
  fetcher: Fetcher,
) {
  const inviteLinkId = body.inviteLinkId?.trim();
  if (!inviteLinkId) return null;

  const inviteLink = await getOne<InviteLinkRecord>(
    env,
    fetcher,
    `/rest/v1/invite_links?id=eq.${
      encodeURIComponent(inviteLinkId)
    }&select=id,schedule_id,expires_at,used_at`,
  );

  if (!inviteLink) throw new Error("Invite link not found");
  if (inviteLink.used_at) throw new Error("Invite link already used");
  if (inviteLink.expires_at && Date.parse(inviteLink.expires_at) < Date.now()) {
    throw new Error("Invite link expired");
  }

  return inviteLink;
}

async function verifyPhoneIfNeeded(
  body: SubmitInviteBody,
  screeningConfig: ScreeningConfigRecord | null,
  env: SubmitInviteEnv,
  fetcher: Fetcher,
) {
  const rawPhone = body.inviteeData?.phone_e164?.trim();
  const phoneE164 = rawPhone ? normalizePhoneE164(rawPhone) : null;
  const requiresPhone = screeningConfig?.require_phone === true;
  const hasVerificationInput = Boolean(
    body.phoneVerificationId?.trim() || body.phoneVerificationCode?.trim(),
  );

  if (requiresPhone && !phoneE164) {
    throw new Error("Phone number is required");
  }

  if (!phoneE164) return { phoneE164: null, verified: false };

  if (!requiresPhone && !hasVerificationInput) {
    return { phoneE164, verified: false };
  }

  if (env.phoneVerificationMode === "twilio") {
    await assertApprovedPhoneVerification(body, env, fetcher, phoneE164);
    return { phoneE164, verified: true };
  }

  if (body.phoneVerificationCode?.trim() !== env.mockPhoneCode) {
    throw new Error("Invalid verification code");
  }

  return { phoneE164, verified: true };
}

async function assertApprovedPhoneVerification(
  body: SubmitInviteBody,
  env: SubmitInviteEnv,
  fetcher: Fetcher,
  phoneE164: string,
) {
  const verificationId = body.phoneVerificationId?.trim();
  if (!verificationId) throw new Error("Phone verification is required");

  const verification = await getOne<PhoneVerificationRecord>(
    env,
    fetcher,
    `/rest/v1/phone_verifications?id=eq.${
      encodeURIComponent(verificationId)
    }&select=id,phone_e164,status,expires_at&limit=1`,
  );

  if (!verification) throw new Error("Phone verification not found");
  if (verification.phone_e164 !== phoneE164) {
    throw new Error("Phone number does not match verification");
  }
  if (verification.status !== "approved") {
    throw new Error("Phone verification is not approved");
  }
  if (
    verification.expires_at && Date.parse(verification.expires_at) < Date.now()
  ) {
    throw new Error("Phone verification expired");
  }
}

function validateRequiredSocials(
  body: SubmitInviteBody,
  screeningConfig: ScreeningConfigRecord | null,
) {
  if (
    screeningConfig?.require_instagram &&
    !body.inviteeData?.instagram_handle?.trim()
  ) {
    throw new Error("Instagram handle is required");
  }

  if (
    screeningConfig?.require_telegram &&
    !body.inviteeData?.telegram_username?.trim()
  ) {
    throw new Error("Telegram username is required");
  }
}

async function assertNoPendingInviteForPhone(
  env: SubmitInviteEnv,
  fetcher: Fetcher,
  scheduleId: string,
  phoneE164: string,
) {
  const invitees = await supabaseRest<InviteeIdRecord[]>(
    env,
    fetcher,
    `/rest/v1/invitees?phone_e164=eq.${
      encodeURIComponent(phoneE164)
    }&select=id&limit=50`,
  );

  if (invitees.length === 0) return;

  const inviteeIds = invitees.map((invitee) => invitee.id).join(",");
  const pendingInvites = await supabaseRest<InviteIdRecord[]>(
    env,
    fetcher,
    `/rest/v1/invites?schedule_id=eq.${
      encodeURIComponent(scheduleId)
    }&status=eq.pending&invitee_id=in.(${inviteeIds})&select=id&limit=1`,
  );

  if (pendingInvites.length > 0) {
    throw new Error("You already have a pending invite for this host");
  }
}

async function getOne<T>(
  env: SubmitInviteEnv,
  fetcher: Fetcher,
  path: string,
) {
  const rows = await supabaseRest<T[]>(env, fetcher, path);
  return rows[0] ?? null;
}

function optionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function readEnv(): SubmitInviteEnv {
  return {
    supabaseUrl: requiredEnv("SUPABASE_URL"),
    supabaseServiceRoleKey: requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    phoneVerificationMode: parsePhoneVerificationMode(
      Deno.env.get("PHONE_VERIFICATION_MODE"),
    ),
    mockPhoneCode: Deno.env.get("MOCK_PHONE_CODE")?.trim() || "123456",
    telegramBotToken: Deno.env.get("TELEGRAM_BOT_TOKEN")?.trim() || null,
    telegramApiBaseUrl: Deno.env.get("TELEGRAM_API_BASE_URL") ||
      "https://api.telegram.org",
  };
}

async function notifyHostIfLinked(
  env: SubmitInviteEnv,
  fetcher: Fetcher,
  data: {
    inviteId: string;
    inviteeName: string;
    inviteePhone: string | null;
    inviteeInstagram: string | null;
    inviteeTelegram: string | null;
    inviteeNote: string | null;
    schedule: ScheduleRecord;
    slot: SlotRecord;
    targetDate: string;
  },
) {
  if (!env.telegramBotToken) {
    return { attempted: false, reason: "telegram_not_configured" };
  }

  const connection = await getOne<HostTelegramConnectionRecord>(
    env,
    fetcher,
    `/rest/v1/telegram_connections?user_id=eq.${
      encodeURIComponent(data.schedule.user_id)
    }&is_active=eq.true&select=telegram_chat_id,telegram_username&order=updated_at.desc&limit=1`,
  );

  if (!connection) return { attempted: false, reason: "host_not_linked" };

  try {
    await sendTelegramMessage(
      env,
      fetcher,
      connection.telegram_chat_id,
      formatHostInviteNotification(data),
      hostInviteDecisionKeyboard(data.inviteId),
      "HTML",
    );

    return { attempted: true, sent: true };
  } catch (error) {
    return {
      attempted: true,
      sent: false,
      error: error instanceof Error ? error.message : "Telegram send failed",
    };
  }
}

async function sendTelegramMessage(
  env: SubmitInviteEnv,
  fetcher: Fetcher,
  chatId: string,
  text: string,
  replyMarkup?: Record<string, unknown>,
  parseMode?: TelegramParseMode,
) {
  const response = await fetcher(
    `${
      env.telegramApiBaseUrl.replace(/\/+$/, "")
    }/bot${env.telegramBotToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
        ...(parseMode ? { parse_mode: parseMode } : {}),
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Telegram sendMessage failed: ${response.status} ${await response
        .text()}`,
    );
  }
}

function formatHostInviteNotification(data: {
  inviteeName: string;
  inviteePhone: string | null;
  inviteeInstagram: string | null;
  inviteeTelegram: string | null;
  inviteeNote: string | null;
  slot: SlotRecord;
  targetDate: string;
}) {
  const contacts = [
    data.inviteePhone ? `Phone: ${escapeHtml(data.inviteePhone)}` : null,
    data.inviteeInstagram
      ? `Instagram: ${instagramHtmlLink(data.inviteeInstagram)}`
      : null,
    data.inviteeTelegram
      ? `Telegram: @${escapeHtml(normalizeSocialHandle(data.inviteeTelegram))}`
      : null,
  ].filter(Boolean);

  return [
    `New invite from ${escapeHtml(data.inviteeName)}`,
    `When: ${escapeHtml(data.targetDate)}, ${
      escapeHtml(timeBucketLabel(data.slot.time_bucket))
    }`,
    `Where: ${escapeHtml(data.slot.area_label || "Area TBD")}`,
    contacts.length > 0 ? contacts.join("\n") : null,
    data.inviteeNote ? `Note: ${escapeHtml(data.inviteeNote)}` : null,
    "",
    "Review it here or use the buttons below.",
  ].filter((line) => line !== null).join("\n");
}

function normalizeSocialHandle(value: string) {
  return value.trim().replace(/^@+/, "");
}

function instagramHtmlLink(value: string) {
  const handle = normalizeSocialHandle(value);
  const url = `https://instagram.com/${encodeURIComponent(handle)}`;
  return `<a href="${url}">@${escapeHtml(handle)}</a>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function hostInviteDecisionKeyboard(inviteId: string) {
  return {
    inline_keyboard: [[
      { text: "Accept", callback_data: `host_accept:${inviteId}` },
      { text: "Decline", callback_data: `host_decline:${inviteId}` },
    ]],
  };
}

function timeBucketLabel(value: string | null) {
  const labels: Record<string, string> = {
    morning: "morning",
    afternoon: "afternoon",
    early_evening: "early evening",
    late_evening: "late evening",
    evening: "evening",
    night: "night",
  };

  return value ? labels[value] ?? value.replace(/_/g, " ") : "time TBD";
}

function parsePhoneVerificationMode(
  value: string | undefined,
): PhoneVerificationMode {
  return value?.trim().toLowerCase() === "twilio" ? "twilio" : "mock";
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function statusForError(message: string) {
  if (
    [
      "Invalid request",
      "Invalid verification code",
      "Phone number is required",
      "Phone verification is required",
      "Phone verification not found",
      "Phone number does not match verification",
      "Phone verification is not approved",
      "Phone verification expired",
      "Instagram handle is required",
      "Telegram username is required",
      "Invite option is not available",
      "Invite link already used",
      "Invite link expired",
      "Invite link not found",
      "You already have a pending invite for this host",
    ].includes(message) || message.includes("E.164")
  ) {
    return 400;
  }

  if (message === "Invite page is not accepting invites") return 404;
  return 500;
}
