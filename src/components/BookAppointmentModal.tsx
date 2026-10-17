import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Calendar, Stethoscope, Clock, Search, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { toast } from "sonner";
import { addDays, format, parseISO, startOfDay } from "date-fns";
import { APPOINTMENT_SLOT_MINUTES, filterAvailableSlots, getDoctorSlots } from "@/lib/appointment-slots";
const NO_AVAILABLE_DAYS: string[] = [];

interface Doctor {
  id: string;
  full_name: string;
  specialty: string | null;
  available_days: string[] | null;
  available_hours: string | null;
  avatar_url: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onBooked?: () => void;
}

export const BookAppointmentModal = ({ open, onClose, onBooked }: Props) => {
  const session = getSession();
  const [loading,    setLoading]    = useState(false);
  const [doctors,    setDoctors]    = useState<Doctor[]>([]);
  const [loadingDrs, setLoadingDrs] = useState(true);
  const [doctorLoadError, setDoctorLoadError] = useState<string | null>(null);
  const [retryDoctors, setRetryDoctors] = useState(0);
  const [availableTimes, setAvailableTimes] = useState<number[]>([]);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [timeLoadError, setTimeLoadError] = useState<string | null>(null);
  const [retryTimes, setRetryTimes] = useState(0);
  const [search,     setSearch]     = useState("");
  const [doctorId,   setDoctorId]   = useState("");
  const [date,       setDate]       = useState("");
  const [time,       setTime]       = useState("");
  const [mode,       setMode]       = useState<"video" | "in-person" | "chat">("video");
  const [notes,      setNotes]      = useState("");

  // Load doctors when modal opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingDrs(true);
    setDoctorLoadError(null);
    setDoctors([]);
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, specialty, available_days, available_hours, avatar_url")
          .eq("role", "doctor")
          .eq("is_active", true)
          .order("full_name");
        if (error) throw error;
        if (cancelled) return;
        setDoctors((data as Doctor[]) ?? []);
        setLoadingDrs(false);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Unable to load doctors.";
        setDoctorLoadError(message);
        setLoadingDrs(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, retryDoctors]);

  const filtered = doctors.filter(d =>
    d.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (d.specialty ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const selectedDoctor = doctors.find(d => d.id === doctorId);
  const availableDays = selectedDoctor?.available_days ?? NO_AVAILABLE_DAYS;

  useEffect(() => {
    if (!open || !selectedDoctor || !date) {
      setAvailableTimes([]);
      setLoadingTimes(false);
      setTimeLoadError(null);
      return;
    }

    const selectedDay = format(parseISO(date), "EEEE");
    if (!availableDays.includes(selectedDay)) {
      setAvailableTimes([]);
      setLoadingTimes(false);
      setTimeLoadError(null);
      return;
    }

    const doctorSlots = getDoctorSlots(selectedDoctor.available_hours);
    if (doctorSlots.length === 0) {
      setAvailableTimes([]);
      setLoadingTimes(false);
      setTimeLoadError("This doctor has no supported bookable hours listed. Contact the clinic to book.");
      return;
    }

    let cancelled = false;
    const dayStart = startOfDay(parseISO(date));
    setLoadingTimes(true);
    setTimeLoadError(null);
    setAvailableTimes([]);
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("appointments")
          .select("scheduled_at")
          .eq("doctor_id", selectedDoctor.id)
          .in("status", ["pending", "confirmed"])
          .gte("scheduled_at", dayStart.toISOString())
          .lt("scheduled_at", addDays(dayStart, 1).toISOString());
        if (error) throw error;
        if (cancelled) return;
        const busyStarts = (data ?? []).map(appointment => {
          const appointmentDate = new Date(appointment.scheduled_at);
          return appointmentDate.getHours() * 60 + appointmentDate.getMinutes();
        });
        setAvailableTimes(filterAvailableSlots(doctorSlots, busyStarts));
        setLoadingTimes(false);
      } catch (error) {
        if (cancelled) return;
        setTimeLoadError(error instanceof Error ? error.message : "Unable to load available times.");
        setLoadingTimes(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, selectedDoctor, date, retryTimes, availableDays]);

  const handleBook = async () => {
    if (!doctorId)      return toast.error("Please select a doctor");
    if (!date || !time) return toast.error("Please select a date and time");
    if (!session)       return toast.error("Not logged in");
    if (!availableTimes.includes(Number(time))) {
      return toast.error("Choose an available time or refresh the schedule.");
    }

    setLoading(true);
    try {
      const scheduledAtDate = parseISO(date);
      const slotMinutes = Number(time);
      scheduledAtDate.setHours(Math.floor(slotMinutes / 60), slotMinutes % 60, 0, 0);
      const { error } = await supabase.from("appointments").insert({
        patient_id:   session.id,
        doctor_id:    doctorId,
        scheduled_at: scheduledAtDate.toISOString(),
        mode,
        status:       "pending",
        notes:        notes.trim() || null,
      });
      if (error) throw error;

      toast.success("Appointment requested", {
        description: `Pending confirmation from ${selectedDoctor?.full_name}.`,
      });
      onBooked?.();
      onClose();
      setDoctorId(""); setDate(""); setTime(""); setNotes(""); setMode("video"); setSearch("");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to book appointment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" /> Book appointment
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">

          {/* Doctor selection */}
          <div className="space-y-2">
            <Label htmlFor="doctor-search" className="text-sm font-semibold">Select a doctor <span className="text-destructive">*</span></Label>

            {/* Search */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="doctor-search"
                placeholder="Search by name or specialty…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
                autoComplete="off"
              />
            </div>

            {/* Doctor list */}
            <div className="max-h-52 overflow-y-auto rounded-xl border border-border/60 divide-y divide-border/40">
              {loadingDrs ? (
                <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading doctors…
                </div>
              ) : doctorLoadError ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <p className="text-sm text-destructive">Couldn’t load doctors: {doctorLoadError}</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => setRetryDoctors(count => count + 1)}>
                    <RefreshCw className="h-4 w-4" /> Try again
                  </Button>
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {search ? "No doctors match your search." : "No doctors available."}
                </div>
              ) : (
                filtered.map(d => (
                  <button
                    key={d.id}
                    type="button"
                    aria-pressed={doctorId === d.id}
                    onClick={() => { setDoctorId(d.id); setDate(""); setTime(""); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50 ${doctorId === d.id ? "bg-primary/5 border-l-2 border-primary" : ""}`}
                  >
                    {/* Avatar */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground overflow-hidden">
                      {d.avatar_url
                        ? <img src={d.avatar_url} alt={d.full_name} className="h-full w-full object-cover" />
                        : d.full_name.split(" ").map(s => s[0]).slice(0, 2).join("")
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold">{d.full_name}</div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {d.specialty && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Stethoscope className="h-3 w-3" /> {d.specialty}
                          </span>
                        )}
                        {d.available_hours && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" /> {d.available_hours}
                          </span>
                        )}
                      </div>
                      {d.available_days && d.available_days.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {d.available_days.map(day => (
                            <span key={day} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              {day.slice(0, 3)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {doctorId === d.id && (
                      <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="appt-date">Date <span className="text-destructive">*</span></Label>
              <Input
                id="appt-date"
                type="date"
                value={date}
                min={format(new Date(), "yyyy-MM-dd")}
                disabled={!selectedDoctor || availableDays.length === 0}
                onChange={e => {
                  const value = e.target.value;
                  setTime("");
                  if (value && !availableDays.includes(format(parseISO(value), "EEEE"))) {
                    setDate("");
                    toast.error(`This doctor isn’t available on ${format(parseISO(value), "EEEE")}.`);
                    return;
                  }
                  setDate(value);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appt-time">Time <span className="text-destructive">*</span></Label>
              <Select value={time} onValueChange={setTime} disabled={!date || loadingTimes || !!timeLoadError}>
                <SelectTrigger id="appt-time">
                  <SelectValue placeholder={loadingTimes ? "Loading times…" : "Select a time"} />
                </SelectTrigger>
                <SelectContent>
                  {availableTimes.map(slot => (
                    <SelectItem key={slot} value={String(slot)}>
                      {new Date(2000, 0, 1, Math.floor(slot / 60), slot % 60).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {selectedDoctor && availableDays.length === 0 && (
            <p role="status" className="text-sm text-warning">
              This doctor has not listed available days yet. Select another doctor or contact the clinic.
            </p>
          )}
          {selectedDoctor && (
            <p className="text-xs text-muted-foreground">
              Requested appointments use {APPOINTMENT_SLOT_MINUTES}-minute slots and remain pending until the clinic confirms.
            </p>
          )}
          {date && timeLoadError && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3" role="alert">
              <p className="text-sm text-destructive">{timeLoadError}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => setRetryTimes(count => count + 1)}>
                <RefreshCw className="h-4 w-4" /> Retry
              </Button>
            </div>
          )}
          {date && !loadingTimes && !timeLoadError && availableTimes.length === 0 && (
            <p className="text-sm text-muted-foreground">No 30-minute times are available on this date.</p>
          )}

          {/* Mode */}
          <div className="space-y-1.5">
            <Label>Consultation mode</Label>
            <Select value={mode} onValueChange={v => setMode(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="video">Video call</SelectItem>
                <SelectItem value="in-person">In-person</SelectItem>
                <SelectItem value="chat">Chat</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="appt-notes">Reason / notes <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
            <Input
              id="appt-notes"
              placeholder="e.g. Follow-up on cough symptoms"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleBook} disabled={loading || !doctorId || !time} className="bg-gradient-primary text-primary-foreground">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Request appointment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
