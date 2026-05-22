const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Fetcher = typeof fetch;
type Decision = "accepted" | "declined";

export interface AcceptInviteEnv {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  telegramBotToken: string;
  telegramApiBaseUrl: string;
}

interface InviteRecord {
  id: string;
  schedule_id: string;
  slot_id: string;
  invitee_id: string;
  target_date: string;
  status: Decision | "pending";
}

interface ScheduleRecord {
  id: string;
  user_id: string;
}

interface SlotRecord {
  id: string;
  time_bucket: string;
  time_start: string | null;
  time_end: string | null;
  area_label: string;
  area_place_id: string | null;
  format: string | null;
  intent_tag: string | null;
  vibe_tags: string[] | null;
  boundary_tags: string[] | null;
  pay_pref: string | null;
}

interface InviteeRecord {
  id: string;
  name: string;
  phone_e164: string | null;
  email: string | null;
  instagram_handle: string | null;
  telegram_username: string | null;
}

interface ProfileRecord {
  id: string;
  display_name: string | null;
  instagram_handle: string | null;
  accepted_contact_channel: string | null;
}

interface DateRecord {
  id: string;
}

interface TelegramConnectionRecord {
  telegram_chat_id: string;
  telegram_username: string | null;
}

interface TelegramSendResult {
  ok?: boolean;
  result?: {
    message_id?: number;
  };
}

export async function handleAcceptInviteRequest(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let env: AcceptInviteEnv;

  try {
    env = readEnv();
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : "Configuration error",
    }, 500);
  }

  const userId = getVerifiedUserId(req);
  if (!userId) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await req.json() as { inviteId?: string; decision?: Decision };
    const result = await acceptInvite(body, userId, env, fetch);
    return jsonResponse(result);
  } catch (error) {
    console.error("accept-invite failed", error);
    const message = error instanceof Error ? error.message : "Accept failed";
    const status = message === "Invite not found"
      ? 404
      : message === "Forbidden"
      ? 403
      : message === "Invalid request"
      ? 400
      : 500;

    return jsonResponse({ error: message }, status);
  }
}

export async function acceptInvite(
  body: { inviteId?: string; decision?: Decision },
  userId: string,
  env: AcceptInviteEnv,
  fetcher: Fetcher,
) {
  const inviteId = body.inviteId?.trim();
  const decision = body.decision;

  if (!inviteId || !decision || !["accepted", "declined"].includes(decision)) {
    throw new Error("Invalid request");
  }

  const invite = await getOne<InviteRecord>(
    env,
    fetcher,
    `/rest/v1/invites?id=eq.${encodeURIComponent(inviteId)}&select=*`,
  );
  if (!invite) throw new Error("Invite not found");

  const schedule = await getOne<ScheduleRecord>(
    env,
    fetcher,
    `/rest/v1/schedules?id=eq.${
      encodeURIComponent(invite.schedule_id)
    }&select=id,user_id`,
  );
  if (!schedule || schedule.user_id !== userId) throw new Error("Forbidden");

  if (decision === "declined") {
    if (invite.status !== "declined") {
      await updateInviteDecision(env, fetcher, invite.id, "declined");
    }

    return {
      ok: true,
      decision,
      inviteId: invite.id,
      notification: { attempted: false, reason: "declined" },
    };
  }

  const [slot, invitee, profile] = await Promise.all([
    getOne<SlotRecord>(
      env,
      fetcher,
      `/rest/v1/slots?id=eq.${encodeURIComponent(invite.slot_id)}&select=*`,
    ),
    getOne<InviteeRecord>(
      env,
      fetcher,
      `/rest/v1/invitees?id=eq.${
        encodeURIComponent(invite.invitee_id)
      }&select=*`,
    ),
    getOne<ProfileRecord>(
      env,
      fetcher,
      `/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=*`,
    ),
  ]);

  if (!slot || !invitee) throw new Error("Invite not found");

  if (invite.status !== "accepted") {
    await updateInviteDecision(env, fetcher, invite.id, "accepted");
  }

  const dateId = await getOrCreateDate(env, fetcher, {
    invite,
    invitee,
    slot,
    userId,
  });

  const notification = await notifyVisitorIfLinked(env, fetcher, {
    invite,
    invitee,
    profile,
    slot,
  });

  return {
    ok: true,
    decision,
    inviteId: invite.id,
    dateId,
    notification,
  };
}

function readEnv(): AcceptInviteEnv {
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const supabaseServiceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const telegramBotToken = requiredEnv("TELEGRAM_BOT_TOKEN");
  const telegramApiBaseUrl = Deno.env.get("TELEGRAM_API_BASE_URL") ||
    "https://api.telegram.org";

  return {
    supabaseUrl,
    supabaseServiceRoleKey,
    telegramBotToken,
    telegramApiBaseUrl,
  };
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
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

async function updateInviteDecision(
  env: AcceptInviteEnv,
  fetcher: Fetcher,
  inviteId: string,
  decision: Decision,
) {
  await supabaseRest(env, fetcher, `/rest/v1/invites?id=eq.${inviteId}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: decision,
      decided_at: new Date().toISOString(),
    }),
  });
}

async function getOrCreateDate(
  env: AcceptInviteEnv,
  fetcher: Fetcher,
  data: {
    invite: InviteRecord;
    invitee: InviteeRecord;
    slot: SlotRecord;
    userId: string;
  },
) {
  const existing = await getOne<DateRecord>(
    env,
    fetcher,
    `/rest/v1/dates?invite_id=eq.${
      encodeURIComponent(data.invite.id)
    }&select=id&limit=1`,
  );

  if (existing) return existing.id;

  const dateId = crypto.randomUUID();
  await supabaseRest(env, fetcher, "/rest/v1/dates", {
    method: "POST",
    body: JSON.stringify({
      id: dateId,
      user_id: data.userId,
      invite_id: data.invite.id,
      date: data.invite.target_date,
      time_bucket: data.slot.time_bucket,
      time_start: data.slot.time_start,
      time_end: data.slot.time_end,
      area_label: data.slot.area_label,
      area_place_id: data.slot.area_place_id,
      format: data.slot.format,
      intent_tag: data.slot.intent_tag,
      vibe_tags: data.slot.vibe_tags,
      boundary_tags: data.slot.boundary_tags,
      pay_pref: data.slot.pay_pref,
      invitee_snapshot: {
        name: data.invitee.name,
        phone_e164: data.invitee.phone_e164,
        instagram_handle: data.invitee.instagram_handle,
        telegram_username: data.invitee.telegram_username,
        email: data.invitee.email,
      },
      status: "upcoming",
    }),
  });

  return dateId;
}

async function notifyVisitorIfLinked(
  env: AcceptInviteEnv,
  fetcher: Fetcher,
  data: {
    invite: InviteRecord;
    invitee: InviteeRecord;
    profile: ProfileRecord | null;
    slot: SlotRecord;
  },
) {
  const connection = await getOne<TelegramConnectionRecord>(
    env,
    fetcher,
    `/rest/v1/telegram_connections?invitee_id=eq.${
      encodeURIComponent(data.invite.invitee_id)
    }&is_active=eq.true&select=telegram_chat_id,telegram_username&order=updated_at.desc&limit=1`,
  );

  if (!connection) {
    return { attempted: false, reason: "visitor_not_linked" };
  }

  const hostConnection = data.profile?.accepted_contact_channel === "telegram"
    ? await getHostTelegramConnection(env, fetcher, data.profile.id)
    : null;
  const text = buildAcceptedMessage({
    ...data,
    hostTelegramUsername: hostConnection?.telegram_username ?? null,
  });

  try {
    const telegramResult = await sendTelegramMessage(
      env,
      fetcher,
      connection.telegram_chat_id,
      text,
    );

    await logNotification(env, fetcher, {
      inviteeId: data.invite.invitee_id,
      userId: data.profile?.id ?? null,
      status: "sent",
      providerMessageId: telegramResult.result?.message_id?.toString() ?? null,
      payload: {
        invite_id: data.invite.id,
        chat_id: connection.telegram_chat_id,
        type: "accepted_invite",
      },
    });

    return { attempted: true, sent: true };
  } catch (error) {
    await logNotification(env, fetcher, {
      inviteeId: data.invite.invitee_id,
      userId: data.profile?.id ?? null,
      status: "failed",
      providerMessageId: null,
      payload: {
        invite_id: data.invite.id,
        error: error instanceof Error ? error.message : "Unknown error",
        type: "accepted_invite",
      },
    });

    return { attempted: true, sent: false };
  }
}

function buildAcceptedMessage(data: {
  invite: InviteRecord;
  invitee: InviteeRecord;
  profile: ProfileRecord | null;
  slot: SlotRecord;
  hostTelegramUsername?: string | null;
}) {
  const hostName = data.profile?.display_name || "The host";
  const contact = getAcceptedContact(data.profile, data.hostTelegramUsername);
  const dateLabel = data.invite.target_date;
  const areaLabel = data.slot.area_label;

  return [
    `Good news — ${hostName} accepted your invite.`,
    `Plan: ${dateLabel}, ${data.slot.time_bucket} near ${areaLabel}.`,
    contact,
  ].join("\n\n");
}

function getAcceptedContact(
  profile: ProfileRecord | null,
  hostTelegramUsername?: string | null,
) {
  if (!profile) return "Contact details: the host will share them soon.";

  if (profile.accepted_contact_channel === "instagram") {
    if (profile.instagram_handle) {
      return `Contact: Instagram @${
        profile.instagram_handle.replace(/^@+/, "")
      }`;
    }
    return "Contact: Instagram selected, but the host has not added a handle yet.";
  }

  if (hostTelegramUsername) {
    return `Contact: Telegram @${hostTelegramUsername.replace(/^@+/, "")}`;
  }

  return "Contact: Telegram selected. The host can message you here.";
}

async function getHostTelegramConnection(
  env: AcceptInviteEnv,
  fetcher: Fetcher,
  userId: string,
) {
  const connections = await getMany<TelegramConnectionRecord>(
    env,
    fetcher,
    `/rest/v1/telegram_connections?user_id=eq.${
      encodeURIComponent(userId)
    }&is_active=eq.true&select=telegram_chat_id,telegram_username&order=updated_at.desc&limit=1`,
  );

  return connections[0] ?? null;
}

async function sendTelegramMessage(
  env: AcceptInviteEnv,
  fetcher: Fetcher,
  chatId: string,
  text: string,
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
        reply_markup: { remove_keyboard: true },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Telegram sendMessage failed: ${response.status} ${await response
        .text()}`,
    );
  }

  return await response.json() as TelegramSendResult;
}

