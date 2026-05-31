import {
  Fetcher,
  SupabaseServiceEnv,
  supabaseRest,
} from "./supabaseRest.ts";

export type SafetyAction = "ok" | "call" | "emergency";
export type SafetyEscalationReason = "emergency" | "missed_checkin";

export interface SafetyEnv extends SupabaseServiceEnv {
  telegramBotToken?: string;
  telegramApiBaseUrl?: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioMessagingServiceSid?: string;
  twilioApiBaseUrl?: string;
  publicSiteUrl?: string;
}

export interface SafetyPackRecord {
  id: string;
  date_id: string;
  status: "draft" | "active" | "paused" | "completed";
  default_checkin_at: string | null;
  grace_minutes: number | null;
  share_message: string | null;
  ok_token: string | null;
  call_token: string | null;
  emergency_token: string | null;
  activated_at: string | null;
  completed_at: string | null;
  reminder_sent_at?: string | null;
  last_checkin_at?: string | null;
  call_requested_at?: string | null;
  escalated_at?: string | null;
  escalation_reason?: SafetyEscalationReason | null;
}

export interface DateRecord {
  id: string;
  user_id: string;
  invite_id: string | null;
  invitee_snapshot: Record<string, unknown>;
  date: string;
  time_bucket: string;
  time_start: string | null;
  time_end: string | null;
  area_label: string;
  venue_text: string | null;
  status: string;
}

interface ProfileRecord {
  id: string;
  display_name: string | null;
  trusted_contacts_phones: unknown;
}

interface TrustedContactRecord {
  phone_e164: string;
  label: string | null;
}

interface TelegramConnectionRecord {
  telegram_chat_id: string;
  telegram_username: string | null;
}

interface TwilioMessageResult {
  sid?: string;
  status?: string;
}

export async function ensureSafetyPackDraft(
  env: SupabaseServiceEnv,
  fetcher: Fetcher,
  dateId: string,
) {
  const existing = await getSafetyPackByDateId(env, fetcher, dateId);
  if (existing) {
    return await ensurePackTokens(env, fetcher, existing);
  }

  await supabaseRest(env, fetcher, "/rest/v1/date_safety_packs", {
    method: "POST",
    body: JSON.stringify({
      date_id: dateId,
      status: "draft",
      grace_minutes: 30,
      ok_token: makeSafetyToken(),
      call_token: makeSafetyToken(),
      emergency_token: makeSafetyToken(),
    }),
  });

  const created = await getSafetyPackByDateId(env, fetcher, dateId);
  if (!created) throw new Error("Safety Pack creation failed");
  return created;
}

export async function activateSafetyPack(
  env: SafetyEnv,
  fetcher: Fetcher,
  input: {
    dateId: string;
    userId: string;
    checkinAt: string;
    graceMinutes: number;
    shareMessage?: string | null;
  },
) {
  const date = await getDateById(env, fetcher, input.dateId);
  if (!date || date.user_id !== input.userId) throw new Error("Forbidden");

  const pack = await ensureSafetyPackDraft(env, fetcher, input.dateId);
  const tokenUpdates = missingTokenUpdates(pack);
  await updateSafetyPack(env, fetcher, pack.id, {
    ...tokenUpdates,
    status: "active",
    default_checkin_at: input.checkinAt,
    grace_minutes: input.graceMinutes,
    share_message: input.shareMessage ?? pack.share_message ?? null,
    activated_at: new Date().toISOString(),
    completed_at: null,
    reminder_sent_at: null,
    last_checkin_at: null,
    call_requested_at: null,
    escalated_at: null,
    escalation_reason: null,
  });

  const updated = await getSafetyPackById(env, fetcher, pack.id);
  if (!updated) throw new Error("Safety Pack activation failed");

  await notifyHostSafetyActivated(env, fetcher, date, updated);
  return { pack: updated, date };
}

