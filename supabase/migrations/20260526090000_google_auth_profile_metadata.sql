-- Support OAuth signup metadata, especially Google names and avatars.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, photo_url)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'display_name', ''),
      NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
      NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
      NULLIF(split_part(NEW.email, '@', 1), '')
    ),
    COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'avatar_url', ''),
      NULLIF(NEW.raw_user_meta_data ->> 'picture', '')
    )
  )
  ON CONFLICT (id) DO UPDATE
  SET
    display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
    photo_url = COALESCE(public.profiles.photo_url, EXCLUDED.photo_url);

  RETURN NEW;
END;
$$;
