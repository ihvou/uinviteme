# Claude Notes

Read [AGENTS.md](AGENTS.md) first. This file adds Claude-specific orientation and links back to the core docs: [README](README.md), [Architecture](docs/architecture.md), [User Journey Scenarios](docs/user-journeys.md), and [Production MVP Tasks](tasks.md).

## What This App Is

uInvite.Me lets a host publish a public invite page with availability and screening questions. Visitors request a slot without creating an account. Hosts review requests, accept or decline, and use Safety Pack tooling for accepted dates.

Host auth uses Supabase email/password and Google Identity Services ID-token sign-in. Visitor identity is still handled through invite details and phone verification, not visitor accounts.

## Current Runtime

- Frontend: Vite React app hosted on Cloudflare Pages.
- Backend: Supabase Auth, Postgres with RLS, Storage, and committed Supabase Edge Functions.
- Lovable is no longer required for runtime hosting.

## High-Signal Files

| File | Why it matters |
|---|---|
| `src/App.tsx` | Route map |
| `src/hooks/useAuth.tsx` | Auth session logic |
| `src/hooks/usePublicInviteByHandle.tsx` | Public profile invite flow |
| `src/hooks/usePublicInvite.tsx` | Token invite flow |
| `src/hooks/useSchedule.tsx` | Schedule and slot data |
| `src/hooks/useScreeningConfig.tsx` | Screening config |
| `src/hooks/useSafetyPack.tsx` | Safety Pack state |
| `src/pages/Invites.tsx` | Host accept/decline flow |
| `supabase/migrations/*` | Database schema and RLS |
| `tasks.md` | Production MVP blockers |

## Safe Defaults

- Use npm commands.
- Keep Cloudflare as the frontend host.
- Keep Supabase as the backend.
- Prefer small, workflow-oriented changes.
- Do not move logic to another framework unless the user explicitly asks.
- Do not put secrets in frontend env vars.

## Telegram Bot Direction

Telegram is feasible inside Supabase using an Edge Function webhook. Treat it as a host admin, visitor notification/discovery, and Safety Pack check-in surface, not a separate source of workflow truth.

Current and future files:

```txt
supabase/functions/telegram-webhook/index.ts
supabase/functions/telegram-webhook/handler.ts
supabase/functions/create-telegram-link/index.ts
supabase/functions/create-telegram-link/handler.ts
supabase/functions/accept-invite/index.ts
supabase/functions/accept-invite/handler.ts
supabase/functions/submit-invite/index.ts
supabase/functions/submit-invite/handler.ts
supabase/functions/_shared/telegram.ts
supabase/functions/_shared/sms.ts
supabase/functions/_shared/supabaseAdmin.ts
```

The webhook validates Telegram's secret header, maps visitor invite-update starts to opted-in invitees, links host admin chats through short-lived Settings tokens, runs the visitor discovery MVP (`/start discover_<handle>`, one-profile-at-a-time browsing, Skip/Invite, manual city, Telegram location, photo cards, inline slot selection, and mock phone gate), and lets linked hosts accept/decline invite requests plus toggle public/discovery visibility. Future safety handlers should call the same trusted backend functions used by the web app.

Twilio is the MVP SMS provider decision: Twilio Verify for visitor OTP and Twilio Programmable Messaging for Safety Pack trusted-contact alerts. Keep Twilio credentials in Supabase Function Secrets only.

## Before Finalizing Work

For code changes, run:

```sh
npm run build
```

For deployment-sensitive changes, also verify:

- Cloudflare serves built assets from `/assets`.
- Deep links reload because `public/_redirects` exists.
- The tested journey still matches [User Journey Scenarios](docs/user-journeys.md).

## Related Docs

- [Agent Notes](AGENTS.md)
- [README](README.md)
- [Architecture](docs/architecture.md)
- [User Journey Scenarios](docs/user-journeys.md)
- [Production MVP Tasks](tasks.md)
