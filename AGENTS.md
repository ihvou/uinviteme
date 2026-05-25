# Agent Notes

This file gives coding agents the project context needed to work safely. It links to the [README](README.md), [Architecture](docs/architecture.md), [User Journey Scenarios](docs/user-journeys.md), [Production MVP Tasks](tasks.md), and [Claude Notes](CLAUDE.md).

## Project Summary

uInvite.Me is an independently hosted Vite React app backed by Supabase. It is no longer dependent on Lovable for runtime hosting. Cloudflare Pages builds `dist` from GitHub and Supabase handles auth, data, storage, and future Edge Functions.

Primary product loop:

1. Host creates a public invite page.
2. Visitor submits an invite request.
3. Host accepts or declines.
4. Accepted invite becomes a Date.
5. Host can activate a Safety Pack.

Host auth supports email/password and Google Identity Services ID-token sign-in through Supabase Auth. Visitors do not need accounts for invite submission.

## Commands

Use npm, not Bun:

```sh
npm ci
npm run dev
npm run build
npm run preview
npm run lint
```

`npm run build` must pass before deployment work is considered safe.

## Deployment Facts

Cloudflare Pages settings:

```txt
Install command: npm ci
Build command: npm run build
Build output directory: dist
Root directory: /
Deploy command: empty
```

Do not re-add `bun.lockb` unless the project intentionally moves back to Bun. Do not add `wrangler.toml` for the current static Pages deployment without confirming the Cloudflare build behavior.

## Security Rules

- Treat Supabase publishable keys as browser-visible.
- Treat RLS as the database security boundary.
- Never expose service-role keys, Telegram bot tokens, SMS keys, payment keys, or CAPTCHA secret keys to the frontend.
- Future secrets belong in Supabase Function Secrets or provider dashboards, not Vite env vars.
- Public invite submission uses `submit-invite`; remaining hardening work belongs in [tasks.md](tasks.md).

## Current Backend Shape

Supabase Edge Functions are now part of the repo for trusted backend slices:

- `supabase/functions/telegram-webhook` handles visitor Telegram opt-in, discovery browsing, inline slot callbacks, and the current mock Telegram phone gate.
- `supabase/functions/create-telegram-link` creates short-lived host Telegram link tokens from authenticated Settings sessions.
- `supabase/functions/accept-invite` handles authenticated host accept/decline decisions and visitor Telegram notifications.
- `supabase/functions/submit-invite` handles public invite submission, server-side mock/Twilio phone verification checks, duplicate pending invite prevention, and invite creation.

Real phone verification activation and Safety Pack escalation still need to move from browser/database state into trusted Edge Functions.

When adding trusted backend behavior:

- Put Supabase Edge Functions under `supabase/functions/<name>/index.ts`.
- Keep shared function utilities inside `supabase/functions/_shared` if useful.
- Use Function Secrets for provider tokens.
- Prefer idempotent, transactional logic for invite acceptance and notifications.
- Twilio is the chosen MVP SMS provider: Verify for visitor OTP and Programmable Messaging for Safety Pack trusted-contact alerts. Keep Twilio behind a server-side provider module.

## Testing Expectations

For user-facing changes, test the full journey:

1. Host auth.
2. Profile setup.
3. Schedule setup.
4. Screening config.
5. Public invite submission.
6. Invite review.
7. Accept/decline.
8. Date detail.
9. Safety Pack.

For deployment changes, verify the live HTML references `/assets/index-*.js`, not `/src/main.tsx`, and that the JS bundle is served as `application/javascript`.

## Documentation Expectations

Keep these files in sync when architecture or flows change:

- [README](README.md)
- [Architecture](docs/architecture.md)
- [User Journey Scenarios](docs/user-journeys.md)
- [Production MVP Tasks](tasks.md)
- [Claude Notes](CLAUDE.md)

## Known Product Gaps

The highest priority gaps are tracked in [tasks.md](tasks.md). In short:

- Move public submit and accept flows server-side.
- Implement real Safety Pack notifications.
- Add CAPTCHA/rate limiting.
- Clean env handling.
- Continue moving trusted backend workflows into Supabase Edge Functions.
- Continue Telegram work beyond the implemented visitor discovery MVP: host administration, Twilio-backed visitor phone verification, Safety Pack check-ins, and trusted-contact escalation by SMS.
