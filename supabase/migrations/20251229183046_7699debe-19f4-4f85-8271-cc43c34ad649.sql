-- =====================================================
-- uinvite.me MVP Database Schema
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. CONFIG CATALOGS (loaded from DB for flexibility)
-- =====================================================

-- Formats catalog
CREATE TABLE public.catalog_formats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  icon_key TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Intent tags catalog
CREATE TABLE public.catalog_intent_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  value TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Vibe tags catalog
CREATE TABLE public.catalog_vibe_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Boundary tags catalog
CREATE TABLE public.catalog_boundary_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Screening questions catalog
CREATE TABLE public.catalog_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('yes_no', 'single_choice', 'multi_choice', 'number', 'short_text')),
  answers_json JSONB,
  auto_decline_supported BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Screening presets catalog
CREATE TABLE public.catalog_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  enabled_question_ids JSONB DEFAULT '[]',
  default_auto_decline_rules JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 2. USER PROFILES (extends auth.users)
-- =====================================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  handle TEXT UNIQUE,
  display_name TEXT,
  photo_url TEXT,
  age INTEGER,
  city_label TEXT,
  bio_one_liner TEXT,
  public_profile_enabled BOOLEAN DEFAULT false,
  trusted_contacts_phones JSONB DEFAULT '[]',
  timezone TEXT DEFAULT 'America/New_York',
  locale TEXT DEFAULT 'en-US',
  -- Region-specific fields (from memory context)
  country_code TEXT,
  notify_channel TEXT DEFAULT 'sms' CHECK (notify_channel IN ('sms', 'email', 'telegram')),
  region_mode TEXT DEFAULT 'us' CHECK (region_mode IN ('us', 'row')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 3. SCHEDULES AND SLOTS
-- =====================================================

CREATE TABLE public.schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  mode TEXT DEFAULT 'rolling_7_days',
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

CREATE TABLE public.slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES public.schedules ON DELETE CASCADE,
  weekday INTEGER NOT NULL CHECK (weekday >= 0 AND weekday <= 6), -- 0=Sunday
  time_bucket TEXT NOT NULL CHECK (time_bucket IN ('morning', 'afternoon', 'early_evening', 'late_evening')),
  time_start TIME,
  time_end TIME,
  area_label TEXT NOT NULL,
  area_place_id TEXT,
  area_lat DECIMAL(10, 7),
  area_lng DECIMAL(10, 7),
  format UUID REFERENCES public.catalog_formats(id),
  intent_tag UUID REFERENCES public.catalog_intent_tags(id),
  vibe_tags UUID[] DEFAULT '{}',
  boundary_tags UUID[] DEFAULT '{}',
  pay_pref TEXT DEFAULT 'decide_together' CHECK (pay_pref IN ('split', 'treat', 'decide_together')),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 4. SCREENING CONFIGURATION
-- =====================================================

CREATE TABLE public.screening_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES public.schedules ON DELETE CASCADE UNIQUE,
  require_phone BOOLEAN DEFAULT true,
  allow_instagram BOOLEAN DEFAULT true,
  allow_telegram BOOLEAN DEFAULT true,
  require_selfie BOOLEAN DEFAULT false,
  enabled_questions JSONB DEFAULT '[]',
  auto_decline_rules JSONB DEFAULT '{}',
  allow_invitee_note BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 5. INVITE LINKS
-- =====================================================

CREATE TABLE public.invite_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES public.schedules ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('one_time', 'exp_3d', 'exp_7d')),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast token lookups
CREATE INDEX idx_invite_links_token ON public.invite_links(token);

-- =====================================================
-- 6. INVITEES (people who submit invites, no account)
-- =====================================================

CREATE TABLE public.invitees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone_e164 TEXT,
  phone_verified BOOLEAN DEFAULT false,
  email TEXT,
  instagram_handle TEXT,
  telegram_username TEXT,
  height_cm INTEGER,
  occupation TEXT,
  selfie_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 7. TELEGRAM CONNECTIONS (for RoW notifications)
-- =====================================================

