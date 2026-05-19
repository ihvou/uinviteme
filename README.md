# uInvite.Me

uInvite.Me is a Vite, React, TypeScript, shadcn/ui, Tailwind, and Supabase application for turning dating chats into structured invite requests. A host publishes availability, expectations, and screening questions; a visitor requests a slot; the host accepts or declines; accepted invites become dates with a Safety Pack workflow.

The app was originally generated in Lovable, but the current runtime is independent:

- Frontend hosting: Cloudflare Pages
- Source control: GitHub repo `ihvou/uinviteme`
- Backend: Supabase Auth, Postgres, Storage, and future Edge Functions
- Production URL: <https://uinviteme.pages.dev/>

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
```

These publishable values are visible to browser users by design. Database security must come from Supabase Row Level Security policies. Never expose Supabase secret/service-role keys, Telegram bot tokens, SMS keys, payment keys, or other server secrets in frontend env vars.

For production, configure these values in Cloudflare Pages project settings. For future Supabase Edge Functions, store secrets with Supabase Function Secrets, not in Cloudflare frontend env vars.

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
