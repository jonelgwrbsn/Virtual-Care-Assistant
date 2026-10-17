export const APPOINTMENT_SLOT_MINUTES = 30;

function parseClockTime(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  const meridiem = match[3]?.toUpperCase();

  if (minutes > 59) return null;
  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    hours = hours % 12 + (meridiem === "PM" ? 12 : 0);
  } else if (hours > 23) {
    return null;
  }
  return hours * 60 + minutes;
}

export function getDoctorSlots(hours: string | null): number[] {
  if (!hours) return [];
  const range = hours.trim().match(/^(.+?)\s*(?:-|–|—|\bto\b)\s*(.+)$/i);
  if (!range) return [];
  const start = parseClockTime(range[1]);
  const end = parseClockTime(range[2]);
  if (start === null || end === null || end <= start) return [];

  const slots: number[] = [];
  for (let minute = start; minute + APPOINTMENT_SLOT_MINUTES <= end; minute += APPOINTMENT_SLOT_MINUTES) {
    slots.push(minute);
  }
  return slots;
}

export function filterAvailableSlots(slots: number[], bookedStarts: number[]): number[] {
  return slots.filter(slot =>
    bookedStarts.every(booked =>
      booked >= slot + APPOINTMENT_SLOT_MINUTES || booked + APPOINTMENT_SLOT_MINUTES <= slot
    )
  );
}
