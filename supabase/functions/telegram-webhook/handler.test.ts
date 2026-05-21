import {
  compactInviteIdToUuid,
  handleTelegramUpdate,
  parseStartCommand,
  TelegramWebhookEnv,
} from "./handler.ts";

const CHAT_ID = "123456";
const ORIGIN_ID = "7caeb641-5802-42f5-904c-f6f464652c08";
const FIRST_PROFILE_ID = "eeeeeeee-1111-4444-8888-111111111111";
const SECOND_PROFILE_ID = "eeeeeeee-2222-4444-8888-222222222222";

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

Deno.test("handleTelegramUpdate links invitee chat and offers browse", async () => {
  const mock = createMockFetcher();

  const result = await handleTelegramUpdate(
    {
      message: {
        text: "/start invite_updates_6c8bcf8fd12843389ddcc1bf8bd3424c",
        chat: { id: CHAT_ID },
        from: { username: "VisitorUser" },
      },
    },
    env(),
    mock.fetcher as typeof fetch,
  );

  if (result.action !== "invite_updates_linked") {
    throw new Error(`unexpected action: ${result.action}`);
  }

  const connection = mock.telegramConnections[0];
  if (
    connection.telegram_chat_id !== CHAT_ID ||
    connection.telegram_username !== "VisitorUser"
  ) {
    throw new Error("telegram connection payload was incorrect");
  }

  const telegramBody = mock.lastTelegramBody();
  if (
    telegramBody.reply_markup?.keyboard?.[0]?.[0]?.text !==
      "Browse profiles nearby"
  ) {
    throw new Error("confirmation did not offer browse");
  }
});

Deno.test("handleTelegramUpdate starts discovery and shows one eligible profile", async () => {
  const mock = createMockFetcher();

  const result = await handleTelegramUpdate(
    {
      message: {
        text: "/start discover_codex96910493",
        chat: { id: CHAT_ID },
        from: { username: "VisitorUser" },
      },
    },
    env(),
    mock.fetcher as typeof fetch,
  );

  if (result.action !== "discovery_profile" || result.handle !== "maya") {
    throw new Error(`unexpected result: ${JSON.stringify(result)}`);
  }

  const telegramBody = mock.lastTelegramBody("/sendPhoto");
  if (telegramBody.photo !== "https://images.example/maya.jpg") {
    throw new Error("profile message did not include candidate photo");
  }
  if (telegramBody.parse_mode !== "MarkdownV2") {
    throw new Error("profile message did not use Telegram MarkdownV2");
  }
  if (!telegramBody.caption.includes("✨ *Maya, 29*")) {
    throw new Error("profile message did not include candidate");
  }
  if (!telegramBody.caption.includes("🗓 *Available options*")) {
    throw new Error("profile message did not include available options");
  }
  if (!telegramBody.caption.includes("Tuesday, early evening")) {
    throw new Error("profile message did not include readable schedule");
  }
  if (telegramBody.reply_markup?.keyboard?.[0]?.[0]?.text !== "Invite") {
    throw new Error("profile message did not include Invite action");
  }

  const viewed = mock.discoveryEvents.find((event) =>
    event.action === "viewed" && event.profile_handle === "maya"
  );
  if (!viewed) throw new Error("view event was not recorded");
});

Deno.test("handleTelegramUpdate skips current profile and shows the next one", async () => {
  const mock = createMockFetcher();
  mock.discoverySessions.push({
    telegram_chat_id: CHAT_ID,
    telegram_username: "VisitorUser",
    origin_handle: "codex96910493",
    city_label: "Singapore",
    location_lat: null,
    location_lng: null,
    current_profile_id: FIRST_PROFILE_ID,
    current_profile_handle: "maya",
    pending_profile_id: null,
    pending_profile_handle: null,
    phone_e164: null,
    phone_verified: false,
    phone_verification_code: null,
  });
  mock.discoveryEvents.push({
    telegram_chat_id: CHAT_ID,
    profile_user_id: FIRST_PROFILE_ID,
    profile_handle: "maya",
    action: "viewed",
  });

  const result = await handleTelegramUpdate(
    {
      message: {
        text: "Skip",
        chat: { id: CHAT_ID },
        from: { username: "VisitorUser" },
      },
    },
    env(),
    mock.fetcher as typeof fetch,
  );

  if (result.action !== "discovery_profile" || result.handle !== "nora") {
    throw new Error(`unexpected result: ${JSON.stringify(result)}`);
  }

  const skipped = mock.discoveryEvents.find((event) =>
    event.action === "skipped" && event.profile_handle === "maya"
  );
  if (!skipped) throw new Error("skip event was not recorded");

  const telegramBody = mock.lastTelegramBody("/sendPhoto");
  if (!telegramBody.caption.includes("Nora")) {
    throw new Error("next profile was not shown");
  }
});

