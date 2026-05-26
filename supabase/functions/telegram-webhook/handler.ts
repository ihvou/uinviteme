import { acceptInvite, AcceptInviteEnv } from "../accept-invite/handler.ts";
import { sendPhoneOtp, SendPhoneOtpEnv } from "../send-phone-otp/handler.ts";
import {
  verifyPhoneOtp,
  VerifyPhoneOtpEnv,
} from "../verify-phone-otp/handler.ts";
import { hashTelegramLinkToken } from "../_shared/telegramLinkToken.ts";

const TELEGRAM_SECRET_HEADER = "x-telegram-bot-api-secret-token";
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const COMPACT_UUID_REGEX = /^[0-9a-f]{32}$/;
const BROWSE_PROFILES_LABEL = "Browse profiles nearby";
const INVITE_PROFILE_LABEL = "Invite";
const SKIP_PROFILE_LABEL = "Skip";
const CHANGE_CITY_LABEL = "Change city";
const CANCEL_LABEL = "Cancel";
const BACK_LABEL = "Back";
const SHARE_PHONE_LABEL = "Share phone number";
const HOST_SETTINGS_LABEL = "Host settings";
const HOST_PROFILE_LABEL = "My profile";
const PENDING_INVITES_LABEL = "Pending invites";
const MY_DATES_LABEL = "My dates";
const LEGACY_ACCEPTED_INVITES_LABEL = "View accepted invites";
const PHONE_CODE_REGEX = /^\d{4,10}$/;
const SLOT_CALLBACK_PREFIX = "slot:";
const HOST_ACCEPT_CALLBACK_PREFIX = "host_accept:";
const HOST_DECLINE_CALLBACK_PREFIX = "host_decline:";
const HOST_VISIBILITY_CALLBACK_PREFIX = "host_visibility:";

type Fetcher = typeof fetch;
type TelegramParseMode = "HTML" | "MarkdownV2";

