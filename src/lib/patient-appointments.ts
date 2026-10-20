export interface PatientAppointmentSchedule {
  scheduled_at: string;
  status: string;
}

export function splitPatientAppointments<T extends PatientAppointmentSchedule>(
  appointments: readonly T[],
  now = new Date(),
) {
  const declined = appointments.filter((appointment) => appointment.status === "cancelled");
  const approved = appointments.filter((appointment) => appointment.status === "confirmed");
  const upcoming = appointments.filter((appointment) => {
    if (appointment.status === "pending") return true;
    if (appointment.status === "cancelled" || appointment.status === "completed") return false;
    return new Date(appointment.scheduled_at) >= now;
  });
  const past = appointments.filter((appointment) => {
    if (appointment.status === "completed") return true;
    if (appointment.status === "pending" || appointment.status === "cancelled") return false;
    return new Date(appointment.scheduled_at) < now;
  });

  return { upcoming, past, declined, approved };
}
