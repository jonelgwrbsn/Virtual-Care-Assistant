CREATE TABLE public.admin_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('patient', 'doctor', 'admin')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  invited_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz
);

CREATE INDEX admin_invitations_status_expiry_idx
ON public.admin_invitations (status, expires_at);

CREATE INDEX admin_invitations_email_idx
ON public.admin_invitations (lower(email), invited_at DESC);

CREATE UNIQUE INDEX admin_invitations_one_pending_per_email
ON public.admin_invitations (lower(email))
WHERE status = 'pending';

CREATE UNIQUE INDEX admin_invitations_auth_user_id_idx
ON public.admin_invitations (auth_user_id)
WHERE auth_user_id IS NOT NULL;

ALTER TABLE public.admin_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_invitations FROM anon, authenticated;
GRANT ALL ON public.admin_invitations TO service_role;

CREATE OR REPLACE FUNCTION public.mark_admin_invitation_accepted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  invitation_id uuid;
BEGIN
  IF OLD.confirmed_at IS NULL AND NEW.confirmed_at IS NOT NULL THEN
    UPDATE public.admin_invitations
    SET status = 'accepted',
        accepted_at = NEW.confirmed_at
    WHERE auth_user_id = NEW.id
      AND status = 'pending'
    RETURNING id INTO invitation_id;

    IF invitation_id IS NOT NULL THEN
      INSERT INTO public.audit_log (
        actor_id,
        actor_email,
        action,
        entity,
        entity_id,
        details
      )
      VALUES (
        NEW.id,
        NEW.email,
        'invitation_accepted',
        'admin_invitation',
        invitation_id,
        jsonb_build_object('email', NEW.email)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_admin_invitation_accepted() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.require_active_admin_invitation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  invitation_status text;
  invitation_expires_at timestamptz;
BEGIN
  IF OLD.confirmed_at IS NOT NULL OR NEW.confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT status, expires_at
  INTO invitation_status, invitation_expires_at
  FROM public.admin_invitations
  WHERE auth_user_id = NEW.id
  FOR UPDATE;

  IF FOUND AND (
    invitation_status <> 'pending'
    OR invitation_expires_at <= now()
  ) THEN
    RAISE EXCEPTION 'Invitation is expired or no longer active';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.require_active_admin_invitation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS require_active_admin_invitation ON auth.users;
CREATE TRIGGER require_active_admin_invitation
BEFORE UPDATE OF confirmed_at ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.require_active_admin_invitation();

DROP TRIGGER IF EXISTS mark_admin_invitation_accepted ON auth.users;
CREATE TRIGGER mark_admin_invitation_accepted
AFTER UPDATE OF confirmed_at ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.mark_admin_invitation_accepted();
