DROP POLICY IF EXISTS "Invite links publicly accessible by token"
  ON public.invite_links;
DROP POLICY IF EXISTS "Slots viewable via public invite link"
  ON public.slots;
DROP POLICY IF EXISTS "Screening configs viewable via public invite link"
  ON public.screening_configs;
DROP POLICY IF EXISTS "Profiles viewable via public invite link"
  ON public.profiles;

CREATE POLICY "Invite links publicly accessible by token"
ON public.invite_links
FOR SELECT
USING (
  type IN ('one_time', 'exp_3d', 'exp_7d')
  AND (expires_at IS NULL OR expires_at > now())
  AND used_at IS NULL
);

CREATE POLICY "Slots viewable via public invite link"
ON public.slots
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.invite_links il
    WHERE il.schedule_id = slots.schedule_id
      AND il.type IN ('one_time', 'exp_3d', 'exp_7d')
      AND (il.expires_at IS NULL OR il.expires_at > now())
      AND il.used_at IS NULL
  )
);

CREATE POLICY "Screening configs viewable via public invite link"
ON public.screening_configs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.invite_links il
    WHERE il.schedule_id = screening_configs.schedule_id
      AND il.type IN ('one_time', 'exp_3d', 'exp_7d')
      AND (il.expires_at IS NULL OR il.expires_at > now())
      AND il.used_at IS NULL
  )
);

CREATE POLICY "Profiles viewable via public invite link"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.invite_links il
    JOIN public.schedules s ON s.id = il.schedule_id
    WHERE s.user_id = profiles.id
      AND il.type IN ('one_time', 'exp_3d', 'exp_7d')
      AND (il.expires_at IS NULL OR il.expires_at > now())
      AND il.used_at IS NULL
  )
);
