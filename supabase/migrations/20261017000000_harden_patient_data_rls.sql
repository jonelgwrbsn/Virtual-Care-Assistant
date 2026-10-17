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
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_can_access_patient(
  _patient_id uuid,
  _include_pending boolean DEFAULT false
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    public.current_user_has_role(ARRAY['admin']::text[])
    OR (
      public.current_user_has_role(ARRAY['doctor']::text[])
      AND (
        EXISTS (
          SELECT 1
          FROM public.appointments AS appointment
          WHERE appointment.patient_id = _patient_id
            AND appointment.doctor_id = (SELECT auth.uid())
            AND (
              appointment.status IN ('confirmed', 'completed')
              OR (_include_pending AND appointment.status = 'pending')
            )
        )
        OR EXISTS (
          SELECT 1
          FROM public.consultations AS consultation
          WHERE consultation.patient_id = _patient_id
            AND consultation.doctor_id = (SELECT auth.uid())
            AND consultation.status IN ('live', 'completed')
        )
      )
    );
$$;

REVOKE ALL ON FUNCTION public.current_user_has_role(text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_user_can_access_patient(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_has_role(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_can_access_patient(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    'patient'
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_privileged_profile_and_clinical_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() = 'service_role'
     OR public.current_user_has_role(ARRAY['admin']::text[]) THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'profiles' THEN
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Profile identifiers cannot be changed';
    END IF;
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'Only an active administrator may change a profile role or status';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'appointments' THEN
    IF NEW.patient_id IS DISTINCT FROM OLD.patient_id
       OR NEW.doctor_id IS DISTINCT FROM OLD.doctor_id
       OR (to_jsonb(NEW) - ARRAY['status', 'updated_at'])
          IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status', 'updated_at']) THEN
      RAISE EXCEPTION 'Doctors may only update appointment status';
    END IF;
    IF NOT (
      (OLD.status = 'pending' AND NEW.status IN ('confirmed', 'cancelled'))
      OR (OLD.status = 'confirmed' AND NEW.status IN ('cancelled', 'completed'))
    ) THEN
      RAISE EXCEPTION 'Invalid appointment status transition';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'consultations' THEN
    IF NEW.patient_id IS DISTINCT FROM OLD.patient_id
       OR NEW.doctor_id IS DISTINCT FROM OLD.doctor_id
       OR NEW.appointment_id IS DISTINCT FROM OLD.appointment_id
       OR (to_jsonb(NEW) - ARRAY['status', 'ended_at', 'summary', 'updated_at'])
          IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status', 'ended_at', 'summary', 'updated_at']) THEN
      RAISE EXCEPTION 'Doctors may not change consultation ownership or unrelated fields';
    END IF;
    IF OLD.status NOT IN ('ai', 'live')
       OR NEW.status NOT IN ('live', 'completed') THEN
      RAISE EXCEPTION 'Invalid consultation status transition';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_privileges ON public.profiles;
CREATE TRIGGER guard_profile_privileges
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.guard_privileged_profile_and_clinical_updates();

DROP TRIGGER IF EXISTS guard_appointment_updates ON public.appointments;
CREATE TRIGGER guard_appointment_updates
BEFORE UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.guard_privileged_profile_and_clinical_updates();

DROP TRIGGER IF EXISTS guard_consultation_updates ON public.consultations;
CREATE TRIGGER guard_consultation_updates
BEFORE UPDATE ON public.consultations
FOR EACH ROW
EXECUTE FUNCTION public.guard_privileged_profile_and_clinical_updates();

DO $$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'appointments',
        'audit_log',
        'broadcast_notifications',
        'consultations',
        'integration_preferences',
        'medical_records',
        'messages',
        'platform_settings',
        'profiles',
        'symptom_knowledge',
        'vitals'
      ])
  LOOP
    EXECUTE format(
      'DROP POLICY %I ON %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  END LOOP;
END;
$$;

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symptom_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vitals ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_read_self
ON public.profiles FOR SELECT TO authenticated
USING (id = (SELECT auth.uid()));

CREATE POLICY profiles_read_admin
ON public.profiles FOR SELECT TO authenticated
USING (public.current_user_has_role(ARRAY['admin']::text[]));

CREATE POLICY patients_read_active_doctors
ON public.profiles FOR SELECT TO authenticated
USING (
  role = 'doctor'
  AND is_active IS TRUE
  AND public.current_user_has_role(ARRAY['patient']::text[])
);

CREATE POLICY doctors_read_assigned_patients
ON public.profiles FOR SELECT TO authenticated
USING (
  role = 'patient'
  AND public.current_user_has_role(ARRAY['doctor']::text[])
  AND public.current_user_can_access_patient(id, true)
);

CREATE POLICY profiles_update_self
ON public.profiles FOR UPDATE TO authenticated
USING (id = (SELECT auth.uid()))
WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY profiles_update_admin
ON public.profiles FOR UPDATE TO authenticated
USING (public.current_user_has_role(ARRAY['admin']::text[]))
WITH CHECK (public.current_user_has_role(ARRAY['admin']::text[]));

CREATE POLICY appointments_read_patient
ON public.appointments FOR SELECT TO authenticated
USING (
  patient_id = (SELECT auth.uid())
  AND public.current_user_has_role(ARRAY['patient']::text[])
);

CREATE POLICY appointments_read_doctor
ON public.appointments FOR SELECT TO authenticated
USING (
  doctor_id = (SELECT auth.uid())
  AND public.current_user_has_role(ARRAY['doctor']::text[])
);

CREATE POLICY appointments_admin_all
ON public.appointments FOR ALL TO authenticated
USING (public.current_user_has_role(ARRAY['admin']::text[]))
WITH CHECK (public.current_user_has_role(ARRAY['admin']::text[]));

CREATE POLICY appointments_insert_patient
ON public.appointments FOR INSERT TO authenticated
WITH CHECK (
  patient_id = (SELECT auth.uid())
  AND status = 'pending'
  AND public.current_user_has_role(ARRAY['patient']::text[])
  AND EXISTS (
    SELECT 1
    FROM public.profiles AS doctor
    WHERE doctor.id = appointments.doctor_id
      AND doctor.role = 'doctor'
      AND doctor.is_active IS TRUE
  )
);

CREATE POLICY appointments_update_doctor
ON public.appointments FOR UPDATE TO authenticated
USING (
  doctor_id = (SELECT auth.uid())
  AND public.current_user_has_role(ARRAY['doctor']::text[])
)
WITH CHECK (
  doctor_id = (SELECT auth.uid())
  AND public.current_user_has_role(ARRAY['doctor']::text[])
  AND status IN ('confirmed', 'cancelled', 'completed')
);

CREATE POLICY consultations_read_patient
ON public.consultations FOR SELECT TO authenticated
USING (
  patient_id = (SELECT auth.uid())
  AND public.current_user_has_role(ARRAY['patient']::text[])
);

CREATE POLICY consultations_read_doctor
ON public.consultations FOR SELECT TO authenticated
USING (
  doctor_id = (SELECT auth.uid())
  AND public.current_user_has_role(ARRAY['doctor']::text[])
);

CREATE POLICY consultations_read_admin
ON public.consultations FOR SELECT TO authenticated
USING (public.current_user_has_role(ARRAY['admin']::text[]));

CREATE POLICY consultations_insert_patient_ai
ON public.consultations FOR INSERT TO authenticated
WITH CHECK (
  patient_id = (SELECT auth.uid())
  AND doctor_id IS NULL
  AND status = 'ai'
  AND public.current_user_has_role(ARRAY['patient']::text[])
);

CREATE POLICY consultations_update_assigned_doctor
ON public.consultations FOR UPDATE TO authenticated
USING (
  doctor_id = (SELECT auth.uid())
  AND public.current_user_has_role(ARRAY['doctor']::text[])
)
WITH CHECK (
  doctor_id = (SELECT auth.uid())
  AND public.current_user_has_role(ARRAY['doctor']::text[])
  AND status IN ('live', 'completed')
);

CREATE POLICY messages_read_participant
ON public.messages FOR SELECT TO authenticated
USING (
  public.current_user_has_role(ARRAY['patient', 'doctor']::text[])
  AND EXISTS (
    SELECT 1
    FROM public.consultations AS consultation
    WHERE consultation.id = messages.consultation_id
      AND (
        consultation.patient_id = (SELECT auth.uid())
        OR consultation.doctor_id = (SELECT auth.uid())
      )
  )
);

CREATE POLICY messages_read_admin
ON public.messages FOR SELECT TO authenticated
USING (public.current_user_has_role(ARRAY['admin']::text[]));

CREATE POLICY messages_insert_patient
ON public.messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = (SELECT auth.uid())
  AND role = 'user'
  AND public.current_user_has_role(ARRAY['patient']::text[])
  AND EXISTS (
    SELECT 1
    FROM public.consultations AS consultation
    WHERE consultation.id = messages.consultation_id
      AND consultation.patient_id = (SELECT auth.uid())
  )
);

CREATE POLICY medical_records_read_patient
ON public.medical_records FOR SELECT TO authenticated
USING (
  patient_id = (SELECT auth.uid())
  AND public.current_user_has_role(ARRAY['patient']::text[])
);

CREATE POLICY medical_records_read_care_team
ON public.medical_records FOR SELECT TO authenticated
USING (public.current_user_can_access_patient(patient_id, false));

CREATE POLICY medical_records_admin_all
ON public.medical_records FOR ALL TO authenticated
USING (public.current_user_has_role(ARRAY['admin']::text[]))
WITH CHECK (public.current_user_has_role(ARRAY['admin']::text[]));

CREATE POLICY medical_records_insert_patient
ON public.medical_records FOR INSERT TO authenticated
WITH CHECK (
  patient_id = (SELECT auth.uid())
  AND uploaded_by = (SELECT auth.uid())
  AND public.current_user_has_role(ARRAY['patient']::text[])
);

CREATE POLICY medical_records_insert_doctor
ON public.medical_records FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = (SELECT auth.uid())
  AND public.current_user_has_role(ARRAY['doctor']::text[])
  AND public.current_user_can_access_patient(patient_id, false)
);

CREATE POLICY medical_records_delete_patient
ON public.medical_records FOR DELETE TO authenticated
USING (
  patient_id = (SELECT auth.uid())
  AND public.current_user_has_role(ARRAY['patient']::text[])
);

CREATE POLICY vitals_read_patient
ON public.vitals FOR SELECT TO authenticated
USING (
  patient_id = (SELECT auth.uid())
  AND public.current_user_has_role(ARRAY['patient']::text[])
);

CREATE POLICY vitals_read_care_team
ON public.vitals FOR SELECT TO authenticated
USING (public.current_user_can_access_patient(patient_id, false));

CREATE POLICY vitals_insert_patient
ON public.vitals FOR INSERT TO authenticated
WITH CHECK (
  patient_id = (SELECT auth.uid())
  AND public.current_user_has_role(ARRAY['patient']::text[])
);

CREATE POLICY integration_preferences_read_patient
ON public.integration_preferences FOR SELECT TO authenticated
USING (
  patient_id = (SELECT auth.uid())
  AND public.current_user_has_role(ARRAY['patient']::text[])
);

CREATE POLICY integration_preferences_insert_patient
ON public.integration_preferences FOR INSERT TO authenticated
WITH CHECK (
  patient_id = (SELECT auth.uid())
  AND public.current_user_has_role(ARRAY['patient']::text[])
);

CREATE POLICY integration_preferences_update_patient
ON public.integration_preferences FOR UPDATE TO authenticated
USING (
  patient_id = (SELECT auth.uid())
  AND public.current_user_has_role(ARRAY['patient']::text[])
)
WITH CHECK (
  patient_id = (SELECT auth.uid())
  AND public.current_user_has_role(ARRAY['patient']::text[])
);

CREATE POLICY broadcasts_read_targeted
ON public.broadcast_notifications FOR SELECT TO authenticated
USING (
  public.current_user_has_role(ARRAY['patient', 'doctor', 'admin']::text[])
  AND (
    target_role = 'all'
    OR target_role = (
      SELECT profile.role
      FROM public.profiles AS profile
      WHERE profile.id = (SELECT auth.uid())
    )
  )
);

CREATE POLICY broadcasts_admin_all
ON public.broadcast_notifications FOR ALL TO authenticated
USING (public.current_user_has_role(ARRAY['admin']::text[]))
WITH CHECK (public.current_user_has_role(ARRAY['admin']::text[]));

CREATE POLICY platform_settings_admin_all
ON public.platform_settings FOR ALL TO authenticated
USING (public.current_user_has_role(ARRAY['admin']::text[]))
WITH CHECK (public.current_user_has_role(ARRAY['admin']::text[]));

CREATE POLICY symptom_knowledge_read
ON public.symptom_knowledge FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY symptom_knowledge_admin_all
ON public.symptom_knowledge FOR ALL TO authenticated
USING (public.current_user_has_role(ARRAY['admin']::text[]))
WITH CHECK (public.current_user_has_role(ARRAY['admin']::text[]));

CREATE POLICY audit_log_read_admin
ON public.audit_log FOR SELECT TO authenticated
USING (public.current_user_has_role(ARRAY['admin']::text[]));

CREATE POLICY audit_log_insert_admin
ON public.audit_log FOR INSERT TO authenticated
WITH CHECK (
  actor_id = (SELECT auth.uid())
  AND public.current_user_has_role(ARRAY['admin']::text[])
);

CREATE POLICY audit_log_insert_service
ON public.audit_log FOR INSERT TO service_role
WITH CHECK (true);

DROP POLICY IF EXISTS admins_read_all_records ON storage.objects;
DROP POLICY IF EXISTS doctors_read_patient_records ON storage.objects;
DROP POLICY IF EXISTS patients_delete_own_records ON storage.objects;
DROP POLICY IF EXISTS patients_read_own_records ON storage.objects;
DROP POLICY IF EXISTS patients_upload_own_records ON storage.objects;
DROP POLICY IF EXISTS public_read_avatars ON storage.objects;
DROP POLICY IF EXISTS users_delete_own_avatar ON storage.objects;
DROP POLICY IF EXISTS users_update_own_avatar ON storage.objects;
DROP POLICY IF EXISTS users_upload_own_avatar ON storage.objects;

UPDATE storage.buckets
SET public = false
WHERE id = 'medical-records';

CREATE POLICY medical_records_objects_admin_read
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'medical-records'
  AND public.current_user_has_role(ARRAY['admin']::text[])
);

CREATE POLICY medical_records_objects_patient_read
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'medical-records'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  AND public.current_user_has_role(ARRAY['patient']::text[])
);

CREATE POLICY medical_records_objects_doctor_read
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'medical-records'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.current_user_can_access_patient(
    ((storage.foldername(name))[1])::uuid,
    false
  )
);

CREATE POLICY medical_records_objects_patient_upload
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'medical-records'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  AND public.current_user_has_role(ARRAY['patient']::text[])
);

CREATE POLICY medical_records_objects_patient_delete
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'medical-records'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  AND public.current_user_has_role(ARRAY['patient']::text[])
);

CREATE POLICY avatars_public_read
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'avatars');

CREATE POLICY avatars_user_upload
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

CREATE POLICY avatars_user_update
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

CREATE POLICY avatars_user_delete
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);