export async function handleSafetyAction(
  env: SafetyEnv,
  fetcher: Fetcher,
  input: {
    action: SafetyAction;
    packId?: string;
    token?: string;
    userId?: string;
  },
) {
  const pack = input.packId
    ? await getSafetyPackById(env, fetcher, input.packId)
    : input.token
    ? await getSafetyPackByToken(env, fetcher, input.action, input.token)
    : null;
  if (!pack) throw new Error("Safety Pack not found");

  const date = await getDateById(env, fetcher, pack.date_id);
  if (!date) throw new Error("Date not found");
  if (input.userId && date.user_id !== input.userId) throw new Error("Forbidden");

  if (input.action === "ok") {
    if (pack.status !== "completed") {
      await createCheckinEvent(env, fetcher, pack.id, "ok");
      await updateSafetyPack(env, fetcher, pack.id, {
        status: "completed",
        last_checkin_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      });
    }
    return { ok: true, action: "ok", packId: pack.id, alerted: false };
  }

  if (input.action === "call") {
    if (!pack.call_requested_at) {
      await createCheckinEvent(env, fetcher, pack.id, "call");
      await updateSafetyPack(env, fetcher, pack.id, {
        call_requested_at: new Date().toISOString(),
      });
    }
    return { ok: true, action: "call", packId: pack.id, alerted: false };
  }

  await createCheckinEvent(env, fetcher, pack.id, "emergency");
  const alert = await sendSafetyAlertForPack(env, fetcher, {
    packId: pack.id,
    reason: "emergency",
    userId: input.userId,
  });

  return { ok: true, action: "emergency", packId: pack.id, alerted: true, alert };
}

