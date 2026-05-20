import { handleTelegramWebhookRequest } from "./handler.ts";

Deno.serve(handleTelegramWebhookRequest);
