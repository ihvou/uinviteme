const TELEGRAM_SECRET_HEADER = "x-telegram-bot-api-secret-token";
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const COMPACT_UUID_REGEX = /^[0-9a-f]{32}$/;
const BROWSE_PROFILES_LABEL = "Browse profiles nearby";
const INVITE_PROFILE_LABEL = "Invite";
const SKIP_PROFILE_LABEL = "Skip";
const CHANGE_CITY_LABEL = "Change city";
const CANCEL_LABEL = "Cancel";
const SHARE_PHONE_LABEL = "Share phone number";
const MOCK_PHONE_CODE = "123456";
const PHONE_CODE_REGEX = /^\d{6}$/;
const SLOT_CALLBACK_PREFIX = "slot:";

type Fetcher = typeof fetch;

export interface TelegramWebhookEnv {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  telegramBotToken: string;
  telegramWebhookSecret: string;
  telegramApiBaseUrl: string;
  publicSiteUrl: string;
}

interface TelegramUpdate {
  callback_query?: {
    id: string;
    data?: string;
    from?: {
      id?: number | string;
      username?: string;
    };
    message?: {
      chat?: {
        id?: number | string;
      };
    };
  };
  message?: {
    text?: string;
    chat?: {
      id?: number | string;
    };
    from?: {
      id?: number | string;
      username?: string;
    };
    contact?: {
      phone_number?: string;
      user_id?: number | string;
    };
    location?: {
      latitude?: number;
      longitude?: number;
    };
  };
}

interface InviteRecord {
  id: string;
  invitee_id: string;
  schedule_id: string;
  status: "pending" | "accepted" | "declined";
}

interface InviteeRecord {
  id: string;
  phone_verified: boolean | null;
}

interface TelegramConnectionRecord {
  id?: string;
  invitee_id?: string;
}

interface ScheduleRecord {
  id: string;
  user_id: string;
}

interface SlotLocationRecord {
  id?: string;
  schedule_id: string;
  weekday?: number;
  time_bucket?: string;
  time_start?: string | null;
  time_end?: string | null;
  area_label: string | null;
  area_lat: number | string | null;
  area_lng: number | string | null;
  pay_pref?: string | null;
  notes?: string | null;
}

interface DiscoverySlotOption {
  id: string;
  weekday: number;
  time_bucket: string;
  time_start: string | null;
  time_end: string | null;
  area_label: string;
  area_lat: number | string | null;
  area_lng: number | string | null;
  pay_pref: string | null;
  notes: string | null;
}

interface ProfileRecord {
  id: string;
  handle: string | null;
  display_name: string | null;
  age: number | null;
  city_label: string | null;
  bio_one_liner: string | null;
  photo_url: string | null;
}

interface DiscoverySessionRecord {
  telegram_chat_id: string;
  telegram_username: string | null;
  origin_handle: string | null;
  city_label: string | null;
  location_lat: number | string | null;
  location_lng: number | string | null;
  current_profile_id: string | null;
  current_profile_handle: string | null;
  pending_profile_id: string | null;
  pending_profile_handle: string | null;
  phone_e164: string | null;
  phone_verified: boolean | null;
  phone_verification_code: string | null;
}

interface DiscoveryProfileCandidate extends ProfileRecord {
  distanceKm?: number;
}

export type StartCommand =
  | { action: "start" }
  | { action: "invite_updates"; inviteId: string }
  | { action: "discover"; handle: string }
  | { action: "unknown"; payload: string };

export function compactInviteIdToUuid(value: string) {
  const normalized = value.trim().toLowerCase();

  if (UUID_REGEX.test(normalized)) return normalized;

  if (COMPACT_UUID_REGEX.test(normalized)) {
    return [
      normalized.slice(0, 8),
      normalized.slice(8, 12),
      normalized.slice(12, 16),
      normalized.slice(16, 20),
      normalized.slice(20),
    ].join("-");
  }

  return null;
}

export function parseStartCommand(text: string): StartCommand | null {
  const match = text.trim().match(/^\/start(?:@\w+)?(?:\s+(.+))?$/);
  if (!match) return null;

  const payload = match[1]?.trim();
  if (!payload) return { action: "start" };

  if (payload.startsWith("invite_updates_")) {
    const inviteId = compactInviteIdToUuid(
      payload.slice("invite_updates_".length),
    );
    return inviteId
      ? { action: "invite_updates", inviteId }
      : { action: "unknown", payload };
  }

  if (payload.startsWith("discover_")) {
    const handle = payload.slice("discover_".length).trim();
    return handle
      ? { action: "discover", handle }
      : { action: "unknown", payload };
  }

  return { action: "unknown", payload };
}

export async function handleTelegramWebhookRequest(req: Request) {
  if (req.method === "GET") {
    return jsonResponse({ ok: true, service: "telegram-webhook" });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let env: TelegramWebhookEnv;

  try {
    env = readEnv();
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : "Configuration error",
    }, 500);
  }

  if (req.headers.get(TELEGRAM_SECRET_HEADER) !== env.telegramWebhookSecret) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const update = await req.json() as TelegramUpdate;
    const result = await handleTelegramUpdate(update, env, fetch);
    return jsonResponse(result);
  } catch (error) {
    console.error("telegram-webhook failed", error);
    return jsonResponse({ error: "Webhook failed" }, 500);
  }
}