export async function sendSafetyAlertForPack(
  env: SafetyEnv,
  fetcher: Fetcher,
  input: {
    packId: string;
    reason: SafetyEscalationReason;
    userId?: string;
  },
) {
  const pack = await getSafetyPackById(env, fetcher, input.packId);
  if (!pack) throw new Error("Safety Pack not found");
  const date = await getDateById(env, fetcher, pack.date_id);
  if (!date) throw new Error("Date not found");
  if (input.userId && date.user_id !== input.userId) throw new Error("Forbidden");

  if (pack.escalated_at) {
    return { sent: 0, failed: 0, skipped: true, reason: "already_escalated" };
  }

  const profile = await getProfile(env, fetcher, date.user_id);
  const trustedContacts = await getTrustedContactsSafely(
    env,
    fetcher,
    date.user_id,
  );
  const phones = trustedContacts.length > 0
    ? trustedContacts.map((contact) => contact.phone_e164)
    : parseTrustedContactPhones(profile?.trusted_contacts_phones);
  const body = buildTrustedContactAlert(profile, date, input.reason);

  let sent = 0;
  let failed = 0;

  for (const phone of phones) {
    try {
      const result = await sendTwilioSms(env, fetcher, phone, body);
      sent += 1;
      await logNotification(env, fetcher, {
        userId: date.user_id,
        phone,
        type: `safety_${input.reason}`,
        status: "sent",
        providerMessageId: result.sid ?? null,
        payload: {
          pack_id: pack.id,
          date_id: date.id,
          reason: input.reason,
          twilio_status: result.status ?? null,
        },
      });
    } catch (error) {
      failed += 1;
      await logNotification(env, fetcher, {
        userId: date.user_id,
        phone,
        type: `safety_${input.reason}`,
        status: "failed",
        providerMessageId: null,
        payload: {
          pack_id: pack.id,
          date_id: date.id,
          reason: input.reason,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  }

  await updateSafetyPack(env, fetcher, pack.id, {
    escalated_at: new Date().toISOString(),
    escalation_reason: input.reason,
  });

  return { sent, failed, skipped: false };
}

export async function processSafetyCheckins(
  env: SafetyEnv,
  fetcher: Fetcher,
  now = new Date(),
) {
  const packs = await supabaseRest<SafetyPackRecord[]>(
    env,
    fetcher,
    "/rest/v1/date_safety_packs?status=eq.active&default_checkin_at=not.is.null&select=*&order=default_checkin_at.asc&limit=100",
  );

  let remindersSent = 0;
  let escalationsSent = 0;

  for (const pack of packs) {
    if (!pack.default_checkin_at) continue;
    const checkinAt = new Date(pack.default_checkin_at);
    const graceMinutes = pack.grace_minutes ?? 30;
    const escalationAt = new Date(checkinAt.getTime() + graceMinutes * 60_000);

    if (!pack.reminder_sent_at && checkinAt <= now) {
      const date = await getDateById(env, fetcher, pack.date_id);
      if (date) {
        await sendSafetyCheckinPrompt(env, fetcher, date, pack);
        await updateSafetyPack(env, fetcher, pack.id, {
          reminder_sent_at: now.toISOString(),
        });
        remindersSent += 1;
      }
    }

    if (
      !pack.escalated_at &&
      !pack.last_checkin_at &&
      escalationAt <= now
    ) {
      const result = await sendSafetyAlertForPack(env, fetcher, {
        packId: pack.id,
        reason: "missed_checkin",
      });
      if (!result.skipped) escalationsSent += result.sent;
    }
  }

  return { ok: true, remindersSent, escalationsSent, scanned: packs.length };
}

export function safetyActionKeyboard(packId: string) {
  return {
    inline_keyboard: [
      [
        { text: "All good", callback_data: `safety_ok:${packId}` },
        { text: "Call me", callback_data: `safety_call:${packId}` },
      ],
      [{ text: "Emergency", callback_data: `safety_emergency:${packId}` }],
    ],
  };
}

export async function getSafetyPackByDateId(
  env: SupabaseServiceEnv,
  fetcher: Fetcher,
  dateId: string,
) {
  const rows = await supabaseRest<SafetyPackRecord[]>(
    env,
    fetcher,
    `/rest/v1/date_safety_packs?date_id=eq.${
      encodeURIComponent(dateId)
    }&select=*&limit=1`,
  );

  return rows[0] ?? null;
}

export async function getSafetyPackById(
  env: SupabaseServiceEnv,
  fetcher: Fetcher,
  packId: string,
) {
  const rows = await supabaseRest<SafetyPackRecord[]>(
    env,
    fetcher,
    `/rest/v1/date_safety_packs?id=eq.${
      encodeURIComponent(packId)
    }&select=*&limit=1`,
  );

  return rows[0] ?? null;
}

async function getSafetyPackByToken(
  env: SupabaseServiceEnv,
  fetcher: Fetcher,
  action: SafetyAction,
  token: string,
) {
  const column = action === "ok"
    ? "ok_token"
    : action === "call"
    ? "call_token"
    : "emergency_token";
  const rows = await supabaseRest<SafetyPackRecord[]>(
    env,
    fetcher,
    `/rest/v1/date_safety_packs?${column}=eq.${
      encodeURIComponent(token)
    }&select=*&limit=1`,
  );

  return rows[0] ?? null;
}

export async function getDateById(
  env: SupabaseServiceEnv,
  fetcher: Fetcher,
  dateId: string,
) {
  const rows = await supabaseRest<DateRecord[]>(
    env,
    fetcher,
    `/rest/v1/dates?id=eq.${encodeURIComponent(dateId)}&select=*`,
  );

  return rows[0] ?? null;
}

async function ensurePackTokens(
  env: SupabaseServiceEnv,
  fetcher: Fetcher,
  pack: SafetyPackRecord,
) {
  const updates = missingTokenUpdates(pack);
  if (Object.keys(updates).length === 0) return pack;

  await updateSafetyPack(env, fetcher, pack.id, updates);
  const updated = await getSafetyPackById(env, fetcher, pack.id);
  if (!updated) throw new Error("Safety Pack token update failed");
  return updated;
}

function missingTokenUpdates(pack: SafetyPackRecord) {
  return {
    ...(pack.ok_token ? {} : { ok_token: makeSafetyToken() }),
    ...(pack.call_token ? {} : { call_token: makeSafetyToken() }),
    ...(pack.emergency_token ? {} : { emergency_token: makeSafetyToken() }),
  };
}

async function updateSafetyPack(
  env: SupabaseServiceEnv,
  fetcher: Fetcher,
  packId: string,
  data: Record<string, unknown>,
) {
  await supabaseRest(
    env,
    fetcher,
    `/rest/v1/date_safety_packs?id=eq.${encodeURIComponent(packId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        ...data,
        updated_at: new Date().toISOString(),
      }),
    },
  );
}

async function createCheckinEvent(
  env: SupabaseServiceEnv,
  fetcher: Fetcher,
  packId: string,
  kind: SafetyAction,
) {
  await supabaseRest(env, fetcher, "/rest/v1/checkin_events", {
    method: "POST",
    body: JSON.stringify({
      pack_id: packId,
      kind,
    }),
  });
}

async function getProfile(
  env: SupabaseServiceEnv,
  fetcher: Fetcher,
  userId: string,
) {
  const rows = await supabaseRest<ProfileRecord[]>(
    env,
    fetcher,
    `/rest/v1/profiles?id=eq.${
      encodeURIComponent(userId)
    }&select=id,display_name,trusted_contacts_phones&limit=1`,
  );

  return rows[0] ?? null;
}

async function getTrustedContacts(
  env: SupabaseServiceEnv,
  fetcher: Fetcher,
  userId: string,
) {
  const rows = await supabaseRest<TrustedContactRecord[]>(
    env,
    fetcher,
    `/rest/v1/trusted_contacts?user_id=eq.${
      encodeURIComponent(userId)
    }&is_active=eq.true&select=phone_e164,label&order=sort_order.asc`,
  );

  return rows.filter((row) => row.phone_e164);
}

async function getTrustedContactsSafely(
  env: SupabaseServiceEnv,
  fetcher: Fetcher,
  userId: string,
) {
  try {
    return await getTrustedContacts(env, fetcher, userId);
  } catch (error) {
    console.warn(
      "trusted_contacts lookup failed; falling back to legacy profile contacts",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

async function getHostTelegramConnection(
  env: SupabaseServiceEnv,
  fetcher: Fetcher,
  userId: string,
) {
  const rows = await supabaseRest<TelegramConnectionRecord[]>(
    env,
    fetcher,
    `/rest/v1/telegram_connections?user_id=eq.${
      encodeURIComponent(userId)
    }&is_active=eq.true&select=telegram_chat_id,telegram_username&order=updated_at.desc&limit=1`,
  );

  return rows[0] ?? null;
}

async function notifyHostSafetyActivated(
  env: SafetyEnv,
  fetcher: Fetcher,
  date: DateRecord,
  pack: SafetyPackRecord,
) {
  const connection = await getHostTelegramConnection(env, fetcher, date.user_id);
  if (!connection || !env.telegramBotToken) return;

  await sendTelegramMessage(
    env,
    fetcher,
    connection.telegram_chat_id,
    [
      "Safety Pack is active.",
      "",
      `Check-in: ${formatDateTime(pack.default_checkin_at)}`,
      `Date: ${formatDateLine(date)}`,
      "",
      "I'll send the check-in buttons here when it is time.",
    ].join("\n"),
  );
}

async function sendSafetyCheckinPrompt(
  env: SafetyEnv,
  fetcher: Fetcher,
  date: DateRecord,
  pack: SafetyPackRecord,
) {
  const connection = await getHostTelegramConnection(env, fetcher, date.user_id);
  if (!connection || !env.telegramBotToken) return;

  await sendTelegramMessage(
    env,
    fetcher,
    connection.telegram_chat_id,
    [
      "Safety check-in",
      "",
      formatDateLine(date),
      "",
      "Tap All good to complete your Safety Pack, or Emergency if your trusted contact should be alerted now.",
    ].join("\n"),
    safetyActionKeyboard(pack.id),
  );
}

async function sendTelegramMessage(
  env: SafetyEnv,
  fetcher: Fetcher,
  chatId: string,
  text: string,
  replyMarkup?: Record<string, unknown>,
) {
  if (!env.telegramBotToken) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  const response = await fetcher(
    `${
      (env.telegramApiBaseUrl || "https://api.telegram.org").replace(/\/+$/, "")
    }/bot${env.telegramBotToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Telegram sendMessage failed: ${response.status} ${await response.text()}`,
    );
  }
}

async function sendTwilioSms(
  env: SafetyEnv,
  fetcher: Fetcher,
  to: string,
  body: string,
) {
  if (!env.twilioAccountSid || !env.twilioAuthToken || !env.twilioMessagingServiceSid) {
    throw new Error("Twilio Messaging is not configured");
  }

  const response = await fetcher(
    `${
      (env.twilioApiBaseUrl || "https://api.twilio.com/2010-04-01").replace(/\/+$/, "")
    }/Accounts/${encodeURIComponent(env.twilioAccountSid)}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${env.twilioAccountSid}:${env.twilioAuthToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formBody({
        To: to,
        MessagingServiceSid: env.twilioMessagingServiceSid,
        Body: body,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Twilio Messaging failed: ${response.status} ${await response.text()}`,
    );
  }

  return await response.json() as TwilioMessageResult;
}

async function logNotification(
  env: SupabaseServiceEnv,
  fetcher: Fetcher,
  data: {
    userId: string;
    phone: string;
    type: string;
    status: "sent" | "failed";
    providerMessageId: string | null;
    payload: Record<string, unknown>;
  },
) {
  await supabaseRest(env, fetcher, "/rest/v1/notification_log", {
    method: "POST",
    body: JSON.stringify({
      user_id: data.userId,
      phone_e164: data.phone,
      channel: "sms",
      type: data.type,
      payload_json: data.payload,
      provider_message_id: data.providerMessageId,
      status: data.status,
    }),
  });
}

function buildTrustedContactAlert(
  profile: ProfileRecord | null,
  date: DateRecord,
  reason: SafetyEscalationReason,
) {
  const hostName = profile?.display_name || "Your contact";
  const invitee = inviteeName(date);
  const reasonText = reason === "emergency"
    ? "sent an emergency alert"
    : "missed their Safety Pack check-in";

  return [
    `uInvite.Me Safety Alert: ${hostName} ${reasonText}.`,
    `Date: ${formatDateLine(date)}`,
    invitee ? `Meeting: ${invitee}` : null,
    "Please try to reach them now.",
  ].filter(Boolean).join("\n");
}

function parseTrustedContactPhones(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        return typeof record.phone_e164 === "string"
          ? record.phone_e164
          : typeof record.phone === "string"
          ? record.phone
          : null;
      }
      return null;
    })
    .filter((phone): phone is string => Boolean(phone))
    .map((phone) => phone.trim())
    .filter(Boolean);
}

function inviteeName(date: DateRecord) {
  const name = date.invitee_snapshot?.name;
  return typeof name === "string" ? name : null;
}

function formatDateLine(date: DateRecord) {
  return `${formatDate(date.date)}, ${timeBucketLabel(date.time_bucket)} near ${
    date.venue_text || date.area_label
  }`;
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: string | null) {
  if (!value) return "not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function timeBucketLabel(value: string) {
  const labels: Record<string, string> = {
    morning: "morning",
    afternoon: "afternoon",
    early_evening: "early evening",
    late_evening: "late evening",
  };

  return labels[value] ?? value.replace(/_/g, " ");
}

function makeSafetyToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function formBody(values: Record<string, string>) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    body.set(key, value);
  }
  return body;
}