CREATE TABLE public.telegram_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invitee_id UUID REFERENCES public.invitees(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  telegram_chat_id TEXT NOT NULL,
  telegram_username TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 8. INVITES
-- =====================================================

CREATE TABLE public.invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES public.schedules ON DELETE CASCADE,
  slot_id UUID NOT NULL REFERENCES public.slots ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES public.invitees ON DELETE CASCADE,
  invite_link_id UUID REFERENCES public.invite_links(id),
  target_date DATE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  answers JSONB DEFAULT '{}',
  invitee_note TEXT,
  moderation_status TEXT DEFAULT 'clean' CHECK (moderation_status IN ('clean', 'flagged', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  decided_at TIMESTAMPTZ
);

-- Index for host's pending invites
CREATE INDEX idx_invites_schedule_status ON public.invites(schedule_id, status);
CREATE INDEX idx_invites_target_date ON public.invites(target_date);

-- =====================================================
-- 9. DATES (created on accept or manually)
-- =====================================================

CREATE TABLE public.dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  invite_id UUID REFERENCES public.invites(id) ON DELETE SET NULL,
  invitee_snapshot JSONB NOT NULL,
  date DATE NOT NULL,
  time_bucket TEXT NOT NULL CHECK (time_bucket IN ('morning', 'afternoon', 'early_evening', 'late_evening')),
  time_start TIME,
  time_end TIME,
  area_label TEXT NOT NULL,
  area_place_id TEXT,
  format TEXT,
  intent_tag TEXT,
  vibe_tags TEXT[] DEFAULT '{}',
  boundary_tags TEXT[] DEFAULT '{}',
  pay_pref TEXT DEFAULT 'decide_together',
  venue_text TEXT,
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_dates_user_date ON public.dates(user_id, date);

-- =====================================================
-- 10. DATE SAFETY PACKS
-- =====================================================

CREATE TABLE public.date_safety_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_id UUID NOT NULL REFERENCES public.dates ON DELETE CASCADE UNIQUE,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  default_checkin_at TIMESTAMPTZ,
  grace_minutes INTEGER DEFAULT 20,
  share_message TEXT,
  ok_token TEXT UNIQUE,
  call_token TEXT UNIQUE,
  emergency_token TEXT UNIQUE,
  activated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for token lookups
CREATE INDEX idx_safety_pack_tokens ON public.date_safety_packs(ok_token, call_token, emergency_token);

-- =====================================================
-- 11. CHECK-IN EVENTS
-- =====================================================

CREATE TABLE public.checkin_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID NOT NULL REFERENCES public.date_safety_packs ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('ok', 'call', 'emergency')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 12. NOTIFICATION LOG
-- =====================================================

CREATE TABLE public.notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  invitee_id UUID REFERENCES public.invitees(id) ON DELETE SET NULL,
  phone_e164 TEXT,
  email TEXT,
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'email', 'telegram')),
  type TEXT NOT NULL,
  payload_json JSONB,
  provider_message_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 13. DEMO DATA NAMESPACE (for sandbox invites)
-- =====================================================

CREATE TABLE public.demo_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_snapshot JSONB NOT NULL,
  invitee_data JSONB NOT NULL,
  answers JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-purge demo invites older than 24 hours (handled by scheduled function)

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.catalog_formats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_intent_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_vibe_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_boundary_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screening_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.date_safety_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkin_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_invites ENABLE ROW LEVEL SECURITY;

-- Catalogs are readable by everyone (public config)
CREATE POLICY "Catalogs are publicly readable" ON public.catalog_formats FOR SELECT USING (true);
CREATE POLICY "Catalogs are publicly readable" ON public.catalog_intent_tags FOR SELECT USING (true);
CREATE POLICY "Catalogs are publicly readable" ON public.catalog_vibe_tags FOR SELECT USING (true);
CREATE POLICY "Catalogs are publicly readable" ON public.catalog_boundary_tags FOR SELECT USING (true);
CREATE POLICY "Catalogs are publicly readable" ON public.catalog_questions FOR SELECT USING (true);
CREATE POLICY "Catalogs are publicly readable" ON public.catalog_presets FOR SELECT USING (true);

-- Profiles: users can CRUD their own, public profiles readable by all
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Public profiles are viewable" ON public.profiles FOR SELECT USING (public_profile_enabled = true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Schedules: users can CRUD their own
CREATE POLICY "Users can view own schedule" ON public.schedules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own schedule" ON public.schedules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own schedule" ON public.schedules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own schedule" ON public.schedules FOR DELETE USING (auth.uid() = user_id);

-- Slots: users can CRUD their own via schedule
CREATE POLICY "Users can view own slots" ON public.slots FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.schedules WHERE schedules.id = slots.schedule_id AND schedules.user_id = auth.uid()));
CREATE POLICY "Users can insert own slots" ON public.slots FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.schedules WHERE schedules.id = slots.schedule_id AND schedules.user_id = auth.uid()));
CREATE POLICY "Users can update own slots" ON public.slots FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM public.schedules WHERE schedules.id = slots.schedule_id AND schedules.user_id = auth.uid()));
CREATE POLICY "Users can delete own slots" ON public.slots FOR DELETE 
  USING (EXISTS (SELECT 1 FROM public.schedules WHERE schedules.id = slots.schedule_id AND schedules.user_id = auth.uid()));

