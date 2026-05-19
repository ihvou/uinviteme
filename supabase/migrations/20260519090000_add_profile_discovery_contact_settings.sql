-- Add profile controls needed for Telegram/discovery MVP.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS discovery_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS instagram_handle TEXT,
ADD COLUMN IF NOT EXISTS accepted_contact_channel TEXT DEFAULT 'telegram';

UPDATE public.profiles
SET discovery_enabled = true
WHERE discovery_enabled IS NULL;

UPDATE public.profiles
SET accepted_contact_channel = 'telegram'
WHERE accepted_contact_channel IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_accepted_contact_channel_check'
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_accepted_contact_channel_check
    CHECK (accepted_contact_channel IN ('telegram', 'instagram'));
  END IF;
END $$;
