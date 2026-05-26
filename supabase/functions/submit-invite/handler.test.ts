import { submitInvite, SubmitInviteEnv } from "./handler.ts";

const BASE_ENV: SubmitInviteEnv = {
  supabaseUrl: "https://supabase.example",
  supabaseServiceRoleKey: "service-role",
  phoneVerificationMode: "mock",
  mockPhoneCode: "123456",
  telegramBotToken: null,
  telegramApiBaseUrl: "https://telegram.example",
};

const BODY = {
  scheduleId: "schedule-1",
  slotId: "slot-1",
  targetDate: "2026-05-22",
  inviteeData: {
    name: "Sam Visitor",
    phone_e164: "+971501234567",
    instagram_handle: "@sam",
  },
  answers: { vibe: "Dinner" },
  inviteeNote: "Met on Hinge.",
  phoneVerificationCode: "123456",
};

Deno.test("submitInvite creates invite through server-side mock verification", async () => {
  const mock = createMockFetch();

  const result = await submitInvite(BODY, BASE_ENV, mock.fetcher);

  if (!result.ok || !result.inviteId || !result.inviteeId) {
    throw new Error("Expected successful invite submission");
  }

  const invitee = mock.postedInvitees[0];
  const invite = mock.postedInvites[0];

  if (
    invitee.phone_e164 !== "+971501234567" || invitee.phone_verified !== true
  ) {
    throw new Error("Expected verified normalized phone on invitee");
  }

  if (
    invite.schedule_id !== "schedule-1" ||
    invite.slot_id !== "slot-1" ||
    invite.status !== "pending"
  ) {
    throw new Error("Expected pending invite payload");
  }
});

Deno.test("submitInvite rejects duplicate pending invite for verified phone and host", async () => {
  const mock = createMockFetch({
    existingInvitees: [{ id: "invitee-existing" }],
    pendingInvites: [{ id: "invite-existing" }],
  });

  await assertRejects(
    () => submitInvite(BODY, BASE_ENV, mock.fetcher),
    "You already have a pending invite for this host",
  );

  if (mock.postedInvites.length > 0 || mock.postedInvitees.length > 0) {
    throw new Error("Duplicate invite should not insert records");
  }
});

Deno.test("submitInvite accepts approved Twilio verification", async () => {
  const mock = createMockFetch({
    phoneVerification: {
      id: "verification-1",
      phone_e164: "+971501234567",
      status: "approved",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    },
  });

  const result = await submitInvite(
    {
      ...BODY,
      phoneVerificationCode: undefined,
      phoneVerificationId: "verification-1",
    },
    { ...BASE_ENV, phoneVerificationMode: "twilio" },
    mock.fetcher,
  );

  if (!result.ok || mock.postedInvites.length !== 1) {
    throw new Error("Expected Twilio-verified invite submission");
  }
});

Deno.test("submitInvite notifies linked host in Telegram", async () => {
  const mock = createMockFetch({
    hostTelegramConnection: {
      telegram_chat_id: "host-chat-id",
      telegram_username: "hostuser",
    },
  });

  const result = await submitInvite(
    BODY,
    { ...BASE_ENV, telegramBotToken: "bot-token" },
    mock.fetcher,
  );

  if (!result.ok || result.hostNotification?.sent !== true) {
    throw new Error("Expected successful host notification");
  }

  const telegramBody = mock.telegramMessages[0] as {
    text?: string;
    parse_mode?: string;
    reply_markup?: {
      inline_keyboard?: Array<Array<{ callback_data?: string }>>;
    };
  };
  if (!telegramBody?.text?.includes("New invite from Sam Visitor")) {
    throw new Error(
      "Host Telegram notification did not include invite details",
    );
  }

  if (
    telegramBody.parse_mode !== "HTML" ||
    !telegramBody.text.includes(
      '<a href="https://instagram.com/sam">@sam</a>',
    )
  ) {
    throw new Error("Host Telegram notification did not link Instagram");
  }

  if (
    telegramBody.reply_markup?.inline_keyboard?.[0]?.[0]?.callback_data !==
      `host_accept:${result.inviteId}`
  ) {
    throw new Error("Host Telegram notification did not include accept button");
  }
});