-- Screening configs: users can CRUD their own
CREATE POLICY "Users can view own screening config" ON public.screening_configs FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.schedules WHERE schedules.id = screening_configs.schedule_id AND schedules.user_id = auth.uid()));
CREATE POLICY "Users can insert own screening config" ON public.screening_configs FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.schedules WHERE schedules.id = screening_configs.schedule_id AND schedules.user_id = auth.uid()));
CREATE POLICY "Users can update own screening config" ON public.screening_configs FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM public.schedules WHERE schedules.id = screening_configs.schedule_id AND schedules.user_id = auth.uid()));

-- Invite links: users can CRUD their own
CREATE POLICY "Users can view own invite links" ON public.invite_links FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.schedules WHERE schedules.id = invite_links.schedule_id AND schedules.user_id = auth.uid()));
CREATE POLICY "Users can insert own invite links" ON public.invite_links FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.schedules WHERE schedules.id = invite_links.schedule_id AND schedules.user_id = auth.uid()));
CREATE POLICY "Users can update own invite links" ON public.invite_links FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM public.schedules WHERE schedules.id = invite_links.schedule_id AND schedules.user_id = auth.uid()));

-- Invitees: created by anonymous, visible to schedule owner
CREATE POLICY "Invitees insertable by anyone" ON public.invitees FOR INSERT WITH CHECK (true);
CREATE POLICY "Invitees viewable by related schedule owner" ON public.invitees FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.invites i 
    JOIN public.schedules s ON s.id = i.schedule_id 
    WHERE i.invitee_id = invitees.id AND s.user_id = auth.uid()
  ));

-- Telegram connections: viewable by related users
CREATE POLICY "Telegram connections viewable by owner" ON public.telegram_connections FOR SELECT 
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.invitees inv 
    JOIN public.invites i ON i.invitee_id = inv.id 
    JOIN public.schedules s ON s.id = i.schedule_id 
    WHERE inv.id = telegram_connections.invitee_id AND s.user_id = auth.uid()
  ));
CREATE POLICY "Telegram connections insertable" ON public.telegram_connections FOR INSERT WITH CHECK (true);

-- Invites: insertable by anyone (public submit), viewable by schedule owner
CREATE POLICY "Invites insertable by anyone" ON public.invites FOR INSERT WITH CHECK (true);
CREATE POLICY "Invites viewable by schedule owner" ON public.invites FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.schedules WHERE schedules.id = invites.schedule_id AND schedules.user_id = auth.uid()));
CREATE POLICY "Invites updatable by schedule owner" ON public.invites FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM public.schedules WHERE schedules.id = invites.schedule_id AND schedules.user_id = auth.uid()));

-- Dates: users can CRUD their own
CREATE POLICY "Users can view own dates" ON public.dates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own dates" ON public.dates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own dates" ON public.dates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own dates" ON public.dates FOR DELETE USING (auth.uid() = user_id);

-- Safety packs: viewable by date owner
CREATE POLICY "Safety packs viewable by date owner" ON public.date_safety_packs FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.dates WHERE dates.id = date_safety_packs.date_id AND dates.user_id = auth.uid()));
CREATE POLICY "Safety packs insertable by date owner" ON public.date_safety_packs FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.dates WHERE dates.id = date_safety_packs.date_id AND dates.user_id = auth.uid()));
CREATE POLICY "Safety packs updatable by date owner" ON public.date_safety_packs FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM public.dates WHERE dates.id = date_safety_packs.date_id AND dates.user_id = auth.uid()));

-- Check-in events: viewable by pack owner
CREATE POLICY "Check-in events viewable by pack owner" ON public.checkin_events FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.date_safety_packs dsp 
    JOIN public.dates d ON d.id = dsp.date_id 
    WHERE dsp.id = checkin_events.pack_id AND d.user_id = auth.uid()
  ));
CREATE POLICY "Check-in events insertable" ON public.checkin_events FOR INSERT WITH CHECK (true);

-- Notification log: viewable by related user
CREATE POLICY "Notification log viewable by user" ON public.notification_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Notification log insertable" ON public.notification_log FOR INSERT WITH CHECK (true);

-- Demo invites: publicly insertable and readable (sandbox)
CREATE POLICY "Demo invites publicly accessible" ON public.demo_invites FOR SELECT USING (true);
CREATE POLICY "Demo invites publicly insertable" ON public.demo_invites FOR INSERT WITH CHECK (true);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'display_name');
  RETURN NEW;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_schedules_updated_at BEFORE UPDATE ON public.schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_slots_updated_at BEFORE UPDATE ON public.slots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_screening_configs_updated_at BEFORE UPDATE ON public.screening_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_invites_updated_at BEFORE UPDATE ON public.invites FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_dates_updated_at BEFORE UPDATE ON public.dates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_safety_packs_updated_at BEFORE UPDATE ON public.date_safety_packs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- SEED DATA: Default catalogs