Deno.test("handleTelegramUpdate gates Telegram-origin invite with mock phone verification", async () => {
  const mock = createMockFetcher();
  mock.discoverySessions.push({
    telegram_chat_id: CHAT_ID,
    telegram_username: "VisitorUser",
    origin_handle: "codex96910493",
    city_label: "Singapore",
    location_lat: null,
    location_lng: null,
    current_profile_id: FIRST_PROFILE_ID,
    current_profile_handle: "maya",
    pending_profile_id: null,
    pending_profile_handle: null,
    phone_e164: null,
    phone_verified: false,
    phone_verification_code: null,
  });

  const inviteResult = await handleTelegramUpdate(
    {
      message: {
        text: "Invite",
        chat: { id: CHAT_ID },
        from: { username: "VisitorUser" },
      },
    },
    env(),
    mock.fetcher as typeof fetch,
  );

  if (inviteResult.action !== "invite_options") {
    throw new Error(
      `unexpected invite result: ${JSON.stringify(inviteResult)}`,
    );
  }

  let telegramBody = mock.lastTelegramBody();
  if (!telegramBody.text.includes("Choose an invite option")) {
    throw new Error("invite action did not ask which option to invite to");
  }
  if (
    telegramBody.reply_markup?.inline_keyboard?.[0]?.[0]?.callback_data !==
      "slot:slot-maya-1"
  ) {
    throw new Error("invite options did not include slot callback buttons");
  }

  const slotResult = await handleTelegramUpdate(
    {
      callback_query: {
        id: "callback-1",
        data: "slot:slot-maya-1",
        from: { username: "VisitorUser" },
        message: { chat: { id: CHAT_ID } },
      },
    },
    env(),
    mock.fetcher as typeof fetch,
  );

  if (slotResult.action !== "phone_verification_requested") {
    throw new Error(
      `unexpected slot result: ${JSON.stringify(slotResult)}`,
    );
  }

  telegramBody = mock.lastTelegramBody();
  if (
    telegramBody.reply_markup?.keyboard?.[0]?.[0]?.request_contact !== true
  ) {
    throw new Error("phone request did not ask Telegram for a contact");
  }

  const contactResult = await handleTelegramUpdate(
    {
      message: {
        chat: { id: CHAT_ID },
        from: { username: "VisitorUser" },
        contact: { phone_number: "+6591234567", user_id: CHAT_ID },
      },
    },
    env(),
    mock.fetcher as typeof fetch,
  );

  if (contactResult.action !== "phone_code_sent") {
    throw new Error(
      `unexpected contact result: ${JSON.stringify(contactResult)}`,
    );
  }

  const codeResult = await handleTelegramUpdate(
    {
      message: {
        text: "123456",
        chat: { id: CHAT_ID },
        from: { username: "VisitorUser" },
      },
    },
    env(),
    mock.fetcher as typeof fetch,
  );

  if (
    codeResult.action !== "phone_verified" || codeResult.handle !== "maya" ||
    codeResult.slotId !== "slot-maya-1"
  ) {
    throw new Error(`unexpected code result: ${JSON.stringify(codeResult)}`);
  }

  telegramBody = mock.lastTelegramBody();
  if (!telegramBody.text.includes("https://uinvite.me/maya?slot=slot-maya-1")) {
    throw new Error("verified phone did not unlock invite link");
  }
});

