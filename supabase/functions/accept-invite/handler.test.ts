import { acceptInvite, AcceptInviteEnv } from "./handler.ts";

const userId = "7caeb641-5802-42f5-904c-f6f464652c08";
const inviteId = "6c8bcf8f-d128-4338-9ddc-c1bf8bd3424c";
const inviteeId = "f4bc85ec-e916-4c2d-8f9a-4bb831fb3b21";
const slotId = "319c38a0-7b04-4149-8cfb-4b4f5d15fe30";
const scheduleId = "bdb7a138-c215-46bc-b662-a36e0fab1a62";

const env: AcceptInviteEnv = {
  supabaseUrl: "https://example.supabase.co",
  supabaseServiceRoleKey: "service-role-key",
  telegramBotToken: "bot-token",
  telegramApiBaseUrl: "https://telegram.example",
};

Deno.test("acceptInvite accepts invite, creates date, and notifies linked visitor", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  const result = await acceptInvite(
    { inviteId, decision: "accepted" },
    userId,
    env,
    createMockFetcher(calls, { linkedVisitor: true }) as typeof fetch,
  );

  if (result.decision !== "accepted" || !result.dateId) {
    throw new Error("invite was not accepted with a date id");
  }

  const inviteUpdate = calls.find((call) =>
    call.url.includes("/rest/v1/invites?id=eq.") &&
    call.init?.method === "PATCH"
  );
  if (!inviteUpdate) throw new Error("invite status was not updated");

  const dateInsert = calls.find((call) =>
    call.url.endsWith("/rest/v1/dates") && call.init?.method === "POST"
  );
  if (!dateInsert) throw new Error("date was not inserted");

  const telegramCall = calls.find((call) => call.url.includes("/sendMessage"));
  if (!telegramCall?.init?.body) throw new Error("Telegram was not notified");

  const telegramBody = JSON.parse(telegramCall.init.body.toString());
  if (!telegramBody.text.includes("Good news")) {
    throw new Error("Telegram message did not include accepted copy");
  }

  if (
    telegramBody.parse_mode !== "HTML" ||
    !telegramBody.text.includes(
      '<a href="https://instagram.com/codexhost">@codexhost</a>',
    )
  ) {
    throw new Error("Telegram message did not link Instagram contact");
  }

  const notificationLog = calls.find((call) =>
    call.url.endsWith("/rest/v1/notification_log") &&
    call.init?.method === "POST"
  );
  if (!notificationLog) throw new Error("notification was not logged");
});

Deno.test("acceptInvite skips Telegram notification when visitor is not linked", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  const result = await acceptInvite(
    { inviteId, decision: "accepted" },
    userId,
    env,
    createMockFetcher(calls, { linkedVisitor: false }) as typeof fetch,
  );

  if (result.notification.attempted !== false) {
    throw new Error("notification should not be attempted");
  }

  if (calls.some((call) => call.url.includes("/sendMessage"))) {
    throw new Error("Telegram should not be called for unlinked visitors");
  }
});

Deno.test("acceptInvite shares linked host Telegram username when selected", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  await acceptInvite(
    { inviteId, decision: "accepted" },
    userId,
    env,
    createMockFetcher(calls, {
      linkedVisitor: true,
      acceptedContactChannel: "telegram",
      hostTelegramUsername: "codexhost",
    }) as typeof fetch,
  );

  const telegramCall = calls.find((call) => call.url.includes("/sendMessage"));
  if (!telegramCall?.init?.body) throw new Error("Telegram was not notified");

  const telegramBody = JSON.parse(telegramCall.init.body.toString());
  if (!telegramBody.text.includes("Contact: Telegram @codexhost")) {
    throw new Error("Telegram contact was not shared on acceptance");
  }
  if (telegramBody.parse_mode !== "HTML") {
    throw new Error("Telegram contact message should use HTML parse mode");
  }
});

Deno.test("acceptInvite rejects hosts who do not own the schedule", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  try {
    await acceptInvite(
      { inviteId, decision: "accepted" },
      "0d1d18dc-ad81-4d3d-b39f-4f5712113bd5",
      env,
      createMockFetcher(calls, { linkedVisitor: true }) as typeof fetch,
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") return;
  }

  throw new Error("expected Forbidden error");
});

function createMockFetcher(
  calls: Array<{ url: string; init?: RequestInit }>,
  options: {
    linkedVisitor: boolean;
    acceptedContactChannel?: "telegram" | "instagram";
    hostTelegramUsername?: string;
  },
) {
  return async (url: string | URL | Request, init?: RequestInit) => {
    const normalizedUrl = typeof url === "string"
      ? url
      : url instanceof URL
      ? url.toString()
      : url.url;
    calls.push({ url: normalizedUrl, init });

    if (normalizedUrl.includes("/rest/v1/invites?id=eq.")) {
      return json([
        {
          id: inviteId,
          schedule_id: scheduleId,
          slot_id: slotId,
          invitee_id: inviteeId,
          target_date: "2026-05-25",
          status: "pending",
        },
      ]);
    }

    if (normalizedUrl.includes("/rest/v1/schedules")) {
      return json([{ id: scheduleId, user_id: userId }]);
    }

    if (normalizedUrl.includes("/rest/v1/slots")) {
      return json([
        {
          id: slotId,
          time_bucket: "early_evening",
          time_start: null,
          time_end: null,
          area_label: "Marina Bay",
          area_place_id: null,
          format: null,
          intent_tag: null,
          vibe_tags: [],
          boundary_tags: [],
          pay_pref: "decide_together",
        },
      ]);
    }

    if (normalizedUrl.includes("/rest/v1/invitees")) {
      return json([
        {
          id: inviteeId,
          name: "E2E Visitor",
          phone_e164: "+6581234567",
          email: "e2e@example.com",
          instagram_handle: null,
          telegram_username: "e2evisitor",
        },
      ]);
    }

    if (normalizedUrl.includes("/rest/v1/profiles")) {
      return json([
        {
          id: userId,
          display_name: "Codex Canonical Smoke",
          instagram_handle: "codexhost",
          accepted_contact_channel: options.acceptedContactChannel ??
            "instagram",
        },
      ]);
    }

    if (normalizedUrl.includes("/rest/v1/dates?")) {
      return json([]);
    }

    if (normalizedUrl.endsWith("/rest/v1/dates")) {
      return json({});
    }

    if (normalizedUrl.includes("/rest/v1/telegram_connections")) {
      if (normalizedUrl.includes("user_id=eq.")) {
        return json(
          options.hostTelegramUsername
            ? [{
              telegram_chat_id: "host-chat-id",
              telegram_username: options.hostTelegramUsername,
            }]
            : [],
        );
      }

      return json(
        options.linkedVisitor
          ? [{ telegram_chat_id: "123456", telegram_username: "visitor" }]
          : [],
      );
    }

    if (normalizedUrl.includes("/sendMessage")) {
      return json({ ok: true, result: { message_id: 42 } });
    }

    if (
      normalizedUrl.includes("/rest/v1/notification_log") ||
      normalizedUrl.includes("/rest/v1/invites?id=eq.")
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
