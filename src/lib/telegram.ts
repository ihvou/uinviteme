const TELEGRAM_START_MAX_LENGTH = 64;

export function getTelegramBotUsername() {
  const rawUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined;
  const username = rawUsername?.trim().replace(/^@+/, '');

  return username || null;
}

export function getTelegramStartUrl(startPayload: string) {
  const username = getTelegramBotUsername();

  if (!username) return null;

  const safePayload = startPayload
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, TELEGRAM_START_MAX_LENGTH);

  return `https://t.me/${username}?start=${safePayload}`;
}
