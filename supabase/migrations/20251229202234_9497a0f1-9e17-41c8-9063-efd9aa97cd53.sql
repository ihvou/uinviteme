-- Drop the problematic recursive policies
DROP POLICY IF EXISTS "Schedules viewable via public profile handle" ON public.schedules;
DROP POLICY IF EXISTS "Slots viewable via public profile handle" ON public.slots;
DROP POLICY IF EXISTS "Screening configs viewable via public profile handle" ON public.screening_configs;

-- Create a security definer function to check if a user has public profile enabled
-- This bypasses RLS to avoid infinite recursion
CREATE OR REPLACE FUNCTION public.is_public_profile(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND public_profile_enabled = true
  )
$$;

-- Create a security definer function to get user_id from schedule_id for public profiles
CREATE OR REPLACE FUNCTION public.get_schedule_owner_if_public(schedule_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.user_id 
  FROM public.schedules s
  JOIN public.profiles p ON p.id = s.user_id
  WHERE s.id = schedule_id AND p.public_profile_enabled = true
$$;

-- Recreate policies using the security definer functions
CREATE POLICY "Schedules viewable via public profile handle"
ON public.schedules
FOR SELECT
USING (public.is_public_profile(user_id));

CREATE POLICY "Slots viewable via public profile handle"
ON public.slots
FOR SELECT
USING (public.get_schedule_owner_if_public(schedule_id) IS NOT NULL);

CREATE POLICY "Screening configs viewable via public profile handle"
ON public.screening_configs
FOR SELECT
USING (public.get_schedule_owner_if_public(schedule_id) IS NOT NULL);