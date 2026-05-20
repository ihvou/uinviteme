import {
  compactInviteIdToUuid,
  handleTelegramUpdate,
  parseStartCommand,
  TelegramWebhookEnv,
} from "./handler.ts";

Deno.test("compactInviteIdToUuid expands Telegram-safe invite ids", () => {
  const compact = "6c8bcf8fd12843389ddcc1bf8bd3424c";

  if (
    compactInviteIdToUuid(compact) !== "6c8bcf8f-d128-4338-9ddc-c1bf8bd3424c"
  ) {
    throw new Error("compact invite id was not expanded to a UUID");
  }
});

Deno.test("parseStartCommand understands invite update and discovery payloads", () => {
  const inviteCommand = parseStartCommand(
    "/start invite_updates_6c8bcf8fd12843389ddcc1bf8bd3424c",
  );
  const discoverCommand = parseStartCommand(
    "/start@uinviteme_bot discover_codex96910493",
  );

  if (inviteCommand?.action !== "invite_updates") {
    throw new Error("invite update command was not parsed");
  }

  if (
    discoverCommand?.action !== "discover" ||
    discoverCommand.handle !== "codex96910493"
  ) {
    throw new Error("discover command was not parsed");
  }
});

Deno.test("handleTelegramUpdate links invitee Telegram chat for invite update starts", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const env: TelegramWebhookEnv = {
    supabaseUrl: "https://example.supabase.co",
    supabaseServiceRoleKey: "service-role-key",
    telegramBotToken: "bot-token",
    telegramWebhookSecret: "webhook-secret",
    telegramApiBaseUrl: "https://telegram.example",
    publicSiteUrl: "https://uinvite.me",
  };

  const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
    const normalizedUrl = typeof url === "string"
      ? url
      : url instanceof URL
      ? url.toString()
      : url.url;
    calls.push({ url: normalizedUrl, init });

    if (normalizedUrl.includes("/rest/v1/invites")) {
      return json([
        {
          id: "6c8bcf8f-d128-4338-9ddc-c1bf8bd3424c",
          invitee_id: "f4bc85ec-e916-4c2d-8f9a-4bb831fb3b21",
          schedule_id: "bdb7a138-c215-46bc-b662-a36e0fab1a62",
          status: "pending",
        },
      ]);
    }

    if (normalizedUrl.includes("/rest/v1/schedules")) {
      return json([{ user_id: "7caeb641-5802-42f5-904c-f6f464652c08" }]);
    }

    if (normalizedUrl.includes("/rest/v1/profiles")) {
      return json([{ handle: "codex96910493" }]);
    }

    if (
      normalizedUrl.includes("/rest/v1/telegram_connections") &&
      init?.method !== "POST" && init?.method !== "PATCH"
    ) {
      return json([]);
    }

    if (normalizedUrl.includes("/rest/v1/telegram_connections")) {
      return json({});
    }

    if (normalizedUrl.includes("/sendMessage")) {
      return json({ ok: true });
    }

    return new Response("not found", { status: 404 });
  };

  const result = await handleTelegramUpdate(
    {
      message: {
        text: "/start invite_updates_6c8bcf8fd12843389ddcc1bf8bd3424c",
        chat: { id: 123456 },
        from: { username: "VisitorUser" },
      },
    },
    env,
    fetcher as typeof fetch,
  );

  if (result.action !== "invite_updates_linked") {
    throw new Error(`unexpected action: ${result.action}`);
  }

  const connectionWrite = calls.find((call) =>
    call.url.includes("/rest/v1/telegram_connections") &&
    call.init?.method === "POST"
  );
  if (!connectionWrite?.init?.body) {
    throw new Error("telegram connection was not inserted");
  }

  const body = JSON.parse(connectionWrite.init.body.toString());
  if (
    body.telegram_chat_id !== "123456" ||
    body.telegram_username !== "VisitorUser"
  ) {
    throw new Error("telegram connection payload was incorrect");
  }

  const telegramCall = calls.find((call) => call.url.includes("/sendMessage"));
  if (!telegramCall) {
    throw new Error("confirmation message was not sent");
  }

  const telegramBody = JSON.parse(telegramCall.init?.body?.toString() || "{}");
  if (
    telegramBody.reply_markup?.keyboard?.[0]?.[0]?.text !==
      "Browse profiles nearby"
  ) {
    throw new Error("confirmation did not replace the keyboard with browse");
  }
});

Deno.test("handleTelegramUpdate handles Browse profiles nearby button text", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const env: TelegramWebhookEnv = {
    supabaseUrl: "https://example.supabase.co",
    supabaseServiceRoleKey: "service-role-key",
    telegramBotToken: "bot-token",
    telegramWebhookSecret: "webhook-secret",
    telegramApiBaseUrl: "https://telegram.example",
    publicSiteUrl: "https://uinvite.me",
  };

  const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
    const normalizedUrl = typeof url === "string"
      ? url
      : url instanceof URL
      ? url.toString()
      : url.url;
    calls.push({ url: normalizedUrl, init });

    if (normalizedUrl.includes("/rest/v1/telegram_connections")) {
      return json([
        { invitee_id: "f4bc85ec-e916-4c2d-8f9a-4bb831fb3b21" },
      ]);
    }

    if (normalizedUrl.includes("/rest/v1/invites")) {
      return json([
        {
          id: "6c8bcf8f-d128-4338-9ddc-c1bf8bd3424c",
          invitee_id: "f4bc85ec-e916-4c2d-8f9a-4bb831fb3b21",
          schedule_id: "bdb7a138-c215-46bc-b662-a36e0fab1a62",
          status: "pending",
        },
      ]);
    }

    if (normalizedUrl.includes("/rest/v1/schedules")) {
      return json([{ user_id: "7caeb641-5802-42f5-904c-f6f464652c08" }]);
    }

    if (normalizedUrl.includes("/rest/v1/profiles")) {
      return json([{ handle: "codex96910493" }]);
    }

    if (normalizedUrl.includes("/sendMessage")) {
      return json({ ok: true });
    }

    return new Response("not found", { status: 404 });
  };

  const result = await handleTelegramUpdate(
    {
      message: {
        text: "Browse profiles nearby",
        chat: { id: 123456 },
        from: { username: "VisitorUser" },
      },
    },
    env,
    fetcher as typeof fetch,
  );

  if (result.action !== "discover_placeholder") {
    throw new Error(`unexpected action: ${result.action}`);
  }

  const telegramCall = calls.find((call) => call.url.includes("/sendMessage"));
  const telegramBody = JSON.parse(telegramCall?.init?.body?.toString() || "{}");
  if (!telegramBody.text?.includes("https://uinvite.me/codex96910493")) {
    throw new Error("browse response did not include host invite page");
  }
});

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