export async function handleTelegramUpdate(
  update: TelegramUpdate,
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
): Promise<Record<string, unknown>> {
  if (update.callback_query) {
    return await handleTelegramCallback(update.callback_query, env, fetcher);
  }

  const message = update.message;
  const chatId = message?.chat?.id?.toString();
  const text = message?.text?.trim();
  const username = normalizeTelegramUsername(message?.from?.username);

  if (!chatId) {
    return { ok: true, ignored: true };
  }

  if (message?.contact?.phone_number) {
    return await handlePhoneNumberMessage(
      env,
      fetcher,
      chatId,
      username,
      message.contact.phone_number,
    );
  }

  if (
    typeof message?.location?.latitude === "number" &&
    typeof message?.location?.longitude === "number"
  ) {
    return await handleLocationMessage(env, fetcher, chatId, username, {
      latitude: message.location.latitude,
      longitude: message.location.longitude,
    });
  }

  if (!text) {
    return { ok: true, ignored: true };
  }

  const session = await getDiscoverySession(env, fetcher, chatId);

  if (text.toLowerCase() === CANCEL_LABEL.toLowerCase()) {
    await saveDiscoverySession(env, fetcher, chatId, {
      telegram_username: username ?? session?.telegram_username ?? null,
      pending_profile_id: null,
      pending_profile_handle: null,
      phone_verification_code: null,
    });
    await sendTelegramMessage(
      env,
      fetcher,
      chatId,
      "No problem. You can keep browsing whenever you're ready.",
      discoveryKeyboard(),
    );
    return { ok: true, action: "cancelled" };
  }

  const city = parseCityMessage(text);
  if (city) {
    return await handleCityMessage(env, fetcher, chatId, username, city);
  }

  if (PHONE_CODE_REGEX.test(text) && session?.phone_verification_code) {
    return await handlePhoneCodeMessage(env, fetcher, chatId, session, text);
  }

  if (session?.pending_profile_id && isLikelyPhoneText(text)) {
    return await handlePhoneNumberMessage(
      env,
      fetcher,
      chatId,
      username,
      text,
    );
  }

  if (text.toLowerCase() === CHANGE_CITY_LABEL.toLowerCase()) {
    await sendTelegramMessage(
      env,
      fetcher,
      chatId,
      "Send a city like: City: Singapore",
      discoveryKeyboard(),
    );
    return { ok: true, action: "city_prompt" };
  }

  if (text.toLowerCase() === BROWSE_PROFILES_LABEL.toLowerCase()) {
    const handle = session?.origin_handle ||
      await getLatestBrowseHandleForChat(env, fetcher, chatId);

    if (!handle) {
      await sendTelegramMessage(
        env,
        fetcher,
        chatId,
        "Use the View profiles nearby link from an invite confirmation page, or send a city like: City: Singapore.",
        discoveryKeyboard(),
      );
      return { ok: true, action: "discover_context_missing" };
    }

    return await startDiscovery(env, fetcher, chatId, username, handle);
  }

  if (text.toLowerCase() === SKIP_PROFILE_LABEL.toLowerCase()) {
    return await skipCurrentProfile(env, fetcher, chatId);
  }

  if (text.toLowerCase() === INVITE_PROFILE_LABEL.toLowerCase()) {
    return await inviteCurrentProfile(env, fetcher, chatId, username);
  }

  const command = parseStartCommand(text);

  if (!command) {
    await sendTelegramMessage(env, fetcher, chatId, defaultHelpText());
    return { ok: true, action: "help" };
  }

  if (command.action === "invite_updates") {
    return await linkInviteUpdates(
      env,
      fetcher,
      chatId,
      username,
      command.inviteId,
    );
  }

  if (command.action === "discover") {
    return await startDiscovery(
      env,
      fetcher,
      chatId,
      username,
      command.handle,
    );
  }

  await sendTelegramMessage(env, fetcher, chatId, defaultHelpText());
  return { ok: true, action: command.action };
}

async function handleTelegramCallback(
  callback: NonNullable<TelegramUpdate["callback_query"]>,
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
) {
  const chatId = callback.message?.chat?.id?.toString();
  const username = normalizeTelegramUsername(callback.from?.username);

  if (!chatId) {
    await answerCallbackQuery(env, fetcher, callback.id);
    return { ok: true, ignored: true };
  }

  const data = callback.data?.trim();
  if (data?.startsWith(SLOT_CALLBACK_PREFIX)) {
    const slotId = data.slice(SLOT_CALLBACK_PREFIX.length);
    const result = await handleInviteSlotSelection(
      env,
      fetcher,
      chatId,
      username,
      slotId,
    );
    await answerCallbackQuery(env, fetcher, callback.id, "Option selected");
    return result;
  }

  await answerCallbackQuery(env, fetcher, callback.id);
  return { ok: true, action: "unknown_callback" };
}

async function linkInviteUpdates(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  chatId: string,
  username: string | null,
  inviteId: string,
) {
  const invite = await getInvite(env, fetcher, inviteId);

  if (!invite) {
    await sendTelegramMessage(
      env,
      fetcher,
      chatId,
      "I couldn't find that invite. Please use the Telegram link from the invite confirmation page.",
    );
    return { ok: true, action: "invite_not_found" };
  }

  await upsertInviteeTelegramConnection(env, fetcher, {
    inviteeId: invite.invitee_id,
    chatId,
    username,
  });

  const handle = await getHostHandleForSchedule(
    env,
    fetcher,
    invite.schedule_id,
  );

  await saveDiscoverySession(env, fetcher, chatId, {
    telegram_username: username,
    origin_handle: handle,
  });

  await sendTelegramMessage(
    env,
    fetcher,
    chatId,
    "Telegram notifications are enabled for this invite. I'll message you here if the host accepts.\n\nYou can also browse profiles nearby when you're ready.",
    handle ? browseProfilesKeyboard() : removeKeyboard(),
  );

  return {
    ok: true,
    action: "invite_updates_linked",
    inviteId: invite.id,
    inviteeId: invite.invitee_id,
  };
}

