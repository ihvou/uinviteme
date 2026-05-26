import { CORS_HEADERS, jsonResponse } from "../_shared/http.ts";
import {
  Fetcher,
  supabaseRest,
  SupabaseServiceEnv,
} from "../_shared/supabaseRest.ts";

export type SetTelegramHostNotificationsEnv = SupabaseServiceEnv;

interface SetTelegramHostNotificationsBody {
  enabled?: boolean;
}

interface TelegramConnectionRecord {
  id: string;
  is_active: boolean | null;
  telegram_username: string | null;
}

export async function handleSetTelegramHostNotificationsRequest(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let env: SetTelegramHostNotificationsEnv;

  try {
    env = readEnv();
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : "Configuration error",
    }, 500);
  }

  const userId = getVerifiedUserId(req);
  if (!userId) return jsonResponse({ error: "Unauthorized" }, 401);

  let body: SetTelegramHostNotificationsBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid request body" }, 400);
  }

  if (typeof body.enabled !== "boolean") {
    return jsonResponse({ error: "enabled must be a boolean" }, 400);
  }

  try {
    const result = await setTelegramHostNotifications(
      userId,
      body.enabled,
      env,
      fetch,
    );
    return jsonResponse(result);
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Telegram notification update failed";
    return jsonResponse({ error: message }, 500);
  }
}

export async function setTelegramHostNotifications(
  userId: string,
  enabled: boolean,
  env: SetTelegramHostNotificationsEnv,
  fetcher: Fetcher,
) {
  const connections = await supabaseRest<TelegramConnectionRecord[]>(
    env,
    fetcher,
    `/rest/v1/telegram_connections?user_id=eq.${
      encodeURIComponent(userId)
    }&select=id,is_active,telegram_username&order=updated_at.desc&limit=1`,
  );

  const connection = connections[0];
  if (!connection) {
    throw new Error("Telegram account is not linked");
  }

  await supabaseRest(
    env,
    fetcher,
    `/rest/v1/telegram_connections?id=eq.${encodeURIComponent(connection.id)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        is_active: enabled,
        updated_at: new Date().toISOString(),
      }),
    },
  );

  return {
    ok: true,
    enabled,
    telegramUsername: connection.telegram_username,
  };
}

function readEnv(): SetTelegramHostNotificationsEnv {
  return {
    supabaseUrl: requiredEnv("SUPABASE_URL"),
    supabaseServiceRoleKey: requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
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
