CREATE TABLE IF NOT EXISTS public.appointment_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (length(trim(content)) BETWEEN 1 AND 5000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS appointment_messages_conversation_idx
  ON public.appointment_messages (appointment_id, created_at, id);

ALTER TABLE public.appointment_messages ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.appointment_messages TO authenticated;

DROP POLICY IF EXISTS appointment_messages_read_participant
  ON public.appointment_messages;
CREATE POLICY appointment_messages_read_participant
ON public.appointment_messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.appointments AS appointment
    WHERE appointment.id = appointment_messages.appointment_id
      AND appointment.mode = 'chat'
      AND appointment.status = 'confirmed'
      AND (
        (
          appointment.patient_id = (SELECT auth.uid())
          AND public.current_user_has_role(ARRAY['patient']::text[])
        )
        OR (
          appointment.doctor_id = (SELECT auth.uid())
          AND public.current_user_has_role(ARRAY['doctor']::text[])
        )
      )
  )
);

DROP POLICY IF EXISTS appointment_messages_insert_participant
  ON public.appointment_messages;
CREATE POLICY appointment_messages_insert_participant
ON public.appointment_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.appointments AS appointment
    WHERE appointment.id = appointment_messages.appointment_id
      AND appointment.mode = 'chat'
      AND appointment.status = 'confirmed'
      AND (
        (
          appointment.patient_id = (SELECT auth.uid())
          AND public.current_user_has_role(ARRAY['patient']::text[])
        )
        OR (
          appointment.doctor_id = (SELECT auth.uid())
          AND public.current_user_has_role(ARRAY['doctor']::text[])
        )
      )
  )
);