Deno.test("handleTelegramUpdate uses manual city and Telegram location context", async () => {
  const mock = createMockFetcher();

  const cityResult = await handleTelegramUpdate(
    {
      message: {
        text: "City: Singapore",
        chat: { id: CHAT_ID },
        from: { username: "VisitorUser" },
      },
    },
    env(),
    mock.fetcher as typeof fetch,
  );
  if (cityResult.action !== "discovery_profile") {
    throw new Error(
      `city did not start discovery: ${JSON.stringify(cityResult)}`,
    );
  }

  const locationResult = await handleTelegramUpdate(
    {
      message: {
        chat: { id: CHAT_ID },
        from: { username: "VisitorUser" },
        location: { latitude: 1.283, longitude: 103.86 },
      },
    },
    env(),
    mock.fetcher as typeof fetch,
  );
  if (locationResult.action !== "discovery_profile") {
    throw new Error(
      `location did not start discovery: ${JSON.stringify(locationResult)}`,
    );
  }
});

function env(): TelegramWebhookEnv {
  return {
    supabaseUrl: "https://example.supabase.co",
    supabaseServiceRoleKey: "service-role-key",
    telegramBotToken: "bot-token",
    telegramWebhookSecret: "webhook-secret",
    telegramApiBaseUrl: "https://telegram.example",
    publicSiteUrl: "https://uinvite.me",
  };
}

