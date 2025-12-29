-- Allow public access to schedules via public profile handle
CREATE POLICY "Schedules viewable via public profile handle"
ON public.schedules
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = schedules.user_id
    AND p.public_profile_enabled = true
  )
);

-- Allow public access to slots via public profile handle  
CREATE POLICY "Slots viewable via public profile handle"
ON public.slots
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM schedules s
    JOIN profiles p ON p.id = s.user_id
    WHERE s.id = slots.schedule_id
    AND p.public_profile_enabled = true
  )
);

-- Allow public access to screening configs via public profile handle
CREATE POLICY "Screening configs viewable via public profile handle"
ON public.screening_configs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM schedules s
    JOIN profiles p ON p.id = s.user_id
    WHERE s.id = screening_configs.schedule_id
    AND p.public_profile_enabled = true
  )
);