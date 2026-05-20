const TELEGRAM_SECRET_HEADER = "x-telegram-bot-api-secret-token";
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const COMPACT_UUID_REGEX = /^[0-9a-f]{32}$/;

type Fetcher = typeof fetch;

export interface TelegramWebhookEnv {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  telegramBotToken: string;
  telegramWebhookSecret: string;
  telegramApiBaseUrl: string;
  publicSiteUrl: string;
}

interface TelegramUpdate {
  message?: {
    text?: string;
    chat?: {
      id?: number | string;
    };
    from?: {
      username?: string;
    };
  };
}

interface InviteRecord {
  id: string;
  invitee_id: string;
  status: "pending" | "accepted" | "declined";
}

interface TelegramConnectionRecord {
  id: string;
}

export type StartCommand =
  | { action: "start" }
  | { action: "invite_updates"; inviteId: string }
  | { action: "discover"; handle: string }
  | { action: "unknown"; payload: string };

export function compactInviteIdToUuid(value: string) {
  const normalized = value.trim().toLowerCase();

  if (UUID_REGEX.test(normalized)) return normalized;

  if (COMPACT_UUID_REGEX.test(normalized)) {
    return [
      normalized.slice(0, 8),
      normalized.slice(8, 12),
      normalized.slice(12, 16),
      normalized.slice(16, 20),
      normalized.slice(20),
    ].join("-");
  }

  return null;
}

export function parseStartCommand(text: string): StartCommand | null {
  const match = text.trim().match(/^\/start(?:@\w+)?(?:\s+(.+))?$/);
  if (!match) return null;

  const payload = match[1]?.trim();
  if (!payload) return { action: "start" };

  if (payload.startsWith("invite_updates_")) {
    const inviteId = compactInviteIdToUuid(
      payload.slice("invite_updates_".length),
    );
    return inviteId
      ? { action: "invite_updates", inviteId }
      : { action: "unknown", payload };
  }

  if (payload.startsWith("discover_")) {
    const handle = payload.slice("discover_".length).trim();
    return handle
      ? { action: "discover", handle }
      : { action: "unknown", payload };
  }

  return { action: "unknown", payload };
}

export async function handleTelegramWebhookRequest(req: Request) {
  if (req.method === "GET") {
    return jsonResponse({ ok: true, service: "telegram-webhook" });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let env: TelegramWebhookEnv;

  try {
    env = readEnv();
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : "Configuration error",
    }, 500);
  }

  if (req.headers.get(TELEGRAM_SECRET_HEADER) !== env.telegramWebhookSecret) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const update = await req.json() as TelegramUpdate;
    const result = await handleTelegramUpdate(update, env, fetch);
    return jsonResponse(result);
  } catch (error) {
    console.error("telegram-webhook failed", error);
    return jsonResponse({ error: "Webhook failed" }, 500);
  }
}

export async function handleTelegramUpdate(
  update: TelegramUpdate,
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
) {
  const message = update.message;
  const chatId = message?.chat?.id?.toString();
  const text = message?.text;

  if (!chatId || !text) {
    return { ok: true, ignored: true };
  }

  const command = parseStartCommand(text);

  if (!command) {
    await sendTelegramMessage(env, fetcher, chatId, defaultHelpText());
    return { ok: true, action: "help" };
  }

  if (command.action === "invite_updates") {
    const invite = await getInvite(env, fetcher, command.inviteId);

    if (!invite) {
      await sendTelegramMessage(
        env,
        fetcher,
        chatId,
        "I couldn't find that invite. Please use the Telegram link from the invite confirmation page.",
      );
      return { ok: true, action: "invite_not_found" };
    }

    await upsertInviteeTelegramConnection(env, fetcher, {
      inviteeId: invite.invitee_id,
      chatId,
      username: normalizeTelegramUsername(message.from?.username),
    });

    await sendTelegramMessage(
      env,
      fetcher,
      chatId,
      "Telegram notifications are enabled for this invite. I'll message you here if the host accepts.",
    );

    return {
      ok: true,
      action: "invite_updates_linked",
      inviteId: invite.id,
      inviteeId: invite.invitee_id,
    };
  }

  if (command.action === "discover") {
    const profileUrl = `${env.publicSiteUrl.replace(/\/+$/, "")}/${
      encodeURIComponent(command.handle)
    }`;
    await sendTelegramMessage(
      env,
      fetcher,
      chatId,
      `Nearby browsing is coming next. For now, you can return to this invite page: ${profileUrl}`,
    );
    return { ok: true, action: "discover_placeholder", handle: command.handle };
  }

  await sendTelegramMessage(env, fetcher, chatId, defaultHelpText());
  return { ok: true, action: command.action };
}

function readEnv(): TelegramWebhookEnv {
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const supabaseServiceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const telegramBotToken = requiredEnv("TELEGRAM_BOT_TOKEN");
  const telegramWebhookSecret = requiredEnv("TELEGRAM_WEBHOOK_SECRET");
  const telegramApiBaseUrl = Deno.env.get("TELEGRAM_API_BASE_URL") ||
    "https://api.telegram.org";
  const publicSiteUrl = Deno.env.get("PUBLIC_SITE_URL") || "https://uinvite.me";

  return {
    supabaseUrl,
    supabaseServiceRoleKey,
    telegramBotToken,
    telegramWebhookSecret,
    telegramApiBaseUrl,
    publicSiteUrl,
  };
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

async function getInvite(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  inviteId: string,
) {
  const rows = await supabaseRest<InviteRecord[]>(
    env,
    fetcher,
    `/rest/v1/invites?id=eq.${
      encodeURIComponent(inviteId)
    }&select=id,invitee_id,status`,
  );

  return rows[0] ?? null;
}

async function upsertInviteeTelegramConnection(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  data: { inviteeId: string; chatId: string; username: string | null },
) {
  const existing = await supabaseRest<TelegramConnectionRecord[]>(
    env,
    fetcher,
    `/rest/v1/telegram_connections?invitee_id=eq.${
      encodeURIComponent(data.inviteeId)
    }&select=id`,
  );

  const body = {
    invitee_id: data.inviteeId,
    telegram_chat_id: data.chatId,
    telegram_username: data.username,
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  if (existing[0]) {
    await supabaseRest(
      env,
      fetcher,
      `/rest/v1/telegram_connections?id=eq.${
        encodeURIComponent(existing[0].id)
      }`,
      {
        method: "PATCH",
        body: JSON.stringify(body),
      },
    );
    return;
  }

  await supabaseRest(env, fetcher, "/rest/v1/telegram_connections", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function supabaseRest<T = unknown>(
  env: TelegramWebhookEnv,
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

async function sendTelegramMessage(
  env: TelegramWebhookEnv,
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

function normalizeTelegramUsername(username?: string) {
  const normalized = username?.trim().replace(/^@+/, "");
  return normalized || null;
}

function defaultHelpText() {
  return "Welcome to uInvite.Me. Use the Telegram link from an invite confirmation page to enable notifications.";
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
