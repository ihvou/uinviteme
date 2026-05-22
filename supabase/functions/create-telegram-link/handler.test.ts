import { createTelegramLink, CreateTelegramLinkEnv } from "./handler.ts";

const env: CreateTelegramLinkEnv = {
  supabaseUrl: "https://supabase.example",
  supabaseServiceRoleKey: "service-role",
};

Deno.test("createTelegramLink stores hashed token and returns Telegram payload", async () => {
  const inserts: Array<Record<string, unknown>> = [];

  const result = await createTelegramLink(
    "host-user-id",
    env,
    async (_input, init = {}) => {
      const requestInit = init as { body?: { toString(): string } };
      inserts.push(JSON.parse(requestInit.body?.toString() || "{}"));
      return new Response(null, { status: 201 });
    },
  );

  if (!result.startPayload.startsWith("host_")) {
    throw new Error("start payload did not use host prefix");
  }

  const token = result.startPayload.slice("host_".length);
  if (!token || inserts[0]?.token_hash === token) {
    throw new Error("raw token should not be stored");
  }

  if (
    inserts[0]?.user_id !== "host-user-id" ||
    inserts[0]?.purpose !== "host_link" ||
    typeof inserts[0]?.expires_at !== "string"
  ) {
    throw new Error("token insert payload was incorrect");
  }
});
