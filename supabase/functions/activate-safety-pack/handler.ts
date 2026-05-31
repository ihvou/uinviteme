import { activateSafetyPack, SafetyEnv } from "../_shared/safety.ts";
import { CORS_HEADERS, jsonResponse } from "../_shared/http.ts";

export async function handleActivateSafetyPackRequest(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const userId = getVerifiedUserId(req);
  if (!userId) return jsonResponse({ error: "Unauthorized" }, 401);

  try {
    const env = readEnv();
    const body = await req.json() as {
      dateId?: string;
      checkinAt?: string;
      graceMinutes?: number;
      shareMessage?: string | null;
    };

    if (!body.dateId || !body.checkinAt) {
      return jsonResponse({ error: "dateId and checkinAt are required" }, 400);
    }

    const checkinAt = new Date(body.checkinAt);
    if (Number.isNaN(checkinAt.getTime())) {
      return jsonResponse({ error: "checkinAt is invalid" }, 400);
    }

    const graceMinutes = Number(body.graceMinutes ?? 30);
    if (!Number.isFinite(graceMinutes) || graceMinutes < 5 || graceMinutes > 180) {
      return jsonResponse({ error: "graceMinutes must be between 5 and 180" }, 400);
    }

    const result = await activateSafetyPack(env, fetch, {
      dateId: body.dateId,
      userId,
      checkinAt: checkinAt.toISOString(),
      graceMinutes,
      shareMessage: body.shareMessage ?? null,
    });

    return jsonResponse({ ok: true, pack: result.pack });
  } catch (error) {
    console.error("activate-safety-pack failed", error);
    const message = error instanceof Error ? error.message : "Activation failed";
    return jsonResponse(
      { error: message },
      message === "Forbidden" ? 403 : message.includes("not found") ? 404 : 500,
    );
  }
}

function readEnv(): SafetyEnv {
  return {
    supabaseUrl: requiredEnv("SUPABASE_URL"),
    supabaseServiceRoleKey: requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    telegramBotToken: Deno.env.get("TELEGRAM_BOT_TOKEN")?.trim(),
    telegramApiBaseUrl: Deno.env.get("TELEGRAM_API_BASE_URL") ||
      "https://api.telegram.org",
    publicSiteUrl: Deno.env.get("PUBLIC_SITE_URL") || "https://uinvite.me",
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
