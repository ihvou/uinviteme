# uInvite.Me

uInvite.Me is a Vite, React, TypeScript, shadcn/ui, Tailwind, and Supabase application for turning dating chats into structured invite requests. A host publishes availability, expectations, and screening questions; a visitor requests a slot; the host accepts or declines; accepted invites become dates with a Safety Pack workflow.

The app was originally generated in Lovable, but the current runtime is independent:

- Frontend hosting: Cloudflare Pages
- Source control: GitHub repo `ihvou/uinviteme`
- Backend: Supabase Auth, Postgres, Storage, and Supabase Edge Functions
- Production URL: <https://uinvite.me/>

Host authentication supports Supabase email/password and Google Identity Services ID-token sign-in. Visitor invite submission remains accountless and uses phone verification instead of auth.

## Documentation

- [Architecture](docs/architecture.md)
- [User Journey Scenarios](docs/user-journeys.md)
- [Production MVP Tasks](tasks.md)
- [Agent Notes](AGENTS.md)
- [Claude Notes](CLAUDE.md)

## Current Product Surface

Implemented routes:

| Route | Purpose |
|---|---|
| `/` | Landing page |
| `/auth` | Host sign in/sign up |
| `/dashboard` | Host overview, invite links, status cards |
| `/settings` | Public profile, handle, city, bio, photo |
| `/schedule` | Availability slots and screening configuration |
| `/:handle` | Public profile invite page |
| `/i/:token` | Token invite page |
| `/invites` | Host review queue |
| `/dates` | Accepted dates |
| `/dates/:dateId` | Date detail |
| `/dates/:dateId/safety` | Safety Pack |
| `/demo/invite` | Static invite demo |
| `/demo/safety-pack` | Static Safety Pack demo |

## Local Development

Use npm. The stale Bun lockfile was removed because it caused Cloudflare Pages to choose Bun during dependency installation.

```sh
npm ci
npm run dev
```

Useful commands:

```sh
npm run build
npm run preview
npm run lint
```

`npm run build` is the deployment gate used by Cloudflare Pages.

## Environment

Frontend variables use Vite's `VITE_` prefix and are embedded into the browser bundle at build time:

```sh
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_PROJECT_ID=
VITE_GOOGLE_CLIENT_ID=
VITE_TELEGRAM_BOT_USERNAME=
VITE_PHONE_VERIFICATION_MODE=
```

These publishable values are visible to browser users by design. Database security must come from Supabase Row Level Security policies. Never expose Supabase secret/service-role keys, Telegram bot tokens, SMS keys, payment keys, or other server secrets in frontend env vars.

`VITE_GOOGLE_CLIENT_ID` is the public Google OAuth web client ID used by Google Identity Services on `/auth`. It is safe to expose in the browser. Google Client Secret still belongs only in Supabase's Google provider settings.

`VITE_TELEGRAM_BOT_USERNAME` is optional. When set, the public invite success screen deep-links visitors into Telegram for accepted-invite notifications and nearby discovery.

Set `VITE_PHONE_VERIFICATION_MODE=twilio` only after Twilio Function Secrets are configured, `PHONE_VERIFICATION_MODE=twilio` is set in Supabase Function Secrets, and the phone verification functions are deployed. When unset, the invite wizard keeps the current mock-code path for local/staging work.

For production, configure these values in Cloudflare Pages project settings. Store server-only values with Supabase Function Secrets, not in Cloudflare frontend env vars:

```sh
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
PUBLIC_SITE_URL=https://uinvite.me
PHONE_VERIFICATION_MODE=
MOCK_PHONE_CODE=
PHONE_VERIFICATION_TEST_CODE=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_VERIFY_SERVICE_SID=
TWILIO_MESSAGING_SERVICE_SID=
```

Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. Never add `TELEGRAM_BOT_TOKEN`, Twilio secrets, or the service-role key to a `VITE_` variable.

`PHONE_VERIFICATION_TEST_CODE` is an optional server-only QA override. When it is set, the phone verification functions can approve that fixed code alongside normal Twilio OTP checks, and unsupported/fake E.164 numbers can create a test challenge without sending SMS. Do not configure it as a `VITE_` variable.

## Google Auth

Google auth uses Google Identity Services in the browser and then signs into Supabase with `signInWithIdToken`. This avoids sending users through Supabase's OAuth authorize screen, so Google's consent UI is anchored to `uinvite.me` instead of the Supabase project domain.

Set this Cloudflare Pages variable:

```txt
VITE_GOOGLE_CLIENT_ID=<Google web client ID>
```

Google OAuth is otherwise configured in provider dashboards, not through Cloudflare secret env vars.

Google Cloud OAuth client:

