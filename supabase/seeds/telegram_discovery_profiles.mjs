import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";

loadDotEnv();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
  );
  console.error(
    "Run: SUPABASE_SERVICE_ROLE_KEY='...' npm run seed:telegram-discovery",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const profiles = [
  profile(1, "maya-sg", "Maya Tan", 29, "Singapore", "SG", "Asia/Singapore", "Coffee-first strategist who likes gallery openings, low-key jazz, and a walk by the water after dinner.", "https://randomuser.me/api/portraits/women/44.jpg", "maya.tan", "instagram"),
  profile(2, "nora-sg", "Nora Lim", 31, "Singapore", "SG", "Asia/Singapore", "Product designer, bookstore browser, and always up for a sharp mocktail somewhere with good lighting.", "https://randomuser.me/api/portraits/women/68.jpg", "noralim", "instagram"),
  profile(3, "lina-sg", "Lina Park", 27, "Singapore", "SG", "Asia/Singapore", "Runs on matcha, indie films, and thoughtful conversation that does not feel like an interview.", "https://randomuser.me/api/portraits/women/65.jpg", "linapark", "telegram"),
  profile(4, "sofia-sg", "Sofia Reyes", 33, "Singapore", "SG", "Asia/Singapore", "Architect by day, salsa beginner by night, happiest around clever food and unforced chemistry.", "https://randomuser.me/api/portraits/women/12.jpg", "sofia.reyes", "instagram"),
  profile(5, "aisha-sg", "Aisha Rahman", 30, "Singapore", "SG", "Asia/Singapore", "Policy researcher, museum wanderer, and believer that the best dates leave room for curiosity.", "https://randomuser.me/api/portraits/women/30.jpg", "aisharahman", "telegram"),
  profile(6, "priya-sg", "Priya Nair", 28, "Singapore", "SG", "Asia/Singapore", "Founder-mode during the week, slow dinners and rooftop conversations when the calendar finally breathes.", "https://randomuser.me/api/portraits/women/26.jpg", "priyanair", "instagram"),
  profile(7, "hana-sg", "Hana Cho", 26, "Singapore", "SG", "Asia/Singapore", "Food writer who appreciates punctuality, playful banter, and anyone with a strong noodle opinion.", "https://randomuser.me/api/portraits/women/21.jpg", "hanacho", "instagram"),
  profile(8, "daria-sg", "Daria Volkov", 32, "Singapore", "SG", "Asia/Singapore", "Data lead, former pianist, fond of wine bars, quiet confidence, and conversations with a real point of view.", "https://randomuser.me/api/portraits/women/37.jpg", "dariav", "telegram"),
  profile(9, "chloe-sg", "Chloe Martin", 34, "Singapore", "SG", "Asia/Singapore", "French-Kiwi brand consultant, fond of design hotels, tiny restaurants, and people who ask better questions.", "https://randomuser.me/api/portraits/women/50.jpg", "chloemartin", "instagram"),
  profile(10, "meilin-sg", "Mei Lin Wong", 29, "Singapore", "SG", "Asia/Singapore", "VC analyst, weekend ceramicist, and quietly serious about choosing the right dessert.", "https://randomuser.me/api/portraits/women/72.jpg", "meilinw", "telegram"),
  profile(11, "olivia-sg", "Olivia Chen", 31, "Singapore", "SG", "Asia/Singapore", "Lawyer with a soft spot for live music, smart humor, and dates that are planned but not overproduced.", "https://randomuser.me/api/portraits/women/76.jpg", "oliviachen", "instagram"),
  profile(12, "yasmin-sg", "Yasmin Noor", 27, "Singapore", "SG", "Asia/Singapore", "Creative producer, beach-walk loyalist, and happiest when the plan has one unexpected stop.", "https://randomuser.me/api/portraits/women/79.jpg", "yasminnoor", "telegram"),
  profile(13, "leila-dxb", "Leila Haddad", 30, "Dubai", "AE", "Asia/Dubai", "Hospitality strategist, sunset chaser, and always interested in a well-chosen restaurant with a view.", "https://randomuser.me/api/portraits/women/33.jpg", "leilahaddad", "instagram"),
  profile(14, "farah-dxb", "Farah Khan", 28, "Dubai", "AE", "Asia/Dubai", "Pilates regular, fintech operator, and fan of low-noise places where conversation can actually land.", "https://randomuser.me/api/portraits/women/46.jpg", "farahk", "telegram"),
  profile(15, "amira-dxb", "Amira Saleh", 35, "Dubai", "AE", "Asia/Dubai", "Art advisor who likes Alserkal afternoons, precise dinner plans, and people who can laugh at themselves.", "https://randomuser.me/api/portraits/women/49.jpg", "amirasaleh", "instagram"),
  profile(16, "nadia-dxb", "Nadia Mansour", 32, "Dubai", "AE", "Asia/Dubai", "Consultant, reader, and quietly competitive backgammon player looking for warm, intentional energy.", "https://randomuser.me/api/portraits/women/53.jpg", "nadiamansour", "telegram"),
  profile(17, "elif-ist", "Elif Demir", 29, "Istanbul", "TR", "Europe/Istanbul", "Documentary producer, ferry loyalist, and very pro coffee dates that accidentally become dinner.", "https://randomuser.me/api/portraits/women/57.jpg", "elifdemir", "instagram"),
  profile(18, "zeynep-ist", "Zeynep Kaya", 31, "Istanbul", "TR", "Europe/Istanbul", "UX researcher, old-city walker, and fond of people who can be direct without being sharp.", "https://randomuser.me/api/portraits/women/58.jpg", "zeynepkaya", "telegram"),
  profile(19, "reem-auh", "Reem Al Nuaimi", 33, "Abu Dhabi", "AE", "Asia/Dubai", "Curator, morning swimmer, and collector of calm restaurants with excellent service and no rush.", "https://randomuser.me/api/portraits/women/60.jpg", "reemaln", "instagram"),
  profile(20, "sara-auh", "Sara Khalil", 27, "Abu Dhabi", "AE", "Asia/Dubai", "Healthcare founder, gallery weekend regular, and always happier when a plan includes dessert.", "https://randomuser.me/api/portraits/women/62.jpg", "sarakhalil", "telegram"),
];

const slots = [
  slot(1, 1, 2, "early_evening", "Tiong Bahru wine bar", 1.2848, 103.8336, "decide_together", "Natural wine or a quiet bistro near Tiong Bahru."),
  slot(2, 1, 5, "late_evening", "Robertson Quay", 1.2906, 103.8399, "split", "Late drinks by the river if the chat has momentum."),
  slot(3, 2, 3, "early_evening", "Ann Siang Hill", 1.2809, 103.8468, "decide_together", "Cocktails or a small-plates dinner around Ann Siang."),
  slot(4, 2, 6, "afternoon", "Joo Chiat", 1.3151, 103.9013, "split", "Coffee, design shops, and a walk through Joo Chiat."),
  slot(5, 3, 4, "early_evening", "Dempsey Hill", 1.3045, 103.8109, "decide_together", "Easy dinner at Dempsey, preferably somewhere leafy."),
  slot(6, 3, 0, "morning", "Botanic Gardens", 1.3138, 103.8159, "split", "Morning coffee and a walk if you are allergic to loud brunch."),
  slot(7, 4, 1, "early_evening", "Holland Village", 1.3114, 103.7963, "decide_together", "A relaxed dinner and a drink around Holland Village."),
  slot(8, 4, 5, "late_evening", "Keong Saik", 1.2801, 103.8417, "split", "Late bar hop, but only if the first place is genuinely good."),
  slot(9, 5, 2, "early_evening", "Marina Bay", 1.283, 103.86, "decide_together", "Dinner with a skyline view, then a walk by the water."),
  slot(10, 5, 6, "afternoon", "National Gallery", 1.2905, 103.8519, "split", "Gallery first, coffee after, opinions encouraged."),
  slot(11, 6, 3, "early_evening", "Orchard", 1.3048, 103.8318, "decide_together", "Dinner near Orchard, calm over flashy."),
  slot(12, 6, 0, "afternoon", "Tanglin", 1.3066, 103.8158, "split", "Coffee and a slow Sunday afternoon."),
  slot(13, 7, 4, "late_evening", "Katong", 1.3052, 103.9051, "decide_together", "Supper in Katong, bonus points for good laksa takes."),
  slot(14, 7, 6, "morning", "East Coast Park", 1.3008, 103.9122, "split", "Beach walk and coffee without performative brunch chaos."),
  slot(15, 8, 2, "early_evening", "Bugis", 1.3008, 103.8557, "decide_together", "Dinner near Bugis and maybe live music after."),
  slot(16, 8, 5, "late_evening", "Arab Street", 1.3012, 103.8592, "split", "A late drink around Arab Street, somewhere we can hear each other."),
  slot(17, 9, 3, "early_evening", "Sentosa Cove", 1.2466, 103.842, "decide_together", "A polished dinner by the marina, no rushed energy."),
  slot(18, 9, 0, "afternoon", "Dempsey Hill", 1.3045, 103.8109, "split", "Late lunch and a design-store wander."),
  slot(19, 10, 1, "early_evening", "Chinatown", 1.2842, 103.843, "decide_together", "Smart casual dinner around Chinatown, dessert mandatory."),
  slot(20, 10, 6, "afternoon", "Tiong Bahru", 1.2848, 103.8336, "split", "Ceramics, coffee, and an unhurried chat."),
  slot(21, 11, 4, "early_evening", "Boat Quay", 1.2877, 103.8493, "decide_together", "Dinner near the river, preferably somewhere not too loud."),
  slot(22, 11, 5, "late_evening", "Telok Ayer", 1.2819, 103.8481, "split", "A proper cocktail and a good conversation around Telok Ayer."),
  slot(23, 12, 2, "early_evening", "Keppel Bay", 1.2654, 103.8186, "decide_together", "Sunset walk and dinner near the water."),
  slot(24, 12, 0, "morning", "Tanjong Pagar", 1.2764, 103.8458, "split", "A low-key coffee date before the city wakes up."),
  slot(25, 13, 3, "early_evening", "DIFC", 25.2138, 55.2796, "decide_together", "Dinner in DIFC with a proper reservation."),
  slot(26, 13, 6, "late_evening", "Jumeirah", 25.2048, 55.2449, "split", "A beachside drink and a good playlist nearby."),
  slot(27, 14, 2, "early_evening", "Dubai Marina", 25.08, 55.14, "decide_together", "Marina dinner, relaxed but still intentional."),
  slot(28, 14, 5, "afternoon", "Bluewaters", 25.0772, 55.1226, "split", "Coffee and a waterfront walk."),
  slot(29, 15, 4, "early_evening", "Alserkal Avenue", 25.1413, 55.2266, "decide_together", "Gallery opening, then dinner nearby if we are both still curious."),
  slot(30, 15, 6, "late_evening", "Downtown Dubai", 25.1972, 55.2744, "split", "Late dessert and a view that earns the effort."),
  slot(31, 16, 1, "early_evening", "Jumeirah Beach Road", 25.2048, 55.2449, "decide_together", "Quiet dinner near Jumeirah, somewhere with good service."),
  slot(32, 16, 5, "late_evening", "Business Bay", 25.1853, 55.2636, "split", "A low-lit bar, no networking energy."),
  slot(33, 17, 3, "early_evening", "Cihangir", 41.0337, 28.9826, "decide_together", "Coffee that becomes dinner around Cihangir."),
  slot(34, 17, 6, "afternoon", "Karakoy", 41.0244, 28.9749, "split", "A ferry, a gallery, and maybe a second coffee."),
  slot(35, 18, 2, "early_evening", "Kadikoy", 40.9909, 29.0303, "decide_together", "Dinner on the Asian side and a walk if the weather behaves."),
  slot(36, 18, 5, "late_evening", "Moda", 40.9856, 29.025, "split", "Late tea or wine in Moda, somewhere easy."),
  slot(37, 19, 4, "early_evening", "Saadiyat Island", 24.542, 54.4349, "decide_together", "Museum first, dinner after if we are not done talking."),
  slot(38, 19, 6, "afternoon", "Al Bateen", 24.4539, 54.3373, "split", "Coffee by the marina and an unhurried walk."),
  slot(39, 20, 1, "early_evening", "Al Maryah Island", 24.5012, 54.3884, "decide_together", "Dinner near Al Maryah, polished but relaxed."),
  slot(40, 20, 5, "late_evening", "Yas Bay", 24.4672, 54.6067, "split", "A waterfront drink and dessert if the conversation earns it."),
];

await seed();

async function seed() {
  console.log(`Seeding ${profiles.length} discovery profiles...`);

  for (const item of profiles) {
    await ensureAuthUser(item);
  }

  await upsert("profiles", profiles.map(profileRow), "id");
  await upsert("schedules", profiles.map(scheduleRow), "user_id");
  await upsert("screening_configs", profiles.map(screeningRow), "schedule_id");
  await upsert("slots", slots.map(slotRow), "id");

  console.log("Done. Try /start discover_codex96910493 in Telegram.");
  console.log("Useful handles:", profiles.slice(0, 6).map((p) => p.handle).join(", "));
}

async function ensureAuthUser(item) {
  const { data } = await supabase.auth.admin.getUserById(item.user_id);

  if (data?.user) {
    const { error } = await supabase.auth.admin.updateUserById(item.user_id, {
      email: `${item.handle}@example.test`,
      email_confirm: true,
      user_metadata: {
        display_name: item.display_name,
        seed: "telegram_discovery",
      },
    });
    throwIf(error, `update auth user ${item.handle}`);
    return;
  }

  const { error } = await supabase.auth.admin.createUser({
    id: item.user_id,
    email: `${item.handle}@example.test`,
    password: "uinvite-demo-password",
    email_confirm: true,
    user_metadata: {
      display_name: item.display_name,
      seed: "telegram_discovery",
    },
  });
  throwIf(error, `create auth user ${item.handle}`);
}

async function upsert(table, rows, onConflict) {
  const { error } = await supabase
    .from(table)
    .upsert(rows, { onConflict });
  throwIf(error, `upsert ${table}`);
}

function profileRow(item) {
  return {
    id: item.user_id,
    handle: item.handle,
    display_name: item.display_name,
    photo_url: item.photo_url,
    age: item.age,
    city_label: item.city_label,
    bio_one_liner: item.bio_one_liner,
    public_profile_enabled: true,
    trusted_contacts_phones: [],
    timezone: item.timezone,
    locale: "en-US",
    country_code: item.country_code,
    notify_channel: "telegram",
    region_mode: "row",
    instagram_handle: item.instagram_handle,
    discovery_enabled: true,
    accepted_contact_channel: item.accepted_contact_channel,
    updated_at: new Date().toISOString(),
  };
}

function scheduleRow(item) {
  return {
    id: item.schedule_id,
    user_id: item.user_id,
    mode: "rolling_7_days",
    is_active: true,
    updated_at: new Date().toISOString(),
  };
}

function screeningRow(item) {
  return {
    schedule_id: item.schedule_id,
    require_phone: true,
    allow_instagram: true,
    allow_telegram: true,
    require_selfie: false,
    enabled_questions: [],
    auto_decline_rules: {},
    allow_invitee_note: true,
    require_instagram: false,
    require_telegram: false,
    updated_at: new Date().toISOString(),
  };
}

function slotRow(item) {
  return {
    id: item.id,
    schedule_id: item.schedule_id,
    weekday: item.weekday,
    time_bucket: item.time_bucket,
    area_label: item.area_label,
    area_lat: item.area_lat,
    area_lng: item.area_lng,
    pay_pref: item.pay_pref,
    notes: item.notes,
    is_active: true,
    updated_at: new Date().toISOString(),
  };
}

function profile(
  number,
  handle,
  display_name,
  age,
  city_label,
  country_code,
  timezone,
  bio_one_liner,
  photo_url,
  instagram_handle,
  accepted_contact_channel,
) {
  return {
    user_id: id("20000000", number),
    schedule_id: id("21000000", number),
    handle,
    display_name,
    age,
    city_label,
    country_code,
    timezone,
    bio_one_liner,
    photo_url,
    instagram_handle,
    accepted_contact_channel,
  };
}

function slot(
  slotNumber,
  profileNumber,
  weekday,
  time_bucket,
  area_label,
  area_lat,
  area_lng,
  pay_pref,
  notes,
) {
  return {
    id: id("22000000", slotNumber),
    schedule_id: id("21000000", profileNumber),
    weekday,
    time_bucket,
    area_label,
    area_lat,
    area_lng,
    pay_pref,
    notes,
  };
}

function id(prefix, number) {
  return `${prefix}-0000-4000-8000-${String(number).padStart(12, "0")}`;
}

function throwIf(error, action) {
  if (error) {
    throw new Error(`${action} failed: ${error.message}`);
  }
}

function loadDotEnv() {
  if (!existsSync(".env")) return;

  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    if (process.env[key]) continue;

    process.env[key] = rawValue
      .replace(/^['"]/, "")
      .replace(/['"]$/, "");
  }
}