function createMockFetcher() {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const discoverySessions: Array<Record<string, unknown>> = [];
  const discoveryEvents: Array<Record<string, unknown>> = [];
  const telegramConnections: Array<Record<string, unknown>> = [];

  const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
    const normalizedUrl = typeof url === "string"
      ? url
      : url instanceof URL
      ? url.toString()
      : url.url;
    calls.push({ url: normalizedUrl, init });

    if (normalizedUrl.includes("/rest/v1/discovery_sessions")) {
      if (init?.method === "POST") {
        discoverySessions.push(JSON.parse(init.body?.toString() || "{}"));
        return json({});
      }

      if (init?.method === "PATCH") {
        const patch = JSON.parse(init.body?.toString() || "{}");
        const chatId = extractEq(normalizedUrl, "telegram_chat_id");
        const session = discoverySessions.find((row) =>
          row.telegram_chat_id === chatId
        );
        if (session) Object.assign(session, patch);
        return json({});
      }

      const chatId = extractEq(normalizedUrl, "telegram_chat_id");
      return json(
        discoverySessions.filter((row) => row.telegram_chat_id === chatId),
      );
    }

    if (normalizedUrl.includes("/rest/v1/discovery_events")) {
      if (init?.method === "POST") {
        discoveryEvents.push(JSON.parse(init.body?.toString() || "{}"));
        return json({});
      }

      const chatId = extractEq(normalizedUrl, "telegram_chat_id");
      return json(
        discoveryEvents
          .filter((row) => row.telegram_chat_id === chatId)
          .map((row) => ({ profile_user_id: row.profile_user_id })),
      );
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

    if (normalizedUrl.includes("/rest/v1/invitees")) {
      return json([]);
    }

    if (normalizedUrl.includes("/rest/v1/telegram_connections")) {
      if (init?.method === "POST") {
        telegramConnections.push(JSON.parse(init.body?.toString() || "{}"));
        return json({});
      }

      if (init?.method === "PATCH") {
        return json({});
      }

      return json([]);
    }

    if (normalizedUrl.includes("/rest/v1/schedules")) {
      if (normalizedUrl.includes("id=eq.bdb7a138")) {
        return json([{
          id: "bdb7a138-c215-46bc-b662-a36e0fab1a62",
          user_id: ORIGIN_ID,
        }]);
      }

      if (normalizedUrl.includes(`user_id=eq.${FIRST_PROFILE_ID}`)) {
        return json([{ id: "schedule-maya", user_id: FIRST_PROFILE_ID }]);
      }

      if (normalizedUrl.includes(`user_id=eq.${SECOND_PROFILE_ID}`)) {
        return json([{ id: "schedule-nora", user_id: SECOND_PROFILE_ID }]);
      }

      return json([
        { id: "schedule-origin", user_id: ORIGIN_ID },
        { id: "schedule-maya", user_id: FIRST_PROFILE_ID },
        { id: "schedule-nora", user_id: SECOND_PROFILE_ID },
      ]);
    }

    if (normalizedUrl.includes("/rest/v1/slots")) {
      if (normalizedUrl.includes("schedule_id=eq.schedule-maya")) {
        return json([
          {
            id: "slot-maya-1",
            schedule_id: "schedule-maya",
            weekday: 2,
            time_bucket: "early_evening",
            time_start: null,
            time_end: null,
            area_label: "Marina Bay",
            area_lat: 1.283,
            area_lng: 103.86,
            pay_pref: "decide_together",
            notes: "Dinner with a skyline view.",
          },
          {
            id: "slot-maya-2",
            schedule_id: "schedule-maya",
            weekday: 5,
            time_bucket: "late_evening",
            time_start: null,
            time_end: null,
            area_label: "Robertson Quay",
            area_lat: 1.2906,
            area_lng: 103.8399,
            pay_pref: "split",
            notes: "Late drinks by the river.",
          },
        ]);
      }

      if (normalizedUrl.includes("schedule_id=eq.schedule-nora")) {
        return json([
          {
            id: "slot-nora-1",
            schedule_id: "schedule-nora",
            weekday: 3,
            time_bucket: "early_evening",
            time_start: null,
            time_end: null,
            area_label: "Orchard",
            area_lat: 1.304,
            area_lng: 103.831,
            pay_pref: "split",
            notes: "Coffee and a gallery walk.",
          },
        ]);
      }

      return json([
        {
          id: "slot-maya-1",
          schedule_id: "schedule-maya",
          weekday: 2,
          time_bucket: "early_evening",
          time_start: null,
          time_end: null,
          area_label: "Marina Bay",
          area_lat: 1.283,
          area_lng: 103.86,
          pay_pref: "decide_together",
          notes: "Dinner with a skyline view.",
        },
        {
          id: "slot-nora-1",
          schedule_id: "schedule-nora",
          weekday: 3,
          time_bucket: "early_evening",
          time_start: null,
          time_end: null,
          area_label: "Orchard",
          area_lat: 1.304,
          area_lng: 103.831,
          pay_pref: "split",
          notes: "Coffee and a gallery walk.",
        },
      ]);
    }

    if (normalizedUrl.includes("/rest/v1/profiles")) {
      if (normalizedUrl.includes("handle=eq.codex96910493")) {
        return json([
          profile(ORIGIN_ID, "codex96910493", "Codex Canonical Smoke"),
        ]);
      }

      if (normalizedUrl.includes(`id=eq.${ORIGIN_ID}`)) {
        return json([
          profile(ORIGIN_ID, "codex96910493", "Codex Canonical Smoke"),
        ]);
      }

      return json([
        profile(ORIGIN_ID, "codex96910493", "Codex Canonical Smoke"),
        profile(FIRST_PROFILE_ID, "maya", "Maya", 29),
        profile(SECOND_PROFILE_ID, "nora", "Nora", 31),
      ]);
    }

    if (
      normalizedUrl.includes("/sendMessage") ||
      normalizedUrl.includes("/sendPhoto") ||
      normalizedUrl.includes("/answerCallbackQuery")
    ) {
      return json({ ok: true });
    }

    return new Response("not found", { status: 404 });
  };

  return {
    calls,
    discoverySessions,
    discoveryEvents,
    telegramConnections,
    fetcher,
    lastTelegramBody(method = "/sendMessage") {
      const call = [...calls].reverse().find((item) =>
        item.url.includes(method)
      );
      return JSON.parse(call?.init?.body?.toString() || "{}");
    },
  };
}

function profile(
  id: string,
  handle: string,
  displayName: string,
  age: number | null = null,
) {
  return {
    id,
    handle,
    display_name: displayName,
    age,
    city_label: "Singapore",
    bio_one_liner: `${displayName} bio`,
    photo_url: `https://images.example/${handle}.jpg`,
  };
}

function extractEq(url: string, key: string) {
  const match = url.match(new RegExp(`${key}=eq\\.([^&]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