async function logNotification(
  env: AcceptInviteEnv,
  fetcher: Fetcher,
  data: {
    inviteeId: string;
    userId: string | null;
    status: "sent" | "failed";
    providerMessageId: string | null;
    payload: Record<string, unknown>;
  },
) {
  await supabaseRest(env, fetcher, "/rest/v1/notification_log", {
    method: "POST",
    body: JSON.stringify({
      user_id: data.userId,
      invitee_id: data.inviteeId,
      channel: "telegram",
      type: "accepted_invite",
      payload_json: data.payload,
      provider_message_id: data.providerMessageId,
      status: data.status,
    }),
  });
}

async function getOne<T>(
  env: AcceptInviteEnv,
  fetcher: Fetcher,
  path: string,
) {
  const rows = await supabaseRest<T[]>(env, fetcher, path);
  return rows[0] ?? null;
}

async function getMany<T>(
  env: AcceptInviteEnv,
  fetcher: Fetcher,
  path: string,
) {
  return await supabaseRest<T[]>(env, fetcher, path);
}

async function supabaseRest<T = unknown>(
  env: AcceptInviteEnv,
  fetcher: Fetcher,
  path: string,
  init: RequestInit = {},
) {
  const response = await fetcher(
    `${env.supabaseUrl.replace(/\/+$/, "")}${path}`,
    {
      ...init,
      headers: {
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Supabase REST failed: ${response.status} ${await response.text()}`,
    );
  }

  const text = await response.text();
  return text ? JSON.parse(text) as T : null as T;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}
