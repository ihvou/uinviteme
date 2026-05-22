-- Invite submission is now owned by the submit-invite Edge Function.
-- Service-role functions bypass RLS; anonymous browsers should not write these
-- lifecycle tables directly.

CREATE INDEX IF NOT EXISTS idx_invitees_phone_e164
  ON public.invitees (phone_e164)
  WHERE phone_e164 IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invites_pending_phone_lookup
  ON public.invites (schedule_id, status, invitee_id)
  WHERE status = 'pending';

DROP POLICY IF EXISTS "Invitees insertable by anyone" ON public.invitees;
DROP POLICY IF EXISTS "Invites insertable by anyone" ON public.invites;

REVOKE INSERT ON public.invitees FROM anon;
REVOKE INSERT ON public.invites FROM anon;