Deno.test("submitInvite rejects invalid mock code", async () => {
  const mock = createMockFetch();

  await assertRejects(
    () =>
      submitInvite(
        { ...BODY, phoneVerificationCode: "000000" },
        BASE_ENV,
        mock.fetcher,
      ),
    "Invalid verification code",
  );
});

function createMockFetch(options: {
  existingInvitees?: Array<Record<string, unknown>>;
  pendingInvites?: Array<Record<string, unknown>>;
  phoneVerification?: Record<string, unknown>;
  hostTelegramConnection?: Record<string, unknown>;
} = {}) {
  const postedInvitees: Array<Record<string, unknown>> = [];
  const postedInvites: Array<Record<string, unknown>> = [];
  const telegramMessages: Array<Record<string, unknown>> = [];

  const fetcher: typeof fetch = async (input, init = {}) => {
    const url = input.toString();
    const requestInit = init as {
      method?: string;
      body?: { toString(): string };
    };
    const method = requestInit.method ?? "GET";

    if (method === "POST" && url.endsWith("/rest/v1/invitees")) {
      postedInvitees.push(JSON.parse(requestInit.body?.toString() || "{}"));
      return emptyResponse(201);
    }

    if (method === "POST" && url.endsWith("/rest/v1/invites")) {
      postedInvites.push(JSON.parse(requestInit.body?.toString() || "{}"));
      return emptyResponse(201);
    }

    if (method === "DELETE" && url.includes("/rest/v1/invitees")) {
      return emptyResponse(204);
    }

    if (url.includes("/rest/v1/schedules")) {
      return jsonResponse([{
        id: "schedule-1",
        user_id: "host-1",
        is_active: true,
      }]);
    }

    if (url.includes("/rest/v1/profiles")) {
      return jsonResponse([{ id: "host-1", public_profile_enabled: true }]);
    }

    if (url.includes("/rest/v1/slots")) {
      return jsonResponse([{
        id: "slot-1",
        schedule_id: "schedule-1",
        is_active: true,
        weekday: 1,
        time_bucket: "early_evening",
        area_label: "Marina Bay",
      }]);
    }

    if (url.includes("/rest/v1/screening_configs")) {
      return jsonResponse([{
        require_phone: true,
        require_instagram: true,
        require_telegram: false,
      }]);
    }

    if (url.includes("/rest/v1/phone_verifications")) {
      return jsonResponse(
        options.phoneVerification ? [options.phoneVerification] : [],
      );
    }

    if (url.includes("/rest/v1/invitees?")) {
      return jsonResponse(options.existingInvitees ?? []);
    }

    if (url.includes("/rest/v1/invites?")) {
      return jsonResponse(options.pendingInvites ?? []);
    }

    if (url.includes("/rest/v1/telegram_connections")) {
      return jsonResponse(
        options.hostTelegramConnection ? [options.hostTelegramConnection] : [],
      );
    }

    if (url.includes("/sendMessage")) {
      telegramMessages.push(JSON.parse(requestInit.body?.toString() || "{}"));
      return jsonResponse({ ok: true, result: { message_id: 42 } });
    }

    throw new Error(`Unhandled mock request: ${method} ${url}`);
  };

  return {
    fetcher,
    postedInvitees,
    postedInvites,
    telegramMessages,
  };
}

async function assertRejects(
  action: () => Promise<unknown>,
  expectedMessage: string,
) {
  try {
    await action();
  } catch (error) {
    if (error instanceof Error && error.message === expectedMessage) return;
    throw error;
  }

  throw new Error(`Expected rejection: ${expectedMessage}`);
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function emptyResponse(status: number) {
  return new Response(null, { status });
}
