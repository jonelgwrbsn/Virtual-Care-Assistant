CREATE OR REPLACE FUNCTION public.admin_delete_patient_or_doctor(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_role text;
  target_email text;
  deleted_messages integer;
  deleted_records integer;
  deleted_consultations integer;
  deleted_appointments integer;
  deleted_vitals integer;
  deleted_preferences integer;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'This operation is only available to the trusted deletion service';
  END IF;

  SELECT role, email
  INTO target_role, target_email
  FROM public.profiles
  WHERE id = _user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account profile not found';
  END IF;
  IF target_role NOT IN ('patient', 'doctor') THEN
    RAISE EXCEPTION 'Only patient and doctor accounts can be deleted';
  END IF;

  DELETE FROM public.messages
  WHERE sender_id = _user_id
     OR consultation_id IN (
       SELECT consultation.id
       FROM public.consultations AS consultation
       WHERE consultation.patient_id = _user_id
          OR consultation.doctor_id = _user_id
          OR consultation.appointment_id IN (
            SELECT appointment.id
            FROM public.appointments AS appointment
            WHERE appointment.patient_id = _user_id
               OR appointment.doctor_id = _user_id
          )
     );
  GET DIAGNOSTICS deleted_messages = ROW_COUNT;

  DELETE FROM public.medical_records
  WHERE patient_id = _user_id OR uploaded_by = _user_id;
  GET DIAGNOSTICS deleted_records = ROW_COUNT;

  DELETE FROM public.consultations
  WHERE patient_id = _user_id
     OR doctor_id = _user_id
     OR appointment_id IN (
       SELECT appointment.id
       FROM public.appointments AS appointment
       WHERE appointment.patient_id = _user_id
          OR appointment.doctor_id = _user_id
     );
  GET DIAGNOSTICS deleted_consultations = ROW_COUNT;

  DELETE FROM public.appointments
  WHERE patient_id = _user_id OR doctor_id = _user_id;
  GET DIAGNOSTICS deleted_appointments = ROW_COUNT;

  DELETE FROM public.vitals WHERE patient_id = _user_id;
  GET DIAGNOSTICS deleted_vitals = ROW_COUNT;

  DELETE FROM public.integration_preferences WHERE patient_id = _user_id;
  GET DIAGNOSTICS deleted_preferences = ROW_COUNT;

  DELETE FROM public.admin_invitations
  WHERE auth_user_id = _user_id
     OR lower(email) = lower(target_email);

  DELETE FROM public.profiles WHERE id = _user_id;

  RETURN jsonb_build_object(
    'role', target_role,
    'deleted_messages', deleted_messages,
    'deleted_medical_records', deleted_records,
    'deleted_consultations', deleted_consultations,
    'deleted_appointments', deleted_appointments,
    'deleted_vitals', deleted_vitals,
    'deleted_preferences', deleted_preferences
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_patient_or_doctor(uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_patient_or_doctor(uuid)
TO service_role;
