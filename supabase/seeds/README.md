# Supabase Seeds

## Telegram Discovery Profiles

`telegram_discovery_profiles.mjs` creates synthetic Auth users, public profiles, active schedules, screening configs, and slots for Telegram discovery testing.

It uses the Supabase Auth Admin API, so it needs the service-role key. Do not put the service-role key in a `VITE_` variable or commit it.

```sh
SUPABASE_SERVICE_ROLE_KEY='...' npm run seed:telegram-discovery
```

The script loads `VITE_SUPABASE_URL` from `.env` automatically. You can also pass `SUPABASE_URL` explicitly.

After seeding, test Telegram with:

```txt
/start discover_codex96910493
```

The seed is repeatable: existing synthetic users/profiles/schedules/slots are updated rather than duplicated.