async function startDiscovery(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  chatId: string,
  username: string | null,
  handle: string,
) {
  const originProfile = await getProfileByHandle(env, fetcher, handle);

  if (!originProfile) {
    await sendTelegramMessage(
      env,
      fetcher,
      chatId,
      "I couldn't find that profile. Try opening discovery from the invite confirmation page again.",
      discoveryKeyboard(),
    );
    return { ok: true, action: "discover_origin_not_found", handle };
  }

  await saveDiscoverySession(env, fetcher, chatId, {
    telegram_username: username,
    origin_handle: originProfile.handle,
    city_label: originProfile.city_label,
    location_lat: null,
    location_lng: null,
    current_profile_id: null,
    current_profile_handle: null,
  });

  return await sendNextDiscoveryProfile(env, fetcher, chatId, {
    excludeProfileId: originProfile.id,
  });
}

async function handleCityMessage(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  chatId: string,
  username: string | null,
  city: string,
) {
  await saveDiscoverySession(env, fetcher, chatId, {
    telegram_username: username,
    city_label: city,
    location_lat: null,
    location_lng: null,
    current_profile_id: null,
    current_profile_handle: null,
  });
  await logDiscoveryEvent(env, fetcher, {
    chatId,
    action: "city_updated",
    cityLabel: city,
  });

  await sendTelegramMessage(
    env,
    fetcher,
    chatId,
    `Got it. Browsing around ${city}.`,
    discoveryKeyboard(),
  );

  return await sendNextDiscoveryProfile(env, fetcher, chatId);
}

async function handleLocationMessage(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  chatId: string,
  username: string | null,
  location: { latitude: number; longitude: number },
) {
  await saveDiscoverySession(env, fetcher, chatId, {
    telegram_username: username,
    city_label: null,
    location_lat: location.latitude,
    location_lng: location.longitude,
    current_profile_id: null,
    current_profile_handle: null,
  });
  await logDiscoveryEvent(env, fetcher, {
    chatId,
    action: "location_updated",
    locationLat: location.latitude,
    locationLng: location.longitude,
  });

  await sendTelegramMessage(
    env,
    fetcher,
    chatId,
    "Got your location. I'll show public profiles with active invite slots nearest to you.",
    discoveryKeyboard(),
  );

  return await sendNextDiscoveryProfile(env, fetcher, chatId);
}

async function skipCurrentProfile(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  chatId: string,
) {
  const session = await getDiscoverySession(env, fetcher, chatId);

  if (!session?.current_profile_id) {
    await sendTelegramMessage(
      env,
      fetcher,
      chatId,
      "There isn't a profile selected right now. Start with Browse profiles nearby.",
      discoveryKeyboard(),
    );
    return { ok: true, action: "skip_without_profile" };
  }

  await logDiscoveryEvent(env, fetcher, {
    chatId,
    profileUserId: session.current_profile_id,
    profileHandle: session.current_profile_handle,
    action: "skipped",
    cityLabel: session.city_label,
    locationLat: toNumber(session.location_lat),
    locationLng: toNumber(session.location_lng),
  });

  return await sendNextDiscoveryProfile(env, fetcher, chatId);
}

async function inviteCurrentProfile(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  chatId: string,
  username: string | null,
) {
  const session = await getDiscoverySession(env, fetcher, chatId);

  if (!session?.current_profile_id || !session.current_profile_handle) {
    await sendTelegramMessage(
      env,
      fetcher,
      chatId,
      "Choose a profile first. Tap Browse profiles nearby to start.",
      discoveryKeyboard(),
    );
    return { ok: true, action: "invite_without_profile" };
  }

  await logDiscoveryEvent(env, fetcher, {
    chatId,
    profileUserId: session.current_profile_id,
    profileHandle: session.current_profile_handle,
    action: "invite_selected",
    cityLabel: session.city_label,
    locationLat: toNumber(session.location_lat),
    locationLng: toNumber(session.location_lng),
  });

  const options = await getScheduleOptionsForProfile(
    env,
    fetcher,
    session.current_profile_id,
  );

  if (options.length === 0) {
    await sendTelegramMessage(
      env,
      fetcher,
      chatId,
      "This profile has no active invite options right now. Try the next profile.",
      profileActionKeyboard(),
    );
    return { ok: true, action: "invite_options_empty" };
  }

  await sendInviteOptions(
    env,
    fetcher,
    chatId,
    session.current_profile_handle,
    options,
  );

  return {
    ok: true,
    action: "invite_options",
    handle: session.current_profile_handle,
  };
}

