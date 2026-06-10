// v13 acceptance-profile seed.
//
// Inserts 115 synthetic host profiles from the v13 persona dataset into the
// live Supabase project so they appear on /:handle (web) and in the
// `/start discover_<handle>` Telegram flow.
//
// Synthetic users are NOT meant to be loggable. We create their auth row
// (the `profiles` table FKs auth.users) with a random crypto-generated
// password that is never stored or logged. They can never sign in unless
// someone runs a password reset against their @example.test email.
//
// Idempotent: stable UUIDs derived from persona id, so re-running upserts
// rather than duplicates. Slots use the same deterministic UUID scheme.
//
// Usage:
//   SUPABASE_SERVICE_ROLE_KEY='...' node supabase/seeds/v13_acceptance_profiles.mjs
//
// Flags:
//   --dry-run         log what would happen, write nothing
//   --only=<ids>      comma-separated persona ids to seed (e.g. dxb-001,dxb-002)
//   --skip-upload     skip avatar storage upload (useful when re-running)
//
// Reads:
//   tmp/acceptance-personas-20260605-v13-beauty-anchor/personas.review.json
//   tmp/acceptance-photo-sample-v13-beauty-anchor-*/<id>/<id>-identity-reference.jpg
//   tmp/acceptance-photo-sample-v13-beauty-anchor-*/<id>/<id>-NN-*.jpg
//
// Writes (per persona):
//   auth.users row
//   storage://avatars/<profile_id>/<n>.jpg
//   profiles row (public_profile_enabled=true, discovery_enabled=true)
//   profile_photos rows for identity reference + storyboard photos
//   schedules row (is_active=true)
//   screening_configs row
//   3-4 slots rows

import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

loadDotEnv();

const ARGS = parseArgs(process.argv.slice(2));
const DRY_RUN = ARGS.has("dry-run");
const SKIP_UPLOAD = ARGS.has("skip-upload");
const ONLY = (ARGS.get("only") || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
  );
  console.error(
    "Run: SUPABASE_SERVICE_ROLE_KEY='...' node supabase/seeds/v13_acceptance_profiles.mjs",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// Load v13 personas + locate the chosen identity/storyboard photos.
// ---------------------------------------------------------------------------

const sourcePath = "tmp/acceptance-personas-20260605-v13-beauty-anchor/personas.review.json";
const source = JSON.parse(readFileSync(sourcePath, "utf8"));
const allPersonas = source.personas;

const personaPhotoLookup = buildPhotoLookup();

function buildPhotoLookup() {
  // Scan all v13 sample directories from oldest to newest; the latest
  // directory containing a given persona id wins.
  const root = path.resolve("tmp");
  const dirs = readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith("acceptance-photo-sample-v13-beauty-anchor-"))
    .map((e) => e.name)
    .sort(); // ISO timestamps sort chronologically

  const lookup = new Map();
  for (const dir of dirs) {
    const personaDirs = readdirSync(path.join(root, dir), { withFileTypes: true })
      .filter((e) => e.isDirectory());
    for (const pd of personaDirs) {
      const personaDir = path.join(root, dir, pd.name);
      const refPath = path.join(personaDir, `${pd.name}-identity-reference.jpg`);
      const storyboards = readdirSync(personaDir)
        .filter((fileName) =>
          new RegExp(`^${pd.name}-\\d{2}-.*\\.(jpe?g|png|webp)$`, "i").test(fileName)
        )
        .sort()
        .map((fileName) => path.join(personaDir, fileName));

      if (existsSync(refPath) || storyboards.length > 0) {
        lookup.set(pd.name, {
          identity: existsSync(refPath) ? refPath : null,
          storyboards,
        });
      }
    }
  }
  return lookup;
}

// ---------------------------------------------------------------------------
// Area lat/lng lookup (used for slot geolocation).
// ---------------------------------------------------------------------------

const cityCenters = {
  Dubai: { lat: 25.2048, lng: 55.2708, tz: "Asia/Dubai", cc: "AE" },
  "Abu Dhabi": { lat: 24.4539, lng: 54.3773, tz: "Asia/Dubai", cc: "AE" },
  Singapore: { lat: 1.3521, lng: 103.8198, tz: "Asia/Singapore", cc: "SG" },
  Istanbul: { lat: 41.0082, lng: 28.9784, tz: "Europe/Istanbul", cc: "TR" },
};