-- =====================================================

-- Seed formats
INSERT INTO public.catalog_formats (label, icon_key, sort_order) VALUES
  ('Coffee', 'coffee', 1),
  ('Cocktails', 'wine', 2),
  ('Walk', 'footprints', 3),
  ('Dinner', 'utensils', 4),
  ('Museum/Gallery', 'palette', 5),
  ('Activity', 'activity', 6),
  ('Concert/Show', 'music', 7),
  ('Brunch/Lunch', 'sun', 8),
  ('Outdoor Sport', 'bike', 9),
  ('Other', 'more-horizontal', 10);

-- Seed intent tags
INSERT INTO public.catalog_intent_tags (label, value, sort_order) VALUES
  ('Relationship-minded', 'serious_only', 1),
  ('Dating/see where it goes', 'dating_open', 2),
  ('Casual OK', 'casual_ok', 3),
  ('Short-term/visiting', 'short_term', 4),
  ('Friends first', 'friends_first', 5);

-- Seed vibe tags
INSERT INTO public.catalog_vibe_tags (label, sort_order) VALUES
  ('low key', 1),
  ('talkative', 2),
  ('playful', 3),
  ('romantic', 4),
  ('fun/spontaneous', 5),
  ('deep talks', 6),
  ('no pressure', 7),
  ('high energy', 8),
  ('quiet/chill', 9),
  ('anything but boring', 10);

-- Seed boundary tags
INSERT INTO public.catalog_boundary_tags (label, sort_order) VALUES
  ('public place only', 1),
  ('no smokers', 2),
  ('no drugs', 3),
  ('no last minute', 4),
  ('on time', 5),
  ('respectful only', 6),
  ('no sex talk before meet', 7),
  ('no home pickup', 8),
  ('short first meet', 9),
  ('open to video call first', 10);

-- Seed screening questions
INSERT INTO public.catalog_questions (label, type, answers_json, auto_decline_supported, sort_order) VALUES
  ('Relationship status', 'single_choice', '["Single", "Separated", "Divorced", "Married", "It''s complicated"]', true, 1),
  ('Local or visiting?', 'single_choice', '["I live here", "Visiting"]', false, 2),
  ('How long are you visiting?', 'single_choice', '["A few days", "1-2 weeks", "Longer"]', false, 3),
  ('Do you live alone?', 'single_choice', '["Yes", "No", "Prefer not to say"]', false, 4),
  ('Height (cm)', 'number', null, false, 5),
  ('Occupation', 'short_text', null, false, 6),
  ('Dating intentions', 'single_choice', '["Long-term relationship", "Casual dating", "Not sure yet", "Just friends"]', false, 7),
  ('Ready to meet in the next 7 days?', 'yes_no', null, true, 8),
  ('Smoking', 'single_choice', '["Never", "Socially", "Regularly"]', true, 9),
  ('Drinking', 'single_choice', '["Never", "Socially", "Regularly"]', false, 10),
  ('Drugs', 'single_choice', '["Never", "Occasionally", "Regularly"]', true, 11),
  ('Kids', 'single_choice', '["No kids", "Have kids", "Prefer not to say"]', false, 12),
  ('Family plans', 'single_choice', '["Want kids", "Don''t want kids", "Open to it", "Not sure"]', false, 13),
  ('Marital history', 'single_choice', '["Never married", "Divorced", "Widowed", "Prefer not to say"]', false, 14),
  ('Weekend style', 'single_choice', '["Active/outdoors", "Relaxed at home", "Social/nightlife", "Mix of everything"]', false, 15),
  ('Hobbies (pick up to 3)', 'multi_choice', '["Sports", "Reading", "Travel", "Music", "Art", "Gaming", "Cooking", "Fitness", "Photography", "Hiking"]', false, 16),
  ('Free time availability', 'single_choice', '["Weekday evenings", "Weekends only", "Flexible", "Very limited"]', false, 17),
  ('OK with public place first meet?', 'yes_no', null, true, 18);

-- Seed presets
INSERT INTO public.catalog_presets (label, enabled_question_ids, default_auto_decline_rules, sort_order) VALUES
  ('Quick (3 questions)', '[]', '{}', 1),
  ('No time-wasters', '[]', '{}', 2),
  ('Lifestyle filter', '[]', '{}', 3),
  ('Safety-first', '[]', '{}', 4);