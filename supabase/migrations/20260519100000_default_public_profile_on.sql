-- Public profiles should be enabled by default for new hosts.
-- Existing explicit choices are preserved.

ALTER TABLE public.profiles
ALTER COLUMN public_profile_enabled SET DEFAULT true;

UPDATE public.profiles
SET public_profile_enabled = true
WHERE public_profile_enabled IS NULL;