const areaCoords = {
  // Dubai
  "DIFC": { lat: 25.2138, lng: 55.2796 },
  "Jumeirah": { lat: 25.2048, lng: 55.2449 },
  "Dubai Marina": { lat: 25.08, lng: 55.14 },
  "Downtown": { lat: 25.1972, lng: 55.2744 },
  "Business Bay": { lat: 25.1853, lng: 55.2636 },
  "Alserkal": { lat: 25.1413, lng: 55.2266 },
  "Bluewaters": { lat: 25.0772, lng: 55.1226 },
  "City Walk": { lat: 25.2056, lng: 55.2622 },
  "JLT": { lat: 25.0707, lng: 55.1432 },
  "Palm Jumeirah": { lat: 25.1124, lng: 55.139 },
  // Abu Dhabi
  "Al Bateen": { lat: 24.4539, lng: 54.3373 },
  "Al Maryah": { lat: 24.5012, lng: 54.3884 },
  "Al Qana": { lat: 24.4163, lng: 54.5167 },
  "Corniche": { lat: 24.4761, lng: 54.3567 },
  "Hudayriyat": { lat: 24.4262, lng: 54.4063 },
  "Mina Zayed": { lat: 24.5279, lng: 54.3766 },
  "Saadiyat": { lat: 24.542, lng: 54.4349 },
  "Yas Bay": { lat: 24.4672, lng: 54.6067 },
  // Singapore
  "Ann Siang": { lat: 1.2809, lng: 103.8468 },
  "Arab Street": { lat: 1.3012, lng: 103.8592 },
  "Dempsey": { lat: 1.3045, lng: 103.8109 },
  "Joo Chiat": { lat: 1.3151, lng: 103.9013 },
  "Katong": { lat: 1.3052, lng: 103.9051 },
  "Keong Saik": { lat: 1.2801, lng: 103.8417 },
  "Marina Bay": { lat: 1.283, lng: 103.86 },
  "Orchard": { lat: 1.3048, lng: 103.8318 },
  "Robertson Quay": { lat: 1.2906, lng: 103.8399 },
  "Tiong Bahru": { lat: 1.2848, lng: 103.8336 },
  // Istanbul
  "Arnavutkoy": { lat: 41.0656, lng: 29.0411 },
  "Balat": { lat: 41.0298, lng: 28.9489 },
  "Bebek": { lat: 41.0779, lng: 29.0429 },
  "Besiktas": { lat: 41.0428, lng: 29.0066 },
  "Cihangir": { lat: 41.0337, lng: 28.9826 },
  "Galata": { lat: 41.0256, lng: 28.974 },
  "Kadikoy": { lat: 40.9909, lng: 29.0303 },
  "Karakoy": { lat: 41.0244, lng: 28.9749 },
  "Moda": { lat: 40.9856, lng: 29.025 },
  "Nisantasi": { lat: 41.0498, lng: 28.9912 },
};

function coordsFor(area, cityLabel) {
  return areaCoords[area] || cityCenters[cityLabel] || { lat: 0, lng: 0 };
}

// ---------------------------------------------------------------------------
// Stable UUID generation (deterministic per persona id).
// ---------------------------------------------------------------------------

function stableUuid(...parts) {
  const hash = createHash("sha256").update(parts.join(":")).digest("hex");
  // Format as UUID v4-shaped: 8-4-4-4-12 with version 4 nibble set.
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    "4" + hash.slice(13, 16),
    "8" + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join("-");
}

function userIdFor(personaId) {
  return stableUuid("v13", "user", personaId);
}

function scheduleIdFor(personaId) {
  return stableUuid("v13", "schedule", personaId);
}

function slotIdFor(personaId, slotIndex) {
  return stableUuid("v13", "slot", personaId, String(slotIndex));
}

// ---------------------------------------------------------------------------
// Per-persona row builders.
// ---------------------------------------------------------------------------

function buildSlotsFor(persona) {
  const prefs = persona.invite_preferences || {};
  const areas = (prefs.preferred_areas || []).slice(0, 4);
  if (!areas.length) areas.push(persona.city_label);

  const timeBucket = prefs.preferred_time_bucket && ["morning", "afternoon", "early_evening", "late_evening"].includes(prefs.preferred_time_bucket)
    ? prefs.preferred_time_bucket
    : "early_evening";
  const payPref = ["split", "treat", "decide_together"].includes(prefs.pay_pref) ? prefs.pay_pref : "decide_together";

  // Spread slots across distinct weekdays. Use a deterministic offset so
  // different personas get different weekday combinations.
  const seed = parseInt(createHash("sha256").update(persona.id).digest("hex").slice(0, 8), 16);
  const weekdayPool = [1, 2, 3, 4, 5, 6, 0]; // Mon-Sun rotation
  const slotCount = Math.min(areas.length, 4);

  const slots = [];
  for (let i = 0; i < slotCount; i += 1) {
    const area = areas[i] || areas[0];
    const weekday = weekdayPool[(seed + i * 3) % weekdayPool.length];
    const coords = coordsFor(area, persona.city_label);
    slots.push({
      id: slotIdFor(persona.id, i),
      schedule_id: scheduleIdFor(persona.id),
      weekday,
      time_bucket: timeBucket,
      area_label: area,
      area_lat: coords.lat,
      area_lng: coords.lng,
      pay_pref: payPref,
      notes: null,
      is_active: true,
      updated_at: new Date().toISOString(),
    });
  }
  return slots;
}