async function handleInviteSlotSelection(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  chatId: string,
  username: string | null,
  slotId: string,
) {
  const session = await getDiscoverySession(env, fetcher, chatId);

  if (!session?.current_profile_id || !session.current_profile_handle) {
    await sendTelegramMessage(
      env,
      fetcher,
      chatId,
      "Choose a profile first. Tap Browse profiles nearby to start.",
      discoveryKeyboard(),
    );
    return { ok: true, action: "slot_without_profile" };
  }

  const options = await getScheduleOptionsForProfile(
    env,
    fetcher,
    session.current_profile_id,
  );
  const selected = options.find((option) => option.id === slotId);

  if (!selected) {
    await sendTelegramMessage(
      env,
      fetcher,
      chatId,
      "That option is no longer available. Tap Invite again to refresh options.",
      profileActionKeyboard(),
    );
    return { ok: true, action: "slot_not_found" };
  }

  if (
    session.phone_verified || await chatHasVerifiedInvitee(env, fetcher, chatId)
  ) {
    await sendInviteLink(
      env,
      fetcher,
      chatId,
      session.current_profile_handle,
      selected.id,
    );
    return {
      ok: true,
      action: "invite_link_sent",
      handle: session.current_profile_handle,
      slotId: selected.id,
    };
  }

  await saveDiscoverySession(env, fetcher, chatId, {
    telegram_username: username ?? session.telegram_username,
    pending_profile_id: session.current_profile_id,
    pending_profile_handle: packPendingInviteTarget(
      session.current_profile_handle,
      selected.id,
    ),
    phone_verification_code: null,
  });
  await logDiscoveryEvent(env, fetcher, {
    chatId,
    profileUserId: session.current_profile_id,
    profileHandle: session.current_profile_handle,
    action: "phone_prompted",
    cityLabel: session.city_label,
  });

  await sendTelegramMessage(
    env,
    fetcher,
    chatId,
    `Before inviting to ${
      formatSlotOption(selected)
    }, verify your phone number. Tap "${SHARE_PHONE_LABEL}" or send your number here. Test SMS code: ${MOCK_PHONE_CODE}.`,
    phoneRequestKeyboard(),
  );

  return {
    ok: true,
    action: "phone_verification_requested",
    handle: session.current_profile_handle,
    slotId: selected.id,
  };
}

async function handlePhoneNumberMessage(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  chatId: string,
  username: string | null,
  phoneNumber: string,
) {
  const session = await getDiscoverySession(env, fetcher, chatId);
  const normalizedPhone = normalizePhone(phoneNumber);

  if (!session?.pending_profile_id || !session.pending_profile_handle) {
    await sendTelegramMessage(
      env,
      fetcher,
      chatId,
      "Phone received. Choose a profile and tap Invite when you're ready.",
      discoveryKeyboard(),
    );
    return { ok: true, action: "phone_without_pending_invite" };
  }

  await saveDiscoverySession(env, fetcher, chatId, {
    telegram_username: username ?? session.telegram_username,
    phone_e164: normalizedPhone,
    phone_verified: false,
    phone_verification_code: MOCK_PHONE_CODE,
  });

  await sendTelegramMessage(
    env,
    fetcher,
    chatId,
    `Mock SMS sent to ${normalizedPhone}. Reply with ${MOCK_PHONE_CODE} to verify.`,
    removeKeyboard(),
  );

  return { ok: true, action: "phone_code_sent" };
}

async function handlePhoneCodeMessage(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  chatId: string,
  session: DiscoverySessionRecord,
  code: string,
) {
  if (code !== session.phone_verification_code) {
    await sendTelegramMessage(
      env,
      fetcher,
      chatId,
      `That code did not match. Reply with ${MOCK_PHONE_CODE} for this test build.`,
    );
    return { ok: true, action: "phone_code_invalid" };
  }

  await saveDiscoverySession(env, fetcher, chatId, {
    phone_verified: true,
    phone_verification_code: null,
  });

  const pendingTarget = session.pending_profile_handle
    ? parsePendingInviteTarget(session.pending_profile_handle)
    : null;
  await logDiscoveryEvent(env, fetcher, {
    chatId,
    profileUserId: session.pending_profile_id ?? session.current_profile_id,
    profileHandle: pendingTarget?.handle ??
      session.current_profile_handle,
    action: "phone_verified",
    cityLabel: session.city_label,
  });

  const handle = session.pending_profile_handle ||
    session.current_profile_handle;
  let resultHandle = handle;
  let resultSlotId: string | null = null;
  if (handle) {
    const target = parsePendingInviteTarget(handle);
    resultHandle = target.handle;
    resultSlotId = target.slotId;
    await sendInviteLink(env, fetcher, chatId, target.handle, target.slotId);
  } else {
    await sendTelegramMessage(
      env,
      fetcher,
      chatId,
      "Phone verified. Choose a profile and tap Invite when you're ready.",
      discoveryKeyboard(),
    );
  }

  return {
    ok: true,
    action: "phone_verified",
    handle: resultHandle,
    slotId: resultSlotId,
  };
}

async function sendNextDiscoveryProfile(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  chatId: string,
  options: { excludeProfileId?: string | null } = {},
) {
  const session = await getDiscoverySession(env, fetcher, chatId);

  if (!session) {
    await sendTelegramMessage(
      env,
      fetcher,
      chatId,
      "Send a city like: City: Singapore, or open discovery from an invite confirmation page.",
      discoveryKeyboard(),
    );
    return { ok: true, action: "discover_context_missing" };
  }

  const profile = await findNextDiscoveryProfile(
    env,
    fetcher,
    session,
    options,
  );

  if (!profile) {
    await saveDiscoverySession(env, fetcher, chatId, {
      current_profile_id: null,
      current_profile_handle: null,
    });
    await sendTelegramMessage(
      env,
      fetcher,
      chatId,
      session.city_label
        ? `You're caught up around ${session.city_label}. Send another city like: City: Dubai.`
        : "You're caught up nearby. Share another Telegram location or send a city like: City: Dubai.",
      discoveryKeyboard(),
    );
    return { ok: true, action: "discovery_empty" };
  }

  await saveDiscoverySession(env, fetcher, chatId, {
    current_profile_id: profile.id,
    current_profile_handle: profile.handle,
    pending_profile_id: null,
    pending_profile_handle: null,
  });
  await logDiscoveryEvent(env, fetcher, {
    chatId,
    profileUserId: profile.id,
    profileHandle: profile.handle,
    action: "viewed",
    cityLabel: session.city_label,
    locationLat: toNumber(session.location_lat),
    locationLng: toNumber(session.location_lng),
  });

  const optionsForProfile = await getScheduleOptionsForProfile(
    env,
    fetcher,
    profile.id,
  );
  await sendDiscoveryProfile(env, fetcher, chatId, profile, optionsForProfile);

  return { ok: true, action: "discovery_profile", handle: profile.handle };
}

