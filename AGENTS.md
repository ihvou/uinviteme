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

Host public profiles support an ordered 1-4 photo gallery in `profile_photos` backed by the public `avatars` storage bucket. `profiles.photo_url` remains the primary-photo fallback for older profiles and OAuth avatars.

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

Supabase production deploys are automated by `.github/workflows/deploy-supabase.yml` for pushes to `main` that touch `supabase/**` or the workflow. The workflow expects GitHub repository secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, and `SUPABASE_PROJECT_ID`.

Do not re-add `bun.lockb` unless the project intentionally moves back to Bun. Do not add `wrangler.toml` for the current static Pages deployment without confirming the Cloudflare build behavior.

## Security Rules

- Treat Supabase publishable keys as browser-visible.
- Treat RLS as the database security boundary.
- Never expose service-role keys, Telegram bot tokens, SMS keys, payment keys, or CAPTCHA secret keys to the frontend.
- Future secrets belong in Supabase Function Secrets or provider dashboards, not Vite env vars.
- Public invite submission uses `submit-invite`; remaining hardening work belongs in [tasks.md](tasks.md).

## Current Backend Shape

Supabase Edge Functions are now part of the repo for trusted backend slices:

- `supabase/functions/telegram-webhook` handles visitor Telegram opt-in, discovery browsing with profile photo media groups, inline slot callbacks, host invite/date admin, host public/discovery visibility toggles, Twilio-backed Telegram discovery phone verification, and Safety Pack check-in callbacks.
- `supabase/functions/create-telegram-link` creates short-lived host Telegram link tokens from authenticated Settings sessions.
- `supabase/functions/set-telegram-host-notifications` lets a linked host pause or resume Telegram invite notifications from the web UI.
- `supabase/functions/accept-invite` handles authenticated host accept/decline decisions and visitor Telegram notifications.
- `supabase/functions/activate-safety-pack`, `ack-safety-pack`, `safety-alert`, and `safety-checkin-reminder` handle Safety Pack activation, check-in actions, emergency/missed-check-in SMS alerts, and scheduled reminder processing.
- `supabase/functions/submit-invite` handles public invite submission, server-side mock/Twilio phone verification checks, duplicate pending invite prevention, and invite creation.
- `supabase/functions/send-phone-otp` and `supabase/functions/verify-phone-otp` handle Twilio Verify OTP plus the optional server-only `PHONE_VERIFICATION_TEST_CODE` QA override.
- `.github/workflows/safety-checkin-reminder.yml` invokes `safety-checkin-reminder` every five minutes. It needs the GitHub `SAFETY_CRON_SECRET` repository secret to match the Supabase Function Secret.

Real phone verification and Safety Pack escalation now have trusted Edge Function paths. Trusted contacts live in the private `trusted_contacts` table, not as new writes to `profiles.trusted_contacts_phones`. Remaining Safety Pack work is staging SMS verification and delivery-status callbacks.

When adding trusted backend behavior:

- Put Supabase Edge Functions under `supabase/functions/<name>/index.ts`.
- Keep shared function utilities inside `supabase/functions/_shared` if useful.
- Use Function Secrets for provider tokens.
- Keep `PHONE_VERIFICATION_TEST_CODE` in Supabase Function Secrets only; it is for QA and must never be exposed as a `VITE_` variable.
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
- Configure GitHub/Supabase `SAFETY_CRON_SECRET` matching and verify real Safety Pack SMS scheduling.
- Add CAPTCHA/rate limiting.
- Clean env handling.
- Continue moving trusted backend workflows into Supabase Edge Functions.
- Continue Telegram work beyond the implemented visitor discovery, host administration, date list, and Safety Pack MVPs: trusted Telegram-origin invite creation and richer safety operations.
