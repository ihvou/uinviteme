-- Store Telegram discovery browsing state and audit events.

CREATE TABLE IF NOT EXISTS public.discovery_sessions (
  telegram_chat_id TEXT PRIMARY KEY,
  telegram_username TEXT,
  origin_handle TEXT,
  city_label TEXT,
  location_lat DECIMAL(10, 7),
  location_lng DECIMAL(10, 7),
  current_profile_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  current_profile_handle TEXT,
  pending_profile_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  pending_profile_handle TEXT,
  phone_e164 TEXT,
  phone_verified BOOLEAN DEFAULT false,
  phone_verification_code TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.discovery_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_chat_id TEXT NOT NULL,
  profile_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  profile_handle TEXT,
  action TEXT NOT NULL CHECK (
    action IN (
      'viewed',
      'skipped',
      'invite_selected',
      'phone_prompted',
      'phone_verified',
      'city_updated',
      'location_updated'
    )
  ),
  city_label TEXT,
  location_lat DECIMAL(10, 7),
  location_lng DECIMAL(10, 7),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discovery_events_chat_created
  ON public.discovery_events (telegram_chat_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_discovery_events_profile
  ON public.discovery_events (profile_user_id);

ALTER TABLE public.discovery_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_events ENABLE ROW LEVEL SECURITY;
