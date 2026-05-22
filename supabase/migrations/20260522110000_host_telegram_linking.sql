CREATE TABLE IF NOT EXISTS public.telegram_link_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL DEFAULT 'host_link'
    CHECK (purpose IN ('host_link')),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_link_tokens_user_created
  ON public.telegram_link_tokens (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_telegram_link_tokens_unused
  ON public.telegram_link_tokens (purpose, expires_at)
  WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_telegram_connections_user_active
  ON public.telegram_connections (user_id, updated_at DESC)
  WHERE user_id IS NOT NULL AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_telegram_connections_chat_active
  ON public.telegram_connections (telegram_chat_id, updated_at DESC)
  WHERE is_active = true;

ALTER TABLE public.telegram_link_tokens ENABLE ROW LEVEL SECURITY;
