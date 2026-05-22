import { CORS_HEADERS, jsonResponse } from "../_shared/http.ts";
import {
  Fetcher,
  supabaseRest,
  SupabaseServiceEnv,
} from "../_shared/supabaseRest.ts";
import {
  createTelegramLinkToken,
  hashTelegramLinkToken,
} from "../_shared/telegramLinkToken.ts";

const HOST_LINK_PREFIX = "host_";

export interface CreateTelegramLinkEnv extends SupabaseServiceEnv {}

export async function handleCreateTelegramLinkRequest(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let env: CreateTelegramLinkEnv;

  try {
    env = readEnv();
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : "Configuration error",
    }, 500);
  }

  const userId = getVerifiedUserId(req);
  if (!userId) return jsonResponse({ error: "Unauthorized" }, 401);

  try {
    const result = await createTelegramLink(userId, env, fetch);
    return jsonResponse(result);
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Telegram link creation failed";
    return jsonResponse({ error: message }, 500);
  }
}

export async function createTelegramLink(
  userId: string,
  env: CreateTelegramLinkEnv,
  fetcher: Fetcher,
) {
  const token = createTelegramLinkToken();
  const tokenHash = await hashTelegramLinkToken(token);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  await supabaseRest(env, fetcher, "/rest/v1/telegram_link_tokens", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      token_hash: tokenHash,
      purpose: "host_link",
      expires_at: expiresAt,
    }),
  });

  return {
    ok: true,
    startPayload: `${HOST_LINK_PREFIX}${token}`,
    expiresAt,
  };
}

function readEnv(): CreateTelegramLinkEnv {
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
