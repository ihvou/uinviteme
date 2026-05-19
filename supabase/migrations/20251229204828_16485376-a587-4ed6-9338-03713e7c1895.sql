-- Add require_social_link column to screening_configs
-- This replaces the allow_instagram/allow_telegram logic with a single "require" toggle
ALTER TABLE public.screening_configs
ADD COLUMN require_social_link boolean DEFAULT false;

-- Migrate existing data: if either social link was allowed, don't require (preserve permissive behavior)
-- Users who want to require can toggle it on explicitly