import { describe, expect, it } from "vitest";
import { splitPatientAppointments } from "@/lib/patient-appointments";

describe("patient appointment lists", () => {
  const now = new Date("2026-10-20T10:00:00.000Z");

  it("keeps pending appointments in Upcoming until they are confirmed or cancelled", () => {
    const appointments = [
      { id: "pending-past", scheduled_at: "2026-10-19T10:00:00.000Z", status: "pending" },
      { id: "pending-future", scheduled_at: "2026-10-21T10:00:00.000Z", status: "pending" },
      { id: "confirmed-past", scheduled_at: "2026-10-19T10:00:00.000Z", status: "confirmed" },
      { id: "confirmed-future", scheduled_at: "2026-10-21T10:00:00.000Z", status: "confirmed" },
      { id: "cancelled", scheduled_at: "2026-10-21T10:00:00.000Z", status: "cancelled" },
      { id: "declined-past", scheduled_at: "2026-10-18T10:00:00.000Z", status: "cancelled" },
      { id: "completed", scheduled_at: "2026-10-21T10:00:00.000Z", status: "completed" },
    ];

    const result = splitPatientAppointments(appointments, now);

    expect(result.upcoming.map(({ id }) => id)).toEqual(["pending-past", "pending-future", "confirmed-future"]);
    expect(result.past.map(({ id }) => id)).toEqual(["confirmed-past", "completed"]);
    expect(result.declined.map(({ id }) => id)).toEqual(["cancelled", "declined-past"]);
    expect(result.approved.map(({ id }) => id)).toEqual(["confirmed-past", "confirmed-future"]);
  });
});