function buildProfileRow(persona, photoUrl) {
  const pub = persona.public_profile;
  const internal = persona.internal_review || {};
  const city = cityCenters[persona.city_label] || { tz: "UTC", cc: null };
  const acceptedChannel = ["telegram", "instagram"].includes(internal.accepted_contact_channel)
    ? internal.accepted_contact_channel
    : "telegram";

  return {
    id: userIdFor(persona.id),
    handle: pub.handle,
    display_name: pub.display_name,
    photo_url: photoUrl,
    age: pub.age,
    city_label: persona.city_label,
    bio_one_liner: pub.bio_one_liner,
    public_profile_enabled: true,
    trusted_contacts_phones: [],
    timezone: persona.timezone || city.tz,
    locale: "en-US",
    country_code: persona.country_code || city.cc,
    notify_channel: "telegram",
    region_mode: "row",
    instagram_handle: internal.instagram_handle || pub.handle,
    discovery_enabled: true,
    accepted_contact_channel: acceptedChannel,
    updated_at: new Date().toISOString(),
  };
}

function buildScheduleRow(persona) {
  return {
    id: scheduleIdFor(persona.id),
    user_id: userIdFor(persona.id),
    mode: "rolling_7_days",
    is_active: true,
    updated_at: new Date().toISOString(),
  };
}

function buildScreeningRow(persona) {
  const sc = persona.screening_config || {};
  return {
    schedule_id: scheduleIdFor(persona.id),
    require_phone: sc.require_phone ?? true,
    allow_instagram: sc.allow_instagram ?? true,
    allow_telegram: sc.allow_telegram ?? true,
    require_selfie: sc.require_selfie ?? false,
    enabled_questions: sc.enabled_questions || [],
    auto_decline_rules: sc.auto_decline_rules || {},
    allow_invitee_note: sc.allow_invitee_note ?? true,
    require_instagram: sc.require_instagram ?? false,
    require_telegram: sc.require_telegram ?? false,
    updated_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Operations.
// ---------------------------------------------------------------------------

async function ensureAuthUser(persona) {
  const userId = userIdFor(persona.id);
  const email = `${persona.public_profile.handle}@v13-acceptance.test`;
  const displayName = persona.public_profile.display_name;

  const { data: existing } = await supabase.auth.admin.getUserById(userId);
  if (existing?.user) {
    if (DRY_RUN) {
      console.log(`  [dry] auth user ${userId} (${email}) already exists`);
      return;
    }
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      email,
      email_confirm: true,
      user_metadata: {
        display_name: displayName,
        seed: "v13_acceptance",
        persona_id: persona.id,
      },
    });
    if (error) throw new Error(`update auth user ${persona.id}: ${error.message}`);
    return;
  }

  if (DRY_RUN) {
    console.log(`  [dry] create auth user ${userId} (${email})`);
    return;
  }

  // Random password that is never stored or returned. Auth row exists, but
  // login is impossible without a password reset.
  const password = randomBytes(48).toString("base64url");

  const { error } = await supabase.auth.admin.createUser({
    id: userId,
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: displayName,
      seed: "v13_acceptance",
      persona_id: persona.id,
    },
  });
  if (error) throw new Error(`create auth user ${persona.id}: ${error.message}`);
}