export interface TelegramWebhookEnv
  extends SendPhoneOtpEnv, VerifyPhoneOtpEnv {
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

interface HostPendingInviteRecord {
  id: string;
  target_date: string;
  created_at: string | null;
  invitee_note: string | null;
  invitee: {
    id: string;
    name: string;
    phone_e164: string | null;
    phone_verified: boolean | null;
    instagram_handle: string | null;
    telegram_username: string | null;
    occupation: string | null;
  } | null;
  slot: {
    id: string;
    weekday: number;
    time_bucket: string;
    time_start: string | null;
    time_end: string | null;
    area_label: string | null;
    pay_pref: string | null;
    notes: string | null;
  } | null;
}

interface InviteeRecord {
  id: string;
  phone_verified: boolean | null;
}

interface TelegramConnectionRecord {
  id?: string;
  invitee_id?: string;
  user_id?: string;
  telegram_chat_id?: string;
  telegram_username?: string | null;
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

interface HostVisibilityProfileRecord {
  id: string;
  handle: string | null;
  display_name: string | null;
  public_profile_enabled: boolean | null;
  discovery_enabled: boolean | null;
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

interface TelegramLinkTokenRecord {
  id: string;
  user_id: string;
  purpose: "host_link";
  expires_at: string;
  used_at: string | null;
}

export type StartCommand =
  | { action: "start" }
  | { action: "invite_updates"; inviteId: string }
  | { action: "discover"; handle: string }
  | { action: "host_link"; token: string }
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

  if (payload.startsWith("host_")) {
    const token = payload.slice("host_".length).trim();
    return token
      ? { action: "host_link", token }
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

  if (text.toLowerCase() === BACK_LABEL.toLowerCase()) {
    return await handleBackMessage(env, fetcher, chatId, username, session);
  }

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

  if (isHostSettingsText(text)) {
    return await sendHostAdminMenuForChat(env, fetcher, chatId);
  }

  if (isPendingInvitesText(text)) {
    return await sendHostPendingInvitesForChat(env, fetcher, chatId);
  }

  if (isMyDatesText(text)) {
    return await sendHostDatesLinkForChat(env, fetcher, chatId);
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

  if (command.action === "host_link") {
    return await linkHostTelegram(
      env,
      fetcher,
      chatId,
      username,
      command.token,
    );
  }

  if (command.action === "start") {
    const connection = await getHostTelegramConnectionByChat(
      env,
      fetcher,
      chatId,
    );
    if (connection?.user_id) {
      return await sendHostAdminMenu(
        env,
        fetcher,
        chatId,
        connection.user_id,
        "Welcome back. Your host controls are ready.",
      );
    }
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

  if (data?.startsWith(HOST_ACCEPT_CALLBACK_PREFIX)) {
    const inviteId = data.slice(HOST_ACCEPT_CALLBACK_PREFIX.length);
    const result = await handleHostInviteDecision(
      env,
      fetcher,
      chatId,
      inviteId,
      "accepted",
    );
    await answerCallbackQuery(env, fetcher, callback.id, "Invite accepted");
    return result;
  }

  if (data?.startsWith(HOST_DECLINE_CALLBACK_PREFIX)) {
    const inviteId = data.slice(HOST_DECLINE_CALLBACK_PREFIX.length);
    const result = await handleHostInviteDecision(
      env,
      fetcher,
      chatId,
      inviteId,
      "declined",
    );
    await answerCallbackQuery(env, fetcher, callback.id, "Invite declined");
    return result;
  }

  if (data?.startsWith(HOST_VISIBILITY_CALLBACK_PREFIX)) {
    const result = await handleHostVisibilityCallback(
      env,
      fetcher,
      chatId,
      data.slice(HOST_VISIBILITY_CALLBACK_PREFIX.length),
    );
    await answerCallbackQuery(
      env,
      fetcher,
      callback.id,
      typeof result.message === "string" ? result.message : "Updated",
    );
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

async function linkHostTelegram(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  chatId: string,
  username: string | null,
  token: string,
) {
  const tokenHash = await hashTelegramLinkToken(token);
  const linkToken = await getTelegramLinkToken(env, fetcher, tokenHash);

  if (!linkToken || linkToken.purpose !== "host_link") {
    await sendTelegramMessage(
      env,
      fetcher,
      chatId,
      "This host link is invalid. Please create a new Telegram link from Settings.",
      removeKeyboard(),
    );
    return { ok: true, action: "host_link_invalid" };
  }

  if (linkToken.used_at) {
    await sendTelegramMessage(
      env,
      fetcher,
      chatId,
      "This host link was already used. Please create a new Telegram link from Settings.",
      removeKeyboard(),
    );
    return { ok: true, action: "host_link_used" };
  }

  if (Date.parse(linkToken.expires_at) < Date.now()) {
    await sendTelegramMessage(
      env,
      fetcher,
      chatId,
      "This host link has expired. Please create a new Telegram link from Settings.",
      removeKeyboard(),
    );
    return { ok: true, action: "host_link_expired" };
  }

  await upsertHostTelegramConnection(env, fetcher, {
    userId: linkToken.user_id,
    chatId,
    username,
  });
  await markTelegramLinkTokenUsed(env, fetcher, linkToken.id);

  await sendHostAdminMenu(
    env,
    fetcher,
    chatId,
    linkToken.user_id,
    "Telegram admin is linked. I'll send new invite requests here with Accept and Decline buttons.",
  );

  return {
    ok: true,
    action: "host_linked",
    userId: linkToken.user_id,
  };
}

async function sendHostAdminMenuForChat(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  chatId: string,
) {
  const connection = await getHostTelegramConnectionByChat(
    env,
    fetcher,
    chatId,
  );

  if (!connection?.user_id) {
    await sendTelegramMessage(
      env,
      fetcher,
      chatId,
      "Link your host account from Settings before managing host controls here.",
      removeKeyboard(),
    );
    return { ok: true, action: "host_not_linked" };
  }

  return await sendHostAdminMenu(
    env,
    fetcher,
    chatId,
    connection.user_id,
    "Host settings",
  );
}

async function sendHostAdminMenu(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  chatId: string,
  userId: string,
  intro: string,
) {
  const profile = await getHostVisibilityProfile(env, fetcher, userId);

  if (!profile) {
    await sendTelegramMessage(
      env,
      fetcher,
      chatId,
      "I couldn't find your host profile. Please open Settings in the web app.",
      removeKeyboard(),
    );
    return { ok: true, action: "host_profile_missing" };
  }

  await sendTelegramMessage(
    env,
    fetcher,
    chatId,
    "Host shortcuts are ready below.",
    hostMainKeyboard(),
  );

  await sendTelegramMessage(
    env,
    fetcher,
    chatId,
    formatHostSettingsText(env, profile, intro),
    hostVisibilityKeyboard(profile),
  );

  return {
    ok: true,
    action: "host_settings",
    publicProfileEnabled: profile.public_profile_enabled ?? true,
    discoveryEnabled: profile.discovery_enabled ?? true,
  };
}

async function sendHostPendingInvitesForChat(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  chatId: string,
) {
  const connection = await getHostTelegramConnectionByChat(
    env,
    fetcher,
    chatId,
  );

  if (!connection?.user_id) {
    await sendTelegramMessage(
      env,
      fetcher,
      chatId,
      "Link your host account from Settings before opening host invites here.",
      removeKeyboard(),
    );
    return { ok: true, action: "host_not_linked" };
  }

  const schedules = await getSchedulesForUser(env, fetcher, connection.user_id);

  if (schedules.length === 0) {
    await sendTelegramMessage(
      env,
      fetcher,
      chatId,
      "I couldn't find your invite schedule yet. Create or update your invite page in the web app first.",
      hostMainKeyboard(),
    );
    return { ok: true, action: "host_schedule_missing" };
  }

  const invites = await getPendingInvitesForSchedules(
    env,
    fetcher,
    schedules.map((schedule) => schedule.id),
  );

  if (invites.length === 0) {
    await sendTelegramMessage(
      env,
      fetcher,
      chatId,
      "No pending invites right now.",
      hostMainKeyboard(),
    );
    return { ok: true, action: "host_pending_invites_empty" };
  }

  await sendTelegramMessage(
    env,
    fetcher,
    chatId,
    invites.length === 1
      ? "You have 1 pending invite."
      : `You have ${invites.length} pending invites. Showing the latest ${invites.length}.`,
    hostMainKeyboard(),
  );

  for (const [index, invite] of invites.entries()) {
    await sendTelegramMessage(
      env,
      fetcher,
      chatId,
      formatHostPendingInvite(invite, index + 1),
      hostInviteDecisionKeyboard(invite.id),
      "HTML",
    );
  }

  return {
    ok: true,
    action: "host_pending_invites_list",
    count: invites.length,
  };
}

async function sendHostDatesLinkForChat(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  chatId: string,
) {
  const connection = await getHostTelegramConnectionByChat(
    env,
    fetcher,
    chatId,
  );

  if (!connection?.user_id) {
    await sendTelegramMessage(
      env,
      fetcher,
      chatId,
      "Link your host account from Settings before opening host dates here.",
      removeKeyboard(),
    );
    return { ok: true, action: "host_not_linked" };
  }

  const base = env.publicSiteUrl.replace(/\/+$/, "");
  await sendTelegramMessage(
    env,
    fetcher,
    chatId,
    [
      "Your dates are in your web dashboard.",
      "",
      `My dates: ${base}/dates`,
    ].join("\n"),
    hostMainKeyboard(),
  );

  return { ok: true, action: "host_dates_link" };
}

async function handleBackMessage(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  chatId: string,
  username: string | null,
  session: DiscoverySessionRecord | null,
) {
  await saveDiscoverySession(env, fetcher, chatId, {
    telegram_username: username ?? session?.telegram_username ?? null,
    current_profile_id: null,
    current_profile_handle: null,
    pending_profile_id: null,
    pending_profile_handle: null,
    phone_verification_code: null,
  });

  const connection = await getHostTelegramConnectionByChat(
    env,
    fetcher,
    chatId,
  );

  if (connection?.user_id) {
    await sendTelegramMessage(
      env,
      fetcher,
      chatId,
      "Back to main menu.",
      hostMainKeyboard(),
    );
    return { ok: true, action: "back_to_host_menu" };
  }

  await sendTelegramMessage(
    env,
    fetcher,
    chatId,
    "Back to browsing menu.",
    browseProfilesKeyboard(),
  );
  return { ok: true, action: "back_to_browse_menu" };
}

async function handleHostVisibilityCallback(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  chatId: string,
  payload: string,
) {
  const [target, state] = payload.split(":");
  const enabled = state === "on" ? true : state === "off" ? false : null;
  const field = target === "public"
    ? "public_profile_enabled"
    : target === "discovery"
    ? "discovery_enabled"
    : null;

  if (!field || enabled === null) {
    await sendTelegramMessage(
      env,
      fetcher,
      chatId,
      "That host setting action is invalid. Open Host settings and try again.",
      removeKeyboard(),
    );
    return { ok: true, action: "host_visibility_invalid" };
  }

  const connection = await getHostTelegramConnectionByChat(
    env,
    fetcher,
    chatId,
  );

  if (!connection?.user_id) {
    await sendTelegramMessage(
      env,
      fetcher,
      chatId,
      "Link your host account from Settings before managing host controls here.",
      removeKeyboard(),
    );
    return { ok: true, action: "host_not_linked" };
  }

  const profile = await getHostVisibilityProfile(
    env,
    fetcher,
    connection.user_id,
  );

  if (!profile) {
    await sendTelegramMessage(
      env,
      fetcher,
      chatId,
      "I couldn't find your host profile. Please open Settings in the web app.",
      removeKeyboard(),
    );
    return { ok: true, action: "host_profile_missing" };
  }

  await updateHostVisibilityProfile(env, fetcher, connection.user_id, {
    [field]: enabled,
  });

  const updatedProfile = { ...profile, [field]: enabled };
  const message = formatHostVisibilityCallbackMessage(field, enabled);

  await sendTelegramMessage(
    env,
    fetcher,
    chatId,
    formatHostSettingsText(env, updatedProfile, message),
    hostVisibilityKeyboard(updatedProfile),
  );

  return {
    ok: true,
    action: "host_visibility_updated",
    field,
    enabled,
    message,
  };
}

async function handleHostInviteDecision(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  chatId: string,
  inviteId: string,
  decision: "accepted" | "declined",
) {
  if (!UUID_REGEX.test(inviteId)) {
    await sendTelegramMessage(
      env,
      fetcher,
      chatId,
      "That invite action is invalid. Please open the latest invite message.",
      removeKeyboard(),
    );
    return { ok: true, action: "host_decision_invalid" };
  }

  const connection = await getHostTelegramConnectionByChat(
    env,
    fetcher,
    chatId,
  );
  if (!connection?.user_id) {
    await sendTelegramMessage(
      env,
      fetcher,
      chatId,
      "Link your host account from Settings before managing invites here.",
      removeKeyboard(),
    );
    return { ok: true, action: "host_not_linked" };
  }

  try {
    const result = await acceptInvite(
      { inviteId, decision },
      connection.user_id,
      acceptInviteEnv(env),
      fetcher,
    );
    await sendTelegramMessage(
      env,
      fetcher,
      chatId,
      decision === "accepted"
        ? "Invite accepted. The date was added to My dates."
        : "Invite declined. It was removed from your pending queue.",
      hostMainKeyboard(),
    );

    return {
      ok: true,
      action: `host_invite_${decision}`,
      inviteId,
      dateId: result.dateId,
    };
  } catch (error) {
    await sendTelegramMessage(
      env,
      fetcher,
      chatId,
      error instanceof Error && error.message === "Forbidden"
        ? "I couldn't update this invite because it belongs to another host account."
        : "I couldn't update this invite. Please try again or open the web app.",
      hostMainKeyboard(),
    );

    return {
      ok: true,
      action: "host_decision_failed",
      inviteId,
    };
  }
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
    }, verify your phone number. Tap "${SHARE_PHONE_LABEL}" or send your number here. I'll text you a verification code.`,
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

  const phoneForVerification = normalizePhone(phoneNumber);
  const pendingTarget = parsePendingInviteTarget(session.pending_profile_handle);
  let otp: Awaited<ReturnType<typeof sendPhoneOtp>>;
  try {
    otp = await sendPhoneOtp(
      {
        phone: phoneForVerification,
        purpose: "telegram_discovery",
        metadata: {
          telegramChatId: chatId,
          telegramUsername: username ?? session.telegram_username ?? null,
          profileId: session.pending_profile_id,
          profileHandle: pendingTarget.handle,
          slotId: pendingTarget.slotId,
        },
      },
      env,
      fetcher,
    );
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Phone verification could not be started";
    await sendTelegramMessage(
      env,
      fetcher,
      chatId,
      `I couldn't send a verification code: ${message}`,
      phoneRequestKeyboard(),
    );
    return { ok: true, action: "phone_code_send_failed", error: message };
  }

  await saveDiscoverySession(env, fetcher, chatId, {
    telegram_username: username ?? session.telegram_username,
    phone_e164: phoneForVerification,
    phone_verified: false,
    phone_verification_code: otp.verificationId,
  });

  await sendTelegramMessage(
    env,
    fetcher,
    chatId,
    otp.deliveryMode === "test_static_code"
      ? `Phone challenge ready for ${otp.phoneE164}. Reply with the test verification code.`
      : `SMS sent to ${otp.phoneE164}. Reply with the code to verify.`,
    removeKeyboard(),
  );

  return {
    ok: true,
    action: "phone_code_sent",
    verificationId: otp.verificationId,
  };
}

async function handlePhoneCodeMessage(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  chatId: string,
  session: DiscoverySessionRecord,
  code: string,
) {
  if (!session.phone_verification_code || !session.phone_e164) {
    await sendTelegramMessage(
      env,
      fetcher,
      chatId,
      `Send your phone number first so I can text you a verification code.`,
      phoneRequestKeyboard(),
    );
    return { ok: true, action: "phone_code_without_challenge" };
  }

  try {
    await verifyPhoneOtp(
      {
        verificationId: session.phone_verification_code,
        phone: session.phone_e164,
        code,
      },
      env,
      fetcher,
    );
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Verification failed";
    await sendTelegramMessage(
      env,
      fetcher,
      chatId,
      message === "Invalid verification code"
        ? "That code did not match. Please check the SMS and try again."
        : `I couldn't verify that code: ${message}`,
    );
    return { ok: true, action: "phone_code_invalid", error: message };
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
  const twilioAccountSid = requiredEnv("TWILIO_ACCOUNT_SID");
  const twilioAuthToken = requiredEnv("TWILIO_AUTH_TOKEN");
  const twilioVerifyServiceSid = requiredEnv("TWILIO_VERIFY_SERVICE_SID");
  const twilioVerifyApiBaseUrl = Deno.env.get("TWILIO_VERIFY_API_BASE_URL") ||
    "https://verify.twilio.com/v2";
  const phoneVerificationTestCode = Deno.env.get("PHONE_VERIFICATION_TEST_CODE")
    ?.trim() || null;

  return {
    supabaseUrl,
    supabaseServiceRoleKey,
    telegramBotToken,
    telegramWebhookSecret,
    telegramApiBaseUrl,
    publicSiteUrl,
    twilioAccountSid,
    twilioAuthToken,
    twilioVerifyServiceSid,
    twilioVerifyApiBaseUrl,
    phoneVerificationTestCode,
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

async function getSchedulesForUser(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  userId: string,
) {
  return await supabaseRest<ScheduleRecord[]>(
    env,
    fetcher,
    `/rest/v1/schedules?user_id=eq.${
      encodeURIComponent(userId)
    }&select=id,user_id&order=created_at.desc`,
  );
}

async function getPendingInvitesForSchedules(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  scheduleIds: string[],
) {
  if (scheduleIds.length === 0) return [];

  const scheduleFilter = scheduleIds.length === 1
    ? `schedule_id=eq.${encodeURIComponent(scheduleIds[0])}`
    : `schedule_id=in.(${
      scheduleIds.map((scheduleId) => encodeURIComponent(scheduleId)).join(",")
    })`;

  return await supabaseRest<HostPendingInviteRecord[]>(
    env,
    fetcher,
    `/rest/v1/invites?${scheduleFilter}&status=eq.pending&select=id,target_date,created_at,invitee_note,invitee:invitees(id,name,phone_e164,phone_verified,instagram_handle,telegram_username,occupation),slot:slots(id,weekday,time_bucket,time_start,time_end,area_label,pay_pref,notes)&order=created_at.desc&limit=10`,
  );
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

async function getTelegramLinkToken(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  tokenHash: string,
) {
  const rows = await supabaseRest<TelegramLinkTokenRecord[]>(
    env,
    fetcher,
    `/rest/v1/telegram_link_tokens?token_hash=eq.${
      encodeURIComponent(tokenHash)
    }&select=id,user_id,purpose,expires_at,used_at&limit=1`,
  );

  return rows[0] ?? null;
}

async function markTelegramLinkTokenUsed(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  tokenId: string,
) {
  await supabaseRest(
    env,
    fetcher,
    `/rest/v1/telegram_link_tokens?id=eq.${encodeURIComponent(tokenId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ used_at: new Date().toISOString() }),
    },
  );
}

async function upsertHostTelegramConnection(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  data: { userId: string; chatId: string; username: string | null },
) {
  const existing = await supabaseRest<TelegramConnectionRecord[]>(
    env,
    fetcher,
    `/rest/v1/telegram_connections?user_id=eq.${
      encodeURIComponent(data.userId)
    }&select=id`,
  );

  const body = {
    user_id: data.userId,
    invitee_id: null,
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

async function getHostTelegramConnectionByChat(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  chatId: string,
) {
  const rows = await supabaseRest<TelegramConnectionRecord[]>(
    env,
    fetcher,
    `/rest/v1/telegram_connections?telegram_chat_id=eq.${
      encodeURIComponent(chatId)
    }&user_id=not.is.null&select=user_id,telegram_chat_id,telegram_username&order=updated_at.desc&limit=1`,
  );

  return rows[0] ?? null;
}

async function getHostVisibilityProfile(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  userId: string,
) {
  const rows = await supabaseRest<HostVisibilityProfileRecord[]>(
    env,
    fetcher,
    `/rest/v1/profiles?id=eq.${
      encodeURIComponent(userId)
    }&select=id,handle,display_name,public_profile_enabled,discovery_enabled&limit=1`,
  );

  return rows[0] ?? null;
}

async function updateHostVisibilityProfile(
  env: TelegramWebhookEnv,
  fetcher: Fetcher,
  userId: string,
  data: Partial<Pick<
    HostVisibilityProfileRecord,
    "public_profile_enabled" | "discovery_enabled"
  >>,
) {
  await supabaseRest(
    env,
    fetcher,
    `/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        ...data,
        updated_at: new Date().toISOString(),
      }),
    },
  );
}

function acceptInviteEnv(env: TelegramWebhookEnv): AcceptInviteEnv {
  return {
    supabaseUrl: env.supabaseUrl,
    supabaseServiceRoleKey: env.supabaseServiceRoleKey,
    telegramBotToken: env.telegramBotToken,
    telegramApiBaseUrl: env.telegramApiBaseUrl,
  };
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
  parseMode?: TelegramParseMode,
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
  parseMode: TelegramParseMode = "MarkdownV2",
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
        parse_mode: parseMode,
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
    "MarkdownV2",
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
    "🎯 *Choose an invite option*",
    `Pick one below for ${markdownBold(handle)}:`,
    "",
    ...options.flatMap((option, index) =>
      formatSlotMarkdownBlock(option, index + 1)
    ),
  ].join("\n");

  await sendTelegramMessage(
    env,
    fetcher,
    chatId,
    text,
    inviteOptionsKeyboard(options),
    "MarkdownV2",
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
    [
      "✅ *Phone verified*",
      "",
      `Open the selected invite option here: [${escapeMarkdown(handle)}](${
        escapeMarkdownUrl(url)
      })`,
    ].join("\n"),
    discoveryKeyboard(),
    "MarkdownV2",
  );
}

function formatDiscoveryProfile(
  env: TelegramWebhookEnv,
  profile: DiscoveryProfileCandidate,
  options: DiscoverySlotOption[],
) {
  const meta = [
    profile.city_label,
    profile.distanceKm !== undefined
      ? `${Math.max(0.1, profile.distanceKm).toFixed(1)} km away`
      : null,
  ].filter(Boolean);
  const lines: string[] = [
    `✨ ${markdownBold(displayNameForProfile(profile))}`,
  ];

  if (meta.length > 0) lines.push(`📍 ${escapeMarkdown(meta.join(" · "))}`);
  if (profile.bio_one_liner) {
    lines.push("", ...formatMarkdownQuote(profile.bio_one_liner));
  }

  lines.push("", "🗓 *Available options*");

  if (options.length > 0) {
    for (const [index, option] of options.slice(0, 4).entries()) {
      lines.push(...formatSlotMarkdownBlock(option, index + 1));
    }
  } else {
    lines.push("No active invite options right now\\.");
  }

  if (profile.handle) {
    lines.push(
      "",
      `🔗 [Open full invite page](${
        escapeMarkdownUrl(profileUrl(env, profile.handle))
      })`,
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
    keyboard: [
      [{ text: BROWSE_PROFILES_LABEL }, { text: CHANGE_CITY_LABEL }],
      [{ text: BACK_LABEL }],
    ],
    resize_keyboard: true,
  };
}

function profileActionKeyboard() {
  return {
    keyboard: [
      [{ text: INVITE_PROFILE_LABEL }, { text: SKIP_PROFILE_LABEL }],
      [{ text: CHANGE_CITY_LABEL }, { text: BACK_LABEL }],
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

function hostMainKeyboard() {
  return {
    keyboard: [
      [{ text: HOST_PROFILE_LABEL }, { text: PENDING_INVITES_LABEL }],
      [{ text: MY_DATES_LABEL }, { text: BROWSE_PROFILES_LABEL }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

function hostInviteDecisionKeyboard(inviteId: string) {
  return {
    inline_keyboard: [[
      { text: "Accept", callback_data: `${HOST_ACCEPT_CALLBACK_PREFIX}${inviteId}` },
      { text: "Decline", callback_data: `${HOST_DECLINE_CALLBACK_PREFIX}${inviteId}` },
    ]],
  };
}

function hostVisibilityKeyboard(profile: HostVisibilityProfileRecord) {
  return {
    inline_keyboard: [
      [
        {
          text: profile.public_profile_enabled === false
            ? "Public page: Off"
            : "Public page: On",
          callback_data: `${HOST_VISIBILITY_CALLBACK_PREFIX}public:${
            profile.public_profile_enabled === false ? "on" : "off"
          }`,
        },
      ],
      [
        {
          text: profile.discovery_enabled === false
            ? "Discovery: Off"
            : "Discovery: On",
          callback_data: `${HOST_VISIBILITY_CALLBACK_PREFIX}discovery:${
            profile.discovery_enabled === false ? "on" : "off"
          }`,
        },
      ],
    ],
  };
}

function formatHostSettingsText(
  env: TelegramWebhookEnv,
  profile: HostVisibilityProfileRecord,
  intro: string,
) {
  const publicProfileEnabled = profile.public_profile_enabled !== false;
  const discoveryEnabled = profile.discovery_enabled !== false;
  const publicStatus = publicProfileEnabled ? "On" : "Off";
  const discoveryStatus = discoveryEnabled ? "On" : "Off";
  const base = env.publicSiteUrl.replace(/\/+$/, "");
  const publicUrl = profile.handle ? profileUrl(env, profile.handle) : null;
  const lines = [
    intro,
    "",
    `Public profile: ${publicStatus}`,
    publicUrl && publicProfileEnabled ? `Public link: ${publicUrl}` : null,
    `Discovery: ${discoveryStatus}`,
    "",
    `Update profile: ${base}/settings`,
    `Pending invites: ${base}/invites`,
    `My dates: ${base}/dates`,
    "",
    "Tap a button below to toggle availability.",
  ].filter(Boolean);

  return lines.join("\n");
}

function formatHostPendingInvite(invite: HostPendingInviteRecord, index: number) {
  const invitee = invite.invitee;
  const slot = invite.slot;
  const contacts = [
    invitee?.phone_e164
      ? `Phone: ${escapeHtml(invitee.phone_e164)}${
        invitee.phone_verified ? " (verified)" : ""
      }`
      : null,
    invitee?.instagram_handle
      ? `Instagram: ${instagramHtmlLink(invitee.instagram_handle)}`
      : null,
    invitee?.telegram_username
      ? `Telegram: @${escapeHtml(normalizeSocialHandle(invitee.telegram_username))}`
      : null,
  ].filter(Boolean);

  const lines = [
    `<b>${index}. ${escapeHtml(invitee?.name || "Visitor")}</b>`,
    invite.created_at ? `Received: ${escapeHtml(formatShortDateTime(invite.created_at))}` : null,
    `When: ${escapeHtml(formatTargetDate(invite.target_date))}${
      slot ? `, ${escapeHtml(formatHostPendingSlotTime(slot))}` : ""
    }`,
    slot?.area_label ? `Where: ${escapeHtml(slot.area_label)}` : null,
    contacts.length > 0 ? contacts.join("\n") : null,
    invitee?.occupation ? `Occupation: ${escapeHtml(invitee.occupation)}` : null,
    invite.invitee_note ? `Note: ${escapeHtml(invite.invitee_note)}` : null,
  ].filter(Boolean);

  return lines.join("\n");
}

function formatHostPendingSlotTime(
  slot: NonNullable<HostPendingInviteRecord["slot"]>,
) {
  if (slot.time_start && slot.time_end) {
    return `${slot.time_start} - ${slot.time_end}`;
  }
  return timeBucketLabel(slot.time_bucket);
}

function formatTargetDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatShortDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function normalizeSocialHandle(value: string) {
  return value.trim().replace(/^@+/, "");
}

function instagramHtmlLink(value: string) {
  const handle = normalizeSocialHandle(value);
  const url = `https://instagram.com/${encodeURIComponent(handle)}`;
  return `<a href="${url}">@${escapeHtml(handle)}</a>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatHostVisibilityCallbackMessage(
  field: "public_profile_enabled" | "discovery_enabled",
  enabled: boolean,
) {
  if (field === "public_profile_enabled") {
    return enabled
      ? "Public profile is now visible."
      : "Public profile is now hidden.";
  }

  return enabled
    ? "Discovery is now enabled."
    : "Discovery is now disabled.";
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

function isHostSettingsText(text: string) {
  const normalized = text.trim().toLowerCase();
  return normalized === HOST_SETTINGS_LABEL.toLowerCase() ||
    normalized === HOST_PROFILE_LABEL.toLowerCase() ||
    normalized === "/settings" ||
    normalized === "/admin";
}

function isPendingInvitesText(text: string) {
  const normalized = text.trim().toLowerCase();
  return normalized === PENDING_INVITES_LABEL.toLowerCase() ||
    normalized === "/invites";
}

function isMyDatesText(text: string) {
  const normalized = text.trim().toLowerCase();
  return normalized === MY_DATES_LABEL.toLowerCase() ||
    normalized === LEGACY_ACCEPTED_INVITES_LABEL.toLowerCase() ||
    normalized === "/dates";
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
    option.pay_pref ? `💳 Pay: ${formatPayPreference(option.pay_pref)}` : null,
    option.notes ? `📝 ${option.notes}` : null,
  ].filter(Boolean);

  return details.map((detail) => `   ${escapeMarkdown(detail ?? "")}`).join(
    "\n",
  );
}

function formatSlotMarkdownBlock(option: DiscoverySlotOption, index: number) {
  const lines = formatSlotMarkdown(option, index);
  const details = formatSlotDetails(option);

  if (details) lines.push(details);
  return lines;
}

function formatSlotMarkdown(option: DiscoverySlotOption, index: number) {
  const headline = `${weekdayLabel(option.weekday)}, ${
    formatTimeLabel(option)
  }`;
  const lines = [
    `${index}\\. ${markdownBold(headline)}`,
    `   📍 ${escapeMarkdown(option.area_label || "Area TBD")}`,
  ];

  return lines;
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

function markdownBold(value: string) {
  return `*${escapeMarkdown(value)}*`;
}

function formatMarkdownQuote(value: string) {
  return value.split(/\r?\n/).map((line) => `> ${escapeMarkdown(line)}`);
}

function escapeMarkdown(value: string) {
  return value.replace(/([\\_*()[\]~`>#+\-=|{}.!])/g, "\\$1");
}

function escapeMarkdownUrl(value: string) {
  return value.replace(/([\\)])/g, "\\$1");
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
