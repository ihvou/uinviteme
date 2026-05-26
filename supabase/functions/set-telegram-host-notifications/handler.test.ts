import {
  setTelegramHostNotifications,
  SetTelegramHostNotificationsEnv,
} from "./handler.ts";

const env: SetTelegramHostNotificationsEnv = {
  supabaseUrl: "https://supabase.example",
  supabaseServiceRoleKey: "service-role",
};

Deno.test("setTelegramHostNotifications updates latest host connection", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  const result = await setTelegramHostNotifications(
    "host-user-id",
    false,
    env,
    createMockFetcher(calls) as typeof fetch,
  );

  if (!result.ok || result.enabled !== false) {
    throw new Error(`unexpected result: ${JSON.stringify(result)}`);
  }

  const patch = calls.find((call) =>
    call.url.includes("/rest/v1/telegram_connections?id=eq.connection-1") &&
    call.init?.method === "PATCH"
  );
  if (!patch?.init?.body) {
    throw new Error("connection was not patched");
  }

  const body = JSON.parse(patch.init.body.toString());
  if (body.is_active !== false || !body.updated_at) {
    throw new Error(`unexpected patch body: ${JSON.stringify(body)}`);
  }
});

function createMockFetcher(calls: Array<{ url: string; init?: RequestInit }>) {
  return async (url: string | URL | Request, init?: RequestInit) => {
    const normalizedUrl = typeof url === "string"
      ? url
      : url instanceof URL
      ? url.toString()
      : url.url;
    calls.push({ url: normalizedUrl, init });

    if (
      normalizedUrl.includes(
        "/rest/v1/telegram_connections?user_id=eq.host-user-id",
      )
    ) {
      return json([{
        id: "connection-1",
        is_active: true,
        telegram_username: "hostuser",
      }]);
    }

    if (
      normalizedUrl.includes(
        "/rest/v1/telegram_connections?id=eq.connection-1",
      )
    ) {
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
