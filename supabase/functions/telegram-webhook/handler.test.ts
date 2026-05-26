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
  const hostCommand = parseStartCommand(
    "/start host_abc123",
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

  if (hostCommand?.action !== "host_link" || hostCommand.token !== "abc123") {
    throw new Error("host link command was not parsed");
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

Deno.test("handleTelegramUpdate links host Telegram admin", async () => {
  const mock = createMockFetcher();

  const result = await handleTelegramUpdate(
    {
      message: {
        text: "/start host_test-token",
        chat: { id: CHAT_ID },
        from: { username: "HostUser" },
      },
    },
    env(),
    mock.fetcher as typeof fetch,
  );

  if (result.action !== "host_linked") {
    throw new Error(`unexpected action: ${result.action}`);
  }

  const connection = mock.telegramConnections.find((row) => row.user_id);
  if (
    connection?.user_id !== ORIGIN_ID ||
    connection.telegram_chat_id !== CHAT_ID ||
    connection.telegram_username !== "HostUser"
  ) {
    throw new Error("host connection payload was incorrect");
  }

  if (!mock.telegramLinkTokenUsed) {
    throw new Error("host link token was not marked used");
  }

  const telegramBody = mock.lastTelegramBody();
  if (!telegramBody.text.includes("Telegram admin is linked")) {
    throw new Error("host link confirmation was not sent");
  }
  if (
    telegramBody.reply_markup?.inline_keyboard?.[0]?.[0]?.callback_data !==
      "host_visibility:public:off"
  ) {
    throw new Error("host link confirmation did not include public toggle");
  }

  const shortcutBody = mock.telegramBodies().find((body) =>
    body.reply_markup?.keyboard?.[0]?.[0]?.text === "My profile"
  );
  if (
    shortcutBody?.reply_markup?.keyboard?.[0]?.[1]?.text !==
      "View accepted invites" ||
    shortcutBody?.reply_markup?.keyboard?.[1]?.[0]?.text !==
      "Browse profiles nearby"
  ) {
    throw new Error("host shortcut keyboard was not sent");
  }
});

Deno.test("handleTelegramUpdate lets linked host manage visibility", async () => {
  const mock = createMockFetcher();
  mock.telegramConnections.push({
    user_id: ORIGIN_ID,
    telegram_chat_id: CHAT_ID,
    telegram_username: "HostUser",
    is_active: true,
  });

  const settingsResult = await handleTelegramUpdate(
    {
      message: {
        text: "/settings",
        chat: { id: CHAT_ID },
        from: { username: "HostUser" },
      },
    },
    env(),
    mock.fetcher as typeof fetch,
  );

  if (settingsResult.action !== "host_settings") {
    throw new Error(`unexpected settings result: ${settingsResult.action}`);
  }

  let telegramBody = mock.lastTelegramBody();
  if (!telegramBody.text.includes("Public profile: On")) {
    throw new Error("host settings did not show public profile status");
  }

  const toggleResult = await handleTelegramUpdate(
    {
      callback_query: {
        id: "callback-host-visibility",
        data: "host_visibility:public:off",
        from: { username: "HostUser" },
        message: { chat: { id: CHAT_ID } },
      },
    },
    env(),
    mock.fetcher as typeof fetch,
  );

  if (
    toggleResult.action !== "host_visibility_updated" ||
    toggleResult.field !== "public_profile_enabled" ||
    toggleResult.enabled !== false
  ) {
    throw new Error(`unexpected toggle result: ${JSON.stringify(toggleResult)}`);
  }

  const profilePatch = mock.profileUpdates.at(-1);
  if (profilePatch?.public_profile_enabled !== false) {
    throw new Error("public profile toggle was not persisted");
  }

  telegramBody = mock.lastTelegramBody();
  if (!telegramBody.text.includes("Public profile is now hidden.")) {
    throw new Error("host visibility confirmation was not sent");
  }
  if (
    telegramBody.reply_markup?.inline_keyboard?.[0]?.[0]?.callback_data !==
      "host_visibility:public:on"
  ) {
    throw new Error("host visibility keyboard did not flip public toggle");
  }
});

Deno.test("handleTelegramUpdate keeps host admin available when notifications are paused", async () => {
  const mock = createMockFetcher();
  mock.telegramConnections.push({
    user_id: ORIGIN_ID,
    telegram_chat_id: CHAT_ID,
    telegram_username: "HostUser",
    is_active: false,
  });

  const result = await handleTelegramUpdate(
    {
      message: {
        text: "/start",
        chat: { id: CHAT_ID },
        from: { username: "HostUser" },
      },
    },
    env(),
    mock.fetcher as typeof fetch,
  );

  if (result.action !== "host_settings") {
    throw new Error(`unexpected paused-host action: ${JSON.stringify(result)}`);
  }
});

Deno.test("handleTelegramUpdate lets linked host accept invite", async () => {
  const mock = createMockFetcher();
  mock.telegramConnections.push({
    user_id: ORIGIN_ID,
    telegram_chat_id: CHAT_ID,
    telegram_username: "HostUser",
    is_active: true,
  });

  const result = await handleTelegramUpdate(
    {
      callback_query: {
        id: "callback-host-accept",
        data: "host_accept:6c8bcf8f-d128-4338-9ddc-c1bf8bd3424c",
        from: { username: "HostUser" },
        message: { chat: { id: CHAT_ID } },
      },
    },
    env(),
    mock.fetcher as typeof fetch,
  );

  if (result.action !== "host_invite_accepted") {
    throw new Error(`unexpected action: ${JSON.stringify(result)}`);
  }

  const invitePatch = mock.calls.find((call) =>
    call.url.includes("/rest/v1/invites?id=eq.") &&
    call.init?.method === "PATCH"
  );
  if (!invitePatch) throw new Error("invite was not accepted");

  const telegramBody = mock.lastTelegramBody();
  if (!telegramBody.text.includes("Invite accepted")) {
    throw new Error("host accept confirmation was not sent");
  }

  if (
    telegramBody.reply_markup?.keyboard?.[0]?.[0]?.text !== "My profile" ||
    telegramBody.reply_markup?.keyboard?.[0]?.[1]?.text !==
      "View accepted invites"
  ) {
    throw new Error("host accept confirmation did not keep host shortcuts");
  }
});

Deno.test("handleTelegramUpdate sends accepted invites web links for linked hosts", async () => {
  const mock = createMockFetcher();
  mock.telegramConnections.push({
    user_id: ORIGIN_ID,
    telegram_chat_id: CHAT_ID,
    telegram_username: "HostUser",
    is_active: true,
  });

  const result = await handleTelegramUpdate(
    {
      message: {
        text: "View accepted invites",
        chat: { id: CHAT_ID },
        from: { username: "HostUser" },
      },
    },
    env(),
    mock.fetcher as typeof fetch,
  );

  if (result.action !== "host_accepted_invites_link") {
    throw new Error(`unexpected action: ${JSON.stringify(result)}`);
  }

  const telegramBody = mock.lastTelegramBody();
  if (
    !telegramBody.text.includes("https://uinvite.me/dates") ||
    !telegramBody.text.includes("https://uinvite.me/invites")
  ) {
    throw new Error("accepted invite links were not sent");
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

Deno.test("handleTelegramUpdate gates Telegram-origin invite with Twilio phone verification", async () => {
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

  const twilioStart = mock.calls.find((call) =>
    call.url.includes("/Services/VA123/Verifications")
  );
  if (!twilioStart?.init?.body) {
    throw new Error("Telegram phone flow did not start Twilio Verify");
  }

  const twilioStartBody = twilioStart.init.body as URLSearchParams;
  if (twilioStartBody.get("To") !== "+6591234567") {
    throw new Error("Telegram phone was not normalized for Twilio");
  }

  const codeResult = await handleTelegramUpdate(
    {
      message: {
        text: "654321",
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

  const twilioCheck = mock.calls.find((call) =>
    call.url.includes("/Services/VA123/VerificationCheck")
  );
  if (!twilioCheck?.init?.body) {
    throw new Error("Telegram phone flow did not check Twilio Verify");
  }

  const twilioCheckBody = twilioCheck.init.body as URLSearchParams;
  if (
    twilioCheckBody.get("To") !== "+6591234567" ||
    twilioCheckBody.get("Code") !== "654321"
  ) {
    throw new Error("Telegram verification check body was incorrect");
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
    twilioAccountSid: "AC123",
    twilioAuthToken: "auth-token",
    twilioVerifyServiceSid: "VA123",
    twilioVerifyApiBaseUrl: "https://verify.example/v2",
  };
}

function createMockFetcher() {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const discoverySessions: Array<Record<string, unknown>> = [];
  const discoveryEvents: Array<Record<string, unknown>> = [];
  const telegramConnections: Array<Record<string, unknown>> = [];
  const profileUpdates: Array<Record<string, unknown>> = [];
  const phoneVerifications: Array<Record<string, unknown>> = [];
  let telegramLinkTokenUsed = false;

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

    if (normalizedUrl.endsWith("/rest/v1/phone_verifications")) {
      if (init?.method === "POST") {
        phoneVerifications.push(JSON.parse(init.body?.toString() || "{}"));
        return json({});
      }
    }

    if (normalizedUrl.includes("/rest/v1/phone_verifications?id=eq.")) {
      if (init?.method === "PATCH") return json({});

      const verificationId = extractEq(normalizedUrl, "id");
      const verification = phoneVerifications.find((row) =>
        row.id === verificationId
      );
      return json(verification
        ? [{
          id: verification.id,
          phone_e164: verification.phone_e164,
          status: verification.status,
          attempt_count: verification.attempt_count ?? 0,
          expires_at: verification.expires_at,
        }]
        : []);
    }

    if (normalizedUrl.includes("/Services/VA123/Verifications")) {
      return json({
        sid: "VE123",
        status: "pending",
        to: "+6591234567",
        channel: "sms",
      });
    }

    if (normalizedUrl.includes("/Services/VA123/VerificationCheck")) {
      const body = init?.body as URLSearchParams | undefined;
      const approved = body?.get("Code") === "654321";
      return json({
        sid: "VE123",
        status: approved ? "approved" : "pending",
        valid: approved,
        to: body?.get("To") ?? "+6591234567",
      });
    }

    if (normalizedUrl.includes("/rest/v1/telegram_link_tokens")) {
      if (init?.method === "PATCH") {
        telegramLinkTokenUsed = true;
        return json({});
      }

      return json([{
        id: "link-token-id",
        user_id: ORIGIN_ID,
        purpose: "host_link",
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        used_at: null,
      }]);
    }

    if (normalizedUrl.includes("/rest/v1/invites")) {
      return json([
        {
          id: "6c8bcf8f-d128-4338-9ddc-c1bf8bd3424c",
          invitee_id: "f4bc85ec-e916-4c2d-8f9a-4bb831fb3b21",
          schedule_id: "bdb7a138-c215-46bc-b662-a36e0fab1a62",
          slot_id: "slot-maya-1",
          target_date: "2026-05-25",
          status: "pending",
        },
      ]);
    }

    if (normalizedUrl.includes("/rest/v1/invitees")) {
      if (normalizedUrl.includes("id=eq.f4bc85ec")) {
        return json([{
          id: "f4bc85ec-e916-4c2d-8f9a-4bb831fb3b21",
          name: "E2E Visitor",
          phone_e164: "+6591234567",
          email: "e2e@example.com",
          instagram_handle: "e2evisitor",
          telegram_username: "e2evisitor",
          phone_verified: true,
        }]);
      }

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

      if (normalizedUrl.includes("user_id=not.is.null")) {
        return json(
          telegramConnections.filter((row) =>
            row.telegram_chat_id === CHAT_ID && row.user_id
          ),
        );
      }

      if (normalizedUrl.includes("user_id=eq.")) {
        const userId = extractEq(normalizedUrl, "user_id");
        return json(
          telegramConnections.filter((row) => row.user_id === userId),
        );
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
      if (normalizedUrl.includes("id=eq.slot-maya-1")) {
        return json([
          {
            id: "slot-maya-1",
            schedule_id: "schedule-maya",
            weekday: 2,
            time_bucket: "early_evening",
            time_start: null,
            time_end: null,
            area_label: "Marina Bay",
            area_place_id: null,
            area_lat: 1.283,
            area_lng: 103.86,
            format: null,
            intent_tag: null,
            vibe_tags: [],
            boundary_tags: [],
            pay_pref: "decide_together",
            notes: "Dinner with a skyline view.",
          },
        ]);
      }

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
      if (init?.method === "PATCH") {
        profileUpdates.push(JSON.parse(init.body?.toString() || "{}"));
        return json({});
      }

      if (normalizedUrl.includes("handle=eq.codex96910493")) {
        return json([
          profile(ORIGIN_ID, "codex96910493", "Codex Canonical Smoke"),
        ]);
      }

      if (normalizedUrl.includes(`id=eq.${ORIGIN_ID}`)) {
        return json([
          {
            ...profile(ORIGIN_ID, "codex96910493", "Codex Canonical Smoke"),
            instagram_handle: "codexhost",
            accepted_contact_channel: "instagram",
          },
        ]);
      }

      return json([
        profile(ORIGIN_ID, "codex96910493", "Codex Canonical Smoke"),
        profile(FIRST_PROFILE_ID, "maya", "Maya", 29),
        profile(SECOND_PROFILE_ID, "nora", "Nora", 31),
      ]);
    }

    if (normalizedUrl.includes("/rest/v1/dates?")) {
      return json([]);
    }

    if (normalizedUrl.endsWith("/rest/v1/dates")) {
      return json({});
    }

    if (normalizedUrl.endsWith("/rest/v1/notification_log")) {
      return json({});
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
    profileUpdates,
    phoneVerifications,
    get telegramLinkTokenUsed() {
      return telegramLinkTokenUsed;
    },
    fetcher,
    lastTelegramBody(method = "/sendMessage") {
      const call = [...calls].reverse().find((item) =>
        item.url.includes(method)
      );
      return JSON.parse(call?.init?.body?.toString() || "{}");
    },
    telegramBodies(method = "/sendMessage") {
      return calls
        .filter((item) => item.url.includes(method))
        .map((item) => JSON.parse(item.init?.body?.toString() || "{}"));
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
    public_profile_enabled: true,
    discovery_enabled: true,
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