```txt
Application type: Web application
Authorized JavaScript origins:
https://uinvite.me
https://uinviteme.pages.dev
http://localhost:5173

Authorized redirect URI, kept for Supabase provider compatibility and fallback tooling:
https://vvjgrvltnnqoiijoufry.supabase.co/auth/v1/callback
```

Supabase Dashboard:

```txt
Authentication > Providers > Google: enabled
Client ID: from Google Cloud
Client Secret: from Google Cloud

Authentication > URL Configuration > Site URL:
https://uinvite.me

Authentication > URL Configuration > Redirect URLs:
https://uinvite.me/**
https://uinviteme.pages.dev/**
http://localhost:5173/**
```

The `handle_new_user()` trigger reads Google `full_name`, `name`, `avatar_url`, and `picture` metadata when creating profile rows.

## Supabase Edge Functions

Committed functions:

| Function | Purpose | Status |
|---|---|---|
| `telegram-webhook` | Receives Telegram bot updates, verifies Telegram's webhook secret header, links `/start invite_updates_<invite>` chats to invitees, runs visitor discovery from `/start discover_<handle>` with Twilio-backed phone verification before invite links, and lets linked hosts accept/decline invites plus toggle public/discovery availability. | Local code and tests are in repo; deployed manually from CLI. |
| `create-telegram-link` | Authenticated host endpoint that creates a short-lived Telegram host-link payload for Settings. | Local code and tests are in repo; deploy with default JWT verification. |
| `accept-invite` | Authenticated host endpoint that accepts/declines invites, creates the date on accept, and notifies a Telegram-linked visitor. | Local code and tests are in repo; deployed manually from CLI with default JWT verification. |
| `submit-invite` | Public invite submission endpoint that validates schedule/slot/link, server-checks mock or Twilio phone verification, blocks duplicate pending invites, and creates invitee + invite records with the service role key. | Local code and tests are in repo; deploy before applying the direct-browser-write RLS cleanup migration. |
| `send-phone-otp` | Starts Twilio Verify SMS OTP for supported visitor phone numbers, with an optional server-only static-code QA challenge for fake/unsupported E.164 numbers. | Local code and tests are in repo; deploy after Twilio secrets are set. |
| `verify-phone-otp` | Checks Twilio Verify OTP and marks the server-side phone challenge approved; when `PHONE_VERIFICATION_TEST_CODE` is set, that fixed code is also accepted for QA. | Local code and tests are in repo; deploy after Twilio secrets are set. |

Useful commands:

```sh
deno test supabase/functions/telegram-webhook/handler.test.ts
deno test supabase/functions/create-telegram-link/handler.test.ts
deno test supabase/functions/accept-invite/handler.test.ts
deno test supabase/functions/submit-invite/handler.test.ts
deno test supabase/functions/send-phone-otp/handler.test.ts
deno test supabase/functions/verify-phone-otp/handler.test.ts
supabase secrets set TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... PUBLIC_SITE_URL=https://uinvite.me
supabase secrets set TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... TWILIO_VERIFY_SERVICE_SID=... TWILIO_MESSAGING_SERVICE_SID=...
supabase secrets set PHONE_VERIFICATION_TEST_CODE=...
supabase db push
supabase functions deploy telegram-webhook --no-verify-jwt
supabase functions deploy create-telegram-link
supabase functions deploy accept-invite
supabase functions deploy submit-invite --no-verify-jwt
supabase functions deploy send-phone-otp
supabase functions deploy verify-phone-otp
```

After deploy, configure BotFather/Telegram `setWebhook` to point at:

```txt
https://<project-ref>.supabase.co/functions/v1/telegram-webhook
```

Use the same `TELEGRAM_WEBHOOK_SECRET` value as Telegram's `secret_token`.

## Deployment

Cloudflare Pages settings:

```txt
Framework preset: Vite
Install command: npm ci
Build command: npm run build
Build output directory: dist
Root directory: /
Deploy command: empty
```

SPA fallback routing is provided by [public/_redirects](public/_redirects):

```txt
/* /index.html 200
```

Do not add `wrangler.toml` for the current static Pages deployment unless the Cloudflare project is intentionally moved to a Wrangler-managed setup. In this repo, `wrangler.toml` previously caused Cloudflare to skip the build command and fail because `dist` had not been generated.

## Regression Checklist

Before calling a deployment healthy, smoke test:

1. Landing page renders and has no module MIME errors.
2. `/dashboard` redirects signed-out users to `/auth`.
3. Host can sign up/sign in.
4. Host can set handle, city, bio, and public profile.
5. Host can add an availability slot and activate the schedule.
6. Host can enable at least one screening question.
7. Visitor can open `/:handle`, choose a slot, answer screening, and submit.
8. Host sees the pending invite.
9. Host accepts the invite and a Date is created.
10. Date detail shows invitee contact and screening answers.
11. Safety Pack draft opens and can be activated.

Known implementation work is tracked in [tasks.md](tasks.md).
