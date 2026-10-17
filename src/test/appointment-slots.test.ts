import { describe, expect, it } from "vitest";
import { filterAvailableSlots, getDoctorSlots } from "@/lib/appointment-slots";

describe("appointment slots", () => {
  it("creates 30-minute slots from a 12-hour availability range", () => {
    expect(getDoctorSlots("9:00 AM – 11:00 AM")).toEqual([540, 570, 600, 630]);
  });

  it("supports 24-hour availability and rejects unsupported ranges", () => {
    expect(getDoctorSlots("09:00-11:00")).toEqual([540, 570, 600, 630]);
    expect(getDoctorSlots("weekdays by appointment")).toEqual([]);
    expect(getDoctorSlots("5:00 PM – 9:00 AM")).toEqual([]);
  });

  it("excludes slots that overlap booked appointment starts", () => {
    expect(filterAvailableSlots([540, 570, 600, 630], [585])).toEqual([540, 630]);
  });
});
