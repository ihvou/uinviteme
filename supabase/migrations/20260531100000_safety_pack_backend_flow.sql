CREATE UNIQUE INDEX IF NOT EXISTS idx_dates_invite_id_unique
  ON public.dates (invite_id)
  WHERE invite_id IS NOT NULL;

ALTER TABLE public.date_safety_packs
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_checkin_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS call_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escalation_reason TEXT
    CHECK (escalation_reason IS NULL OR escalation_reason IN ('emergency', 'missed_checkin'));

CREATE INDEX IF NOT EXISTS idx_safety_packs_active_checkin
  ON public.date_safety_packs (status, default_checkin_at)
  WHERE status = 'active';
