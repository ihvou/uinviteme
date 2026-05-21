-- Track provider-backed phone verification and SMS delivery attempts.

CREATE TABLE IF NOT EXISTS public.phone_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 TEXT NOT NULL,
  country_code TEXT,
  channel TEXT NOT NULL DEFAULT 'sms',
  purpose TEXT NOT NULL DEFAULT 'web_invite',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'approved', 'failed', 'expired', 'canceled')
  ),
  provider TEXT NOT NULL DEFAULT 'twilio_verify',
  provider_service_sid TEXT,
  provider_verification_sid TEXT,
  provider_status TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  last_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_phone_verifications_phone_created
  ON public.phone_verifications (phone_e164, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_phone_verifications_provider_sid
  ON public.phone_verifications (provider_verification_sid);

CREATE INDEX IF NOT EXISTS idx_phone_verifications_status_expires
  ON public.phone_verifications (status, expires_at);

CREATE TABLE IF NOT EXISTS public.sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'twilio',
  provider_message_sid TEXT,
  purpose TEXT NOT NULL,
  to_phone_e164 TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  error_code TEXT,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_messages_provider_sid
  ON public.sms_messages (provider_message_sid);

CREATE INDEX IF NOT EXISTS idx_sms_messages_phone_created
  ON public.sms_messages (to_phone_e164, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sms_messages_purpose_status
  ON public.sms_messages (purpose, status);

ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;
