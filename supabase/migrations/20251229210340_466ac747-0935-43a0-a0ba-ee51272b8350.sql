-- Add require_instagram and require_telegram columns
ALTER TABLE public.screening_configs 
ADD COLUMN require_instagram boolean DEFAULT false,
ADD COLUMN require_telegram boolean DEFAULT false;

-- Migrate existing require_social_link to both
UPDATE public.screening_configs 
SET require_instagram = require_social_link,
    require_telegram = require_social_link
WHERE require_social_link = true;