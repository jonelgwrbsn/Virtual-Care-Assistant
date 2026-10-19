DROP POLICY IF EXISTS consultations_read_doctor ON public.consultations;
CREATE POLICY consultations_read_doctor
ON public.consultations FOR SELECT TO authenticated
USING (
  public.current_user_has_role(ARRAY['doctor']::text[])
  AND (
    doctor_id = (SELECT auth.uid())
    OR (
      status = 'ai'
      AND public.current_user_can_access_patient(patient_id, false)
    )
  )
);

DROP POLICY IF EXISTS messages_read_participant ON public.messages;
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
        OR (
          consultation.status = 'ai'
          AND public.current_user_can_access_patient(consultation.patient_id, false)
        )
      )
  )
);
