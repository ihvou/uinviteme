CREATE TABLE IF NOT EXISTS public.profile_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, sort_order),
  UNIQUE (storage_path)
);

CREATE INDEX IF NOT EXISTS idx_profile_photos_profile_sort
  ON public.profile_photos (profile_id, sort_order);

ALTER TABLE public.profile_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profile photos are viewable by public profiles or owner"
  ON public.profile_photos;

CREATE POLICY "Profile photos are viewable by public profiles or owner"
  ON public.profile_photos
  FOR SELECT
  USING (
    auth.uid() = profile_id
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = profile_photos.profile_id
        AND profiles.public_profile_enabled = true
    )
  );

DROP POLICY IF EXISTS "Profile photos insertable by owner"
  ON public.profile_photos;

CREATE POLICY "Profile photos insertable by owner"
  ON public.profile_photos
  FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "Profile photos updatable by owner"
  ON public.profile_photos;

CREATE POLICY "Profile photos updatable by owner"
  ON public.profile_photos
  FOR UPDATE
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "Profile photos deletable by owner"
  ON public.profile_photos;

CREATE POLICY "Profile photos deletable by owner"
  ON public.profile_photos
  FOR DELETE
  USING (auth.uid() = profile_id);