async function findNextDiscoveryProfile(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  session: DiscoverySessionRecord,
  options: { excludeProfileId?: string | null },
) {
  const cityFilter = toNumber(session.location_lat) !== null &&
      toNumber(session.location_lng) !== null
    ? null
    : session.city_label;
  const profiles = await getPublicDiscoveryProfiles(env, fetcher, cityFilter);
  const viewedProfileIds = await getViewedDiscoveryProfileIds(
    env,
    fetcher,
    session.telegram_chat_id,
  );
  const excluded = new Set(
    [
      ...viewedProfileIds,
      options.excludeProfileId,
    ].filter(Boolean) as string[],
  );

  const activeSchedules = await getActiveSchedules(env, fetcher);
  const activeScheduleByUser = new Map(
    activeSchedules.map((schedule) => [schedule.user_id, schedule]),
  );

  let candidates = profiles.filter((profile) =>
    profile.handle &&
    profile.handle !== session.origin_handle &&
    !excluded.has(profile.id) &&
    activeScheduleByUser.has(profile.id)
  ) as DiscoveryProfileCandidate[];

  const lat = toNumber(session.location_lat);
  const lng = toNumber(session.location_lng);
  if (lat !== null && lng !== null) {
    const slots = await getActiveSlotLocations(env, fetcher);
    const distanceByUser = new Map<string, number>();

    for (const slot of slots) {
      const schedule = activeSchedules.find((item) =>
        item.id === slot.schedule_id
      );
      if (!schedule) continue;

      const slotLat = toNumber(slot.area_lat);
      const slotLng = toNumber(slot.area_lng);
      if (slotLat === null || slotLng === null) continue;

      const distance = distanceKm(lat, lng, slotLat, slotLng);
      const previous = distanceByUser.get(schedule.user_id);
      if (previous === undefined || distance < previous) {
        distanceByUser.set(schedule.user_id, distance);
      }
    }

    candidates = candidates
      .map((profile) => ({
        ...profile,
        distanceKm: distanceByUser.get(profile.id),
      }))
      .filter((profile) => profile.distanceKm !== undefined);
  }

  candidates.sort((a, b) => {
    if (a.distanceKm !== undefined || b.distanceKm !== undefined) {
      return (a.distanceKm ?? Number.MAX_VALUE) -
        (b.distanceKm ?? Number.MAX_VALUE);
    }
    return displayNameForProfile(a).localeCompare(displayNameForProfile(b));
  });

  return candidates[0] ?? null;
}

function readEnv(): TelegramWebhookEnv {
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const supabaseServiceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const telegramBotToken = requiredEnv("TELEGRAM_BOT_TOKEN");
  const telegramWebhookSecret = requiredEnv("TELEGRAM_WEBHOOK_SECRET");
  const telegramApiBaseUrl = Deno.env.get("TELEGRAM_API_BASE_URL") ||
    "https://api.telegram.org";
  const publicSiteUrl = Deno.env.get("PUBLIC_SITE_URL") || "https://uinvite.me";

  return {
    supabaseUrl,
    supabaseServiceRoleKey,
    telegramBotToken,
    telegramWebhookSecret,
    telegramApiBaseUrl,
    publicSiteUrl,
  };
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

async function getInvite(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  inviteId: string,
) {
  const rows = await supabaseRest<InviteRecord[]>(
    env,
    fetcher,
    `/rest/v1/invites?id=eq.${
      encodeURIComponent(inviteId)
    }&select=id,invitee_id,schedule_id,status`,
  );

  return rows[0] ?? null;
}

async function getHostHandleForSchedule(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  scheduleId: string,
) {
  const schedules = await supabaseRest<ScheduleRecord[]>(
    env,
    fetcher,
    `/rest/v1/schedules?id=eq.${
      encodeURIComponent(scheduleId)
    }&select=id,user_id`,
  );

  const userId = schedules[0]?.user_id;
  if (!userId) return null;

  const profiles = await supabaseRest<ProfileRecord[]>(
    env,
    fetcher,
    `/rest/v1/profiles?id=eq.${
      encodeURIComponent(userId)
    }&select=${profileSelect()}`,
  );

  return profiles[0]?.handle || null;
}

async function getLatestBrowseHandleForChat(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  chatId: string,
) {
  const session = await getDiscoverySession(env, fetcher, chatId);
  if (session?.origin_handle) return session.origin_handle;

  const connections = await supabaseRest<TelegramConnectionRecord[]>(
    env,
    fetcher,
    `/rest/v1/telegram_connections?telegram_chat_id=eq.${
      encodeURIComponent(chatId)
    }&is_active=eq.true&select=invitee_id&order=updated_at.desc&limit=1`,
  );

  const inviteeId = connections[0]?.invitee_id;
  if (!inviteeId) return null;

  const invites = await supabaseRest<InviteRecord[]>(
    env,
    fetcher,
    `/rest/v1/invites?invitee_id=eq.${
      encodeURIComponent(inviteeId)
    }&select=id,invitee_id,schedule_id,status&order=created_at.desc&limit=1`,
  );

  const scheduleId = invites[0]?.schedule_id;
  return scheduleId ? getHostHandleForSchedule(env, fetcher, scheduleId) : null;
}

async function getProfileByHandle(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  handle: string,
) {
  const profiles = await supabaseRest<ProfileRecord[]>(
    env,
    fetcher,
    `/rest/v1/profiles?handle=eq.${
      encodeURIComponent(handle)
    }&select=${profileSelect()}&limit=1`,
  );

  return profiles[0] ?? null;
}

async function getPublicDiscoveryProfiles(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  cityLabel: string | null,
) {
  const cityParam = cityLabel
    ? `&city_label=ilike.${encodeURIComponent(cityLabel)}`
    : "";
  return await supabaseRest<ProfileRecord[]>(
    env,
    fetcher,
    `/rest/v1/profiles?public_profile_enabled=eq.true&discovery_enabled=eq.true${cityParam}&select=${profileSelect()}&limit=100`,
  );
}

async function getActiveSchedules(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
) {
  return await supabaseRest<ScheduleRecord[]>(
    env,
    fetcher,
    "/rest/v1/schedules?is_active=eq.true&select=id,user_id&limit=500",
  );
}

async function getActiveSlotLocations(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
) {
  return await supabaseRest<SlotLocationRecord[]>(
    env,
    fetcher,
    "/rest/v1/slots?is_active=eq.true&area_lat=not.is.null&area_lng=not.is.null&select=id,schedule_id,weekday,time_bucket,time_start,time_end,area_label,area_lat,area_lng,pay_pref,notes&limit=500",
  );
}

async function getScheduleOptionsForProfile(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  profileUserId: string,
) {
  const schedules = await supabaseRest<ScheduleRecord[]>(
    env,
    fetcher,
    `/rest/v1/schedules?user_id=eq.${
      encodeURIComponent(profileUserId)
    }&is_active=eq.true&select=id,user_id&limit=1`,
  );
  const schedule = schedules[0];
  if (!schedule) return [];

  return await supabaseRest<DiscoverySlotOption[]>(
    env,
    fetcher,
    `/rest/v1/slots?schedule_id=eq.${
      encodeURIComponent(schedule.id)
    }&is_active=eq.true&select=id,weekday,time_bucket,time_start,time_end,area_label,area_lat,area_lng,pay_pref,notes&order=weekday.asc,time_bucket.asc&limit=8`,
  );
}

async function getViewedDiscoveryProfileIds(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  chatId: string,
) {
  const rows = await supabaseRest<Array<{ profile_user_id: string | null }>>(
    env,
    fetcher,
    `/rest/v1/discovery_events?telegram_chat_id=eq.${
      encodeURIComponent(chatId)
    }&profile_user_id=not.is.null&select=profile_user_id&order=created_at.desc&limit=200`,
  );

  return rows
    .map((row) => row.profile_user_id)
    .filter(Boolean) as string[];
}

async function getDiscoverySession(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  chatId: string,
) {
  const rows = await supabaseRest<DiscoverySessionRecord[]>(
    env,
    fetcher,
    `/rest/v1/discovery_sessions?telegram_chat_id=eq.${
      encodeURIComponent(chatId)
    }&select=*&limit=1`,
  );

  return rows[0] ?? null;
}

async function saveDiscoverySession(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  chatId: string,
  data: Partial<DiscoverySessionRecord>,
) {
  const existing = await getDiscoverySession(env, fetcher, chatId);
  const body = {
    ...data,
    telegram_chat_id: chatId,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    await supabaseRest(
      env,
      fetcher,
      `/rest/v1/discovery_sessions?telegram_chat_id=eq.${
        encodeURIComponent(chatId)
      }`,
      {
        method: "PATCH",
        body: JSON.stringify(body),
      },
    );
    return;
  }

  await supabaseRest(env, fetcher, "/rest/v1/discovery_sessions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function logDiscoveryEvent(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  data: {
    chatId: string;
    profileUserId?: string | null;
    profileHandle?: string | null;
    action:
      | "viewed"
      | "skipped"
      | "invite_selected"
      | "phone_prompted"
      | "phone_verified"
      | "city_updated"
      | "location_updated";
    cityLabel?: string | null;
    locationLat?: number | null;
    locationLng?: number | null;
  },
) {
  await supabaseRest(env, fetcher, "/rest/v1/discovery_events", {
    method: "POST",
    body: JSON.stringify({
      telegram_chat_id: data.chatId,
      profile_user_id: data.profileUserId ?? null,
      profile_handle: data.profileHandle ?? null,
      action: data.action,
      city_label: data.cityLabel ?? null,
      location_lat: data.locationLat ?? null,
      location_lng: data.locationLng ?? null,
    }),
  });
}

async function upsertInviteeTelegramConnection(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  data: { inviteeId: string; chatId: string; username: string | null },
) {
  const existing = await supabaseRest<TelegramConnectionRecord[]>(
    env,
    fetcher,
    `/rest/v1/telegram_connections?invitee_id=eq.${
      encodeURIComponent(data.inviteeId)
    }&select=id`,
  );

  const body = {
    invitee_id: data.inviteeId,
    telegram_chat_id: data.chatId,
    telegram_username: data.username,
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  if (existing[0]) {
    await supabaseRest(
      env,
      fetcher,
      `/rest/v1/telegram_connections?id=eq.${
        encodeURIComponent(existing[0].id ?? "")
      }`,
      {
        method: "PATCH",
        body: JSON.stringify(body),
      },
    );
    return;
  }

  await supabaseRest(env, fetcher, "/rest/v1/telegram_connections", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function chatHasVerifiedInvitee(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  chatId: string,
) {
  const connections = await supabaseRest<TelegramConnectionRecord[]>(
    env,
    fetcher,
    `/rest/v1/telegram_connections?telegram_chat_id=eq.${
      encodeURIComponent(chatId)
    }&is_active=eq.true&invitee_id=not.is.null&select=invitee_id&order=updated_at.desc&limit=5`,
  );

  for (const connection of connections) {
    if (!connection.invitee_id) continue;
    const invitees = await supabaseRest<InviteeRecord[]>(
      env,
      fetcher,
      `/rest/v1/invitees?id=eq.${
        encodeURIComponent(connection.invitee_id)
      }&phone_verified=eq.true&select=id,phone_verified&limit=1`,
    );
    if (invitees[0]?.phone_verified) return true;
  }

  return false;
}

async function supabaseRest<T = unknown>(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  path: string,
  init: RequestInit = {},
) {
  const response = await fetcher(
    `${env.supabaseUrl.replace(/\/+$/, "")}${path}`,
    {
      ...init,
      headers: {
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Supabase REST failed: ${response.status} ${await response.text()}`,
    );
  }

  const text = await response.text();
  return text ? JSON.parse(text) as T : null as T;
}

async function sendTelegramMessage(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  chatId: string,
  text: string,
  replyMarkup?: Record<string, unknown>,
  parseMode?: "HTML",
) {
  const response = await fetcher(
    `${
      env.telegramApiBaseUrl.replace(/\/+$/, "")
    }/bot${env.telegramBotToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
        ...(parseMode ? { parse_mode: parseMode } : {}),
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Telegram sendMessage failed: ${response.status} ${await response
        .text()}`,
    );
  }
}

async function sendTelegramPhoto(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  chatId: string,
  photoUrl: string,
  caption: string,
  replyMarkup?: Record<string, unknown>,
) {
  const response = await fetcher(
    `${
      env.telegramApiBaseUrl.replace(/\/+$/, "")
    }/bot${env.telegramBotToken}/sendPhoto`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        photo: photoUrl,
        caption,
        parse_mode: "HTML",
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Telegram sendPhoto failed: ${response.status} ${await response.text()}`,
    );
  }
}

async function answerCallbackQuery(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  callbackQueryId: string,
  text?: string,
) {
  const response = await fetcher(
    `${
      env.telegramApiBaseUrl.replace(/\/+$/, "")
    }/bot${env.telegramBotToken}/answerCallbackQuery`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        ...(text ? { text } : {}),
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Telegram answerCallbackQuery failed: ${response.status} ${await response
        .text()}`,
    );
  }
}

async function sendDiscoveryProfile(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  chatId: string,
  profile: DiscoveryProfileCandidate,
  options: DiscoverySlotOption[],
) {
  const caption = formatDiscoveryProfile(env, profile, options);

  if (profile.photo_url) {
    await sendTelegramPhoto(
      env,
      fetcher,
      chatId,
      profile.photo_url,
      caption,
      profileActionKeyboard(),
    );
    return;
  }

  await sendTelegramMessage(
    env,
    fetcher,
    chatId,
    caption,
    profileActionKeyboard(),
    "HTML",
  );
}

async function sendInviteOptions(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  chatId: string,
  handle: string,
  options: DiscoverySlotOption[],
) {
  const text = [
    `<b>Choose an invite option</b>`,
    `For ${escapeHtml(handle)}, pick the option you want to invite to:`,
    "",
    ...options.map((option, index) =>
      `${index + 1}. ${escapeHtml(formatSlotOption(option))}`
    ),
  ].join("\n");

  await sendTelegramMessage(
    env,
    fetcher,
    chatId,
    text,
    inviteOptionsKeyboard(options),
    "HTML",
  );
}

async function sendInviteLink(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  chatId: string,
  handle: string,
  slotId?: string | null,
) {
  const url = profileUrl(env, handle, slotId);
  await sendTelegramMessage(
    env,
    fetcher,
    chatId,
    `Open the selected invite option here: ${url}`,
    discoveryKeyboard(),
  );
}

function formatDiscoveryProfile(
  env: TelegramWebhookEnv,
  profile: DiscoveryProfileCandidate,
  options: DiscoverySlotOption[],
) {
  const meta = [
    profile.city_label ? escapeHtml(profile.city_label) : null,
    profile.distanceKm !== undefined
      ? `${Math.max(0.1, profile.distanceKm).toFixed(1)} km away`
      : null,
  ].filter(Boolean);
  const lines: string[] = [
    `<b>${escapeHtml(displayNameForProfile(profile))}</b>`,
  ];

  if (meta.length > 0) lines.push(meta.join(" - "));
  if (profile.bio_one_liner) {
    lines.push("", `<i>${escapeHtml(profile.bio_one_liner)}</i>`);
  }

  lines.push("", "<b>Available options</b>");

  if (options.length > 0) {
    for (const [index, option] of options.slice(0, 4).entries()) {
      lines.push(
        `${index + 1}. <b>${escapeHtml(formatSlotOption(option))}</b>`,
      );

      const details = formatSlotDetails(option);
      if (details) lines.push(`   ${details}`);
    }
  } else {
    lines.push("No active invite options right now.");
  }

  if (profile.handle) {
    lines.push(
      "",
      `<a href="${profileUrl(env, profile.handle)}">Open full invite page</a>`,
    );
  }

  return lines.join("\n");
}

function displayNameForProfile(profile: ProfileRecord) {
  const displayName = profile.display_name || profile.handle ||
    "uInvite profile";
  return profile.age ? `${displayName}, ${profile.age}` : displayName;
}

function profileUrl(
  env: TelegramWebhookEnv,
  handle: string,
  slotId?: string | null,
) {
  const base = `${env.publicSiteUrl.replace(/\/+$/, "")}/${
    encodeURIComponent(handle)
  }`;
  return slotId ? `${base}?slot=${encodeURIComponent(slotId)}` : base;
}

function profileSelect() {
  return "id,handle,display_name,age,city_label,bio_one_liner,photo_url";
}

function browseProfilesKeyboard() {
  return {
    keyboard: [[{ text: BROWSE_PROFILES_LABEL }]],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

function discoveryKeyboard() {
  return {
    keyboard: [[{ text: BROWSE_PROFILES_LABEL }, { text: CHANGE_CITY_LABEL }]],
    resize_keyboard: true,
  };
}

function profileActionKeyboard() {
  return {
    keyboard: [
      [{ text: INVITE_PROFILE_LABEL }, { text: SKIP_PROFILE_LABEL }],
      [{ text: CHANGE_CITY_LABEL }],
    ],
    resize_keyboard: true,
  };
}

function inviteOptionsKeyboard(options: DiscoverySlotOption[]) {
  return {
    inline_keyboard: options.map((option, index) => [{
      text: `${index + 1}. ${formatSlotButton(option)}`,
      callback_data: `${SLOT_CALLBACK_PREFIX}${option.id}`,
    }]),
  };
}

function phoneRequestKeyboard() {
  return {
    keyboard: [
      [{ text: SHARE_PHONE_LABEL, request_contact: true }],
      [{ text: CANCEL_LABEL }],
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

function removeKeyboard() {
  return { remove_keyboard: true };
}

function normalizeTelegramUsername(username?: string | null) {
  const normalized = username?.trim().replace(/^@+/, "");
  return normalized || null;
}

function parseCityMessage(text: string) {
  const match = text.match(/^city:\s*(.+)$/i);
  const city = match?.[1]?.trim();
  return city || null;
}

function isLikelyPhoneText(text: string) {
  return /^\+?[0-9][0-9\s().-]{6,}$/.test(text.trim());
}

function normalizePhone(phone: string) {
  const trimmed = phone.trim();
  if (trimmed.startsWith("+")) return `+${trimmed.replace(/\D/g, "")}`;
  return `+${trimmed.replace(/\D/g, "")}`;
}

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const radiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * radiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number) {
  return value * Math.PI / 180;
}

function defaultHelpText() {
  return `Welcome to uInvite.Me. Use the Telegram link from an invite confirmation page, tap ${BROWSE_PROFILES_LABEL}, or send a city like: City: Singapore.`;
}

function formatSlotOption(option: DiscoverySlotOption) {
  const day = weekdayLabel(option.weekday);
  const bucket = formatTimeLabel(option);
  const area = option.area_label || "Area TBD";
  return `${day}, ${bucket} - ${area}`;
}

function formatSlotButton(option: DiscoverySlotOption) {
  const day = shortWeekdayLabel(option.weekday);
  const bucket = shortTimeBucketLabel(option.time_bucket);
  const area = option.area_label || "Area TBD";
  return `${day} ${bucket} - ${area}`;
}

function formatSlotDetails(option: DiscoverySlotOption) {
  const details = [
    option.pay_pref ? `Pay: ${formatPayPreference(option.pay_pref)}` : null,
    option.notes ? option.notes : null,
  ].filter(Boolean);

  return details.map((detail) => escapeHtml(detail ?? "")).join("\n   ");
}

function weekdayLabel(weekday: number) {
  return [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ][weekday] ?? "Day";
}

function shortWeekdayLabel(weekday: number) {
  return [
    "Sun",
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
  ][weekday] ?? "Day";
}

function formatTimeLabel(option: DiscoverySlotOption) {
  if (option.time_start && option.time_end) {
    return `${option.time_start} - ${option.time_end}`;
  }
  return timeBucketLabel(option.time_bucket);
}

function timeBucketLabel(value: string) {
  const labels: Record<string, string> = {
    morning: "morning",
    afternoon: "afternoon",
    early_evening: "early evening (5-8 PM)",
    late_evening: "late evening (after 8 PM)",
    evening: "evening",
    night: "night",
  };

  return labels[value] ?? value.replace(/_/g, " ");
}

function shortTimeBucketLabel(value: string) {
  const labels: Record<string, string> = {
    morning: "morning",
    afternoon: "afternoon",
    early_evening: "early eve",
    late_evening: "late eve",
    evening: "evening",
    night: "night",
  };

  return labels[value] ?? value.replace(/_/g, " ");
}

function formatPayPreference(value: string) {
  const labels: Record<string, string> = {
    split: "split",
    decide_together: "decide together",
    host_pays: "host pays",
    invitee_pays: "visitor pays",
  };

  return labels[value] ?? value.replace(/_/g, " ");
}

function packPendingInviteTarget(handle: string, slotId: string) {
  return `${handle}#${slotId}`;
}

function parsePendingInviteTarget(value: string) {
  const [handle, slotId] = value.split("#");
  return { handle, slotId: slotId || null };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
