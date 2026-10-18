CREATE OR REPLACE FUNCTION public.current_user_has_role(_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.id = (SELECT auth.uid())
      AND profile.is_active IS TRUE
      AND profile.role = ANY (_roles)
      AND (
        profile.role NOT IN ('admin', 'doctor')
        OR (SELECT auth.jwt() ->> 'aal') = 'aal2'
      )
  );
$$;

DROP POLICY IF EXISTS audit_log_insert_admin ON public.audit_log;
CREATE POLICY audit_log_insert_admin
ON public.audit_log FOR INSERT TO authenticated
WITH CHECK (
  actor_id = (SELECT auth.uid())
  AND actor_email = (
    SELECT profile.email
    FROM public.profiles AS profile
    WHERE profile.id = (SELECT auth.uid())
  )
  AND public.current_user_has_role(ARRAY['admin']::text[])
);