async function uploadProfilePhotos(persona) {
  if (SKIP_UPLOAD) return { primaryUrl: null, rows: [] };
  const photoSet = personaPhotoLookup.get(persona.id);
  const photoPaths = [
    photoSet?.identity,
    ...(photoSet?.storyboards || []),
  ].filter(Boolean).slice(0, 4);

  if (!photoPaths.length) {
    console.warn(`  ${persona.id}: no profile photos found, skipping upload`);
    return { primaryUrl: null, rows: [] };
  }

  const profileId = userIdFor(persona.id);
  const rows = [];
  let primaryUrl = null;

  for (const [index, filePath] of photoPaths.entries()) {
    const storagePath = `${profileId}/${index + 1}.jpg`;
    const contentType = contentTypeFor(filePath);

    if (DRY_RUN) {
      console.log(`  [dry] upload ${filePath} -> avatars/${storagePath}`);
    } else {
      const buffer = readFileSync(filePath);
      const { error } = await supabase.storage.from("avatars").upload(storagePath, buffer, {
        contentType,
        upsert: true,
      });
      if (error) throw new Error(`upload ${persona.id} photo ${index + 1}: ${error.message}`);
    }

    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(storagePath);
    if (index === 0) primaryUrl = pub.publicUrl;
    rows.push({
      profile_id: profileId,
      storage_path: storagePath,
      sort_order: index,
    });
  }

  return { primaryUrl, rows };
}

function contentTypeFor(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  return "image/jpeg";
}

async function replaceProfilePhotos(profileId, rows) {
  if (DRY_RUN) {
    console.log(`  [dry] replace profile_photos (${rows.length} rows) for ${profileId}`);
    return;
  }

  const { error: deleteError } = await supabase
    .from("profile_photos")
    .delete()
    .eq("profile_id", profileId);
  if (deleteError) throw new Error(`delete profile_photos ${profileId}: ${deleteError.message}`);

  if (rows.length === 0) return;

  const { error } = await supabase.from("profile_photos").upsert(rows, {
    onConflict: "profile_id,sort_order",
  });
  if (error) throw new Error(`upsert profile_photos ${profileId}: ${error.message}`);
}

async function upsert(table, rows, onConflict) {
  if (DRY_RUN) {
    console.log(`  [dry] upsert ${table} (${rows.length} rows) onConflict=${onConflict}`);
    return;
  }
  const { error } = await supabase.from(table).upsert(rows, { onConflict });
  if (error) throw new Error(`upsert ${table}: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Main loop.
// ---------------------------------------------------------------------------

async function seedPersona(persona) {
  await ensureAuthUser(persona);
  const { primaryUrl, rows: photoRows } = await uploadProfilePhotos(persona);
  const profileRow = buildProfileRow(persona, primaryUrl);
  await upsert("profiles", [profileRow], "id");
  await replaceProfilePhotos(profileRow.id, photoRows);
  await upsert("schedules", [buildScheduleRow(persona)], "user_id");
  await upsert("screening_configs", [buildScreeningRow(persona)], "schedule_id");
  await upsert("slots", buildSlotsFor(persona), "id");
}

async function main() {
  const personas = ONLY.length
    ? allPersonas.filter((p) => ONLY.includes(p.id))
    : allPersonas;

  console.log(
    `${DRY_RUN ? "[DRY RUN] " : ""}Seeding ${personas.length} v13 acceptance profiles into ${supabaseUrl}`,
  );
  console.log(`Photos available for ${personaPhotoLookup.size}/${allPersonas.length} personas`);
  if (personaPhotoLookup.size < personas.length) {
    const missing = personas.filter((p) => !personaPhotoLookup.has(p.id)).map((p) => p.id);
    console.log(`  Missing photos for: ${missing.slice(0, 10).join(", ")}${missing.length > 10 ? "..." : ""}`);
  }
  console.log("");

  let ok = 0;
  let failed = 0;
  for (const persona of personas) {
    process.stdout.write(`${persona.id} (${persona.public_profile.display_name}, ${persona.city_label})... `);
    try {
      await seedPersona(persona);
      console.log("ok");
      ok += 1;
    } catch (error) {
      console.log(`FAILED: ${error.message}`);
      failed += 1;
    }
  }

  console.log("");
  console.log(`Done. ${ok} succeeded, ${failed} failed.`);
  if (DRY_RUN) console.log("(dry run — no writes were performed)");
  else {
    console.log("Public profiles available at:");
    for (const persona of personas.slice(0, 5)) {
      console.log(`  https://uinvite.me/${persona.public_profile.handle}`);
    }
    if (personas.length > 5) console.log(`  ... and ${personas.length - 5} more`);
  }
}

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const map = new Map();
  for (const arg of argv) {
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq > -1) map.set(arg.slice(2, eq), arg.slice(eq + 1));
      else map.set(arg.slice(2), true);
    }
  }
  // Provide a .has() method that mirrors Set semantics for boolean flags.
  map.has = function (k) {
    return Map.prototype.has.call(this, k) && this.get(k) === true;
  };
  return map;
}

function loadDotEnv() {
  const envFile = ".env";
  if (!existsSync(envFile)) return;
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^['"]/, "").replace(/['"]$/, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

await main();
