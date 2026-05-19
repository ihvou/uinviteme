-- Add RLS policy for public access to invite links by token
CREATE POLICY "Invite links publicly accessible by token" 
ON public.invite_links 
FOR SELECT 
USING (
  type = 'public' 
  AND (expires_at IS NULL OR expires_at > now())
  AND used_at IS NULL
);

-- Add RLS policy for public access to slots via schedule from invite link
CREATE POLICY "Slots viewable via public invite link" 
ON public.slots 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM invite_links il
    WHERE il.schedule_id = slots.schedule_id
    AND il.type = 'public'
    AND (il.expires_at IS NULL OR il.expires_at > now())
    AND il.used_at IS NULL
  )
);

-- Add RLS policy for public access to screening config via schedule
CREATE POLICY "Screening configs viewable via public invite link" 
ON public.screening_configs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM invite_links il
    WHERE il.schedule_id = screening_configs.schedule_id
    AND il.type = 'public'
    AND (il.expires_at IS NULL OR il.expires_at > now())
    AND il.used_at IS NULL
  )
);

-- Add RLS policy for public access to profiles via schedule
CREATE POLICY "Profiles viewable via public invite link" 
ON public.profiles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM invite_links il
    JOIN schedules s ON s.id = il.schedule_id
    WHERE s.user_id = profiles.id
    AND il.type = 'public'
    AND (il.expires_at IS NULL OR il.expires_at > now())
    AND il.used_at IS NULL
  )
);