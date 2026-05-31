CREATE TABLE IF NOT EXISTS public.trusted_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  label TEXT,
  phone_e164 TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT trusted_contacts_phone_e164_check
    CHECK (phone_e164 ~ '^\+[1-9][0-9]{6,14}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trusted_contacts_user_phone
  ON public.trusted_contacts (user_id, phone_e164);

CREATE INDEX IF NOT EXISTS idx_trusted_contacts_user_active
  ON public.trusted_contacts (user_id, is_active, sort_order);

ALTER TABLE public.trusted_contacts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'trusted_contacts'
      AND policyname = 'Users can view own trusted contacts'
  ) THEN
    CREATE POLICY "Users can view own trusted contacts"
      ON public.trusted_contacts
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'trusted_contacts'
      AND policyname = 'Users can insert own trusted contacts'
  ) THEN
    CREATE POLICY "Users can insert own trusted contacts"
      ON public.trusted_contacts
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'trusted_contacts'
      AND policyname = 'Users can update own trusted contacts'
  ) THEN
    CREATE POLICY "Users can update own trusted contacts"
      ON public.trusted_contacts
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'trusted_contacts'
      AND policyname = 'Users can delete own trusted contacts'
  ) THEN
    CREATE POLICY "Users can delete own trusted contacts"
      ON public.trusted_contacts
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_trusted_contacts_updated_at
  ON public.trusted_contacts;

CREATE TRIGGER update_trusted_contacts_updated_at
  BEFORE UPDATE ON public.trusted_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.trusted_contacts (user_id, phone_e164, label, sort_order)
SELECT p.id, legacy.phone_e164, legacy.label, legacy.sort_order
FROM public.profiles p
CROSS JOIN LATERAL (
  SELECT
    CASE
      WHEN jsonb_typeof(item.value) = 'string' THEN trim(both '"' from item.value::TEXT)
      WHEN jsonb_typeof(item.value) = 'object' THEN COALESCE(item.value ->> 'phone_e164', item.value ->> 'phone')
      ELSE NULL
    END AS phone_e164,
    CASE
      WHEN jsonb_typeof(item.value) = 'object' THEN item.value ->> 'label'
      ELSE NULL
    END AS label,
    item.ordinality::INTEGER - 1 AS sort_order
  FROM jsonb_array_elements(COALESCE(p.trusted_contacts_phones, '[]'::jsonb))
    WITH ORDINALITY AS item(value, ordinality)
) legacy
WHERE legacy.phone_e164 ~ '^\+[1-9][0-9]{6,14}$'
ON CONFLICT (user_id, phone_e164) DO UPDATE
SET
  label = COALESCE(EXCLUDED.label, public.trusted_contacts.label),
  is_active = true,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
