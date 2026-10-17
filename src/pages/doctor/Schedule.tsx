import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SectionCard, SectionCardSkeleton } from "@/components/dashboard/Cards";
import { Clock, Video, MapPin, MessagesSquare, Pencil, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDoctorSchedule } from "@/hooks/use-supabase-data";
import { getSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { format, isToday, startOfWeek, addDays } from "date-fns";

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

const modeIcon = { video: Video, "in-person": MapPin, chat: MessagesSquare } as const;
const modeTone = {
  video:       "text-secondary bg-secondary/10",
  "in-person": "text-primary bg-primary/10",
  chat:        "text-success bg-success/10",
} as const;

const Schedule = () => {
  const session = getSession();
  const { data: schedule, loading } = useDoctorSchedule();

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays  = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Availability state
  const [availDays,  setAvailDays]  = useState<string[]>([]);
  const [availHours, setAvailHours] = useState("");
  const [editing,    setEditing]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [loadingAvail, setLoadingAvail] = useState(true);

  // Draft state while editing
  const [draftDays,  setDraftDays]  = useState<string[]>([]);
  const [draftHours, setDraftHours] = useState("");

  // Load current availability from profile
  useEffect(() => {
    if (!session) return;
    supabase
      .from("profiles")
      .select("available_days, available_hours")
      .eq("id", session.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setAvailDays(DAYS.filter(d => (data.available_days ?? []).includes(d)));
          setAvailHours(data.available_hours ?? "");
        }
        setLoadingAvail(false);
      });
  }, [session?.id]);

  const startEdit = () => {
    setDraftDays([...availDays]);
    setDraftHours(availHours);
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const toggleDay = (day: string) => {
    setDraftDays(prev => {
      const updated = prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day];
      // Always keep in Mon–Sun order
      return DAYS.filter(d => updated.includes(d));
    });
  };

  const saveAvailability = async () => {
    if (!session) return;
    if (draftDays.length === 0) { toast.error("Select at least one available day"); return; }
    if (!draftHours.trim())     { toast.error("Available hours is required"); return; }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          available_days:  draftDays,
          available_hours: draftHours.trim(),
          updated_at:      new Date().toISOString(),
        })
        .eq("id", session.id);
      if (error) throw error;

      setAvailDays(draftDays);
      setAvailHours(draftHours.trim());
      setEditing(false);
      toast.success("Availability updated");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout requiredRole="doctor">
      <div className="mb-7">
        <p className="text-sm text-muted-foreground">This week</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">Schedule</h1>
      </div>

      {/* Week strip */}
      <div className="mb-6 grid grid-cols-7 gap-2">
        {weekDays.map((day) => {
          const today = isToday(day);
          const apptCount = (schedule ?? []).filter((a: any) =>
            new Date(a.scheduled_at).toDateString() === day.toDateString()
          ).length;
          const dayName = format(day, "EEEE");
          const isAvail = availDays.includes(dayName);
          return (
            <div key={day.toISOString()} className={`rounded-xl border p-3 text-center transition-all ${
              today
                ? "border-primary bg-gradient-primary text-primary-foreground"
                : isAvail
                ? "border-success/40 bg-success/5"
                : "border-border/60 bg-card opacity-60"
            }`}>
              <div className="text-[10px] font-semibold uppercase tracking-widest opacity-80">{format(day, "EEE")}</div>
              <div className="mt-1 font-display text-xl font-bold">{format(day, "d")}</div>
              <div className="mt-1 text-[10px] opacity-80">
                {today ? "Today" : apptCount > 0 ? `${apptCount} appt${apptCount > 1 ? "s" : ""}` : isAvail ? "Available" : "Off"}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Today's agenda */}
        <div className="lg:col-span-2">
          {loading ? (
            <SectionCardSkeleton rows={5} />
          ) : (
            <SectionCard title="Today's agenda">
              {schedule && schedule.filter((a: any) => isToday(new Date(a.scheduled_at))).length > 0 ? (
                <ul className="space-y-2">
                  {schedule.filter((a: any) => isToday(new Date(a.scheduled_at))).map((e: any) => {
                    const patient = (e.patient as any);
                    const Icon = modeIcon[e.mode as keyof typeof modeIcon] ?? Video;
                    const tone = modeTone[e.mode as keyof typeof modeTone] ?? "text-primary bg-primary/10";
                    return (
                      <li key={e.id} className="flex items-center gap-4 rounded-xl border border-border/60 bg-background/60 p-3">
                        <div className="flex items-center gap-2 w-20 shrink-0 text-xs font-semibold text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" /> {format(new Date(e.scheduled_at), "h:mm a")}
                        </div>
                        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold">{patient?.full_name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground capitalize">{e.mode} · {e.notes ?? e.status}</div>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                          e.status === "confirmed" ? "bg-success/15 text-success" :
                          e.status === "pending"   ? "bg-warning/15 text-warning" :
                          "bg-muted text-muted-foreground"
                        }`}>{e.status}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">No appointments scheduled for today.</p>
              )}
            </SectionCard>
          )}
        </div>

        {/* Availability editor */}
        <SectionCard
          title="My availability"
          action={
            !editing ? (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={startEdit}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            ) : (
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" onClick={cancelEdit} disabled={saving}>
                  <X className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" className="bg-gradient-primary text-primary-foreground gap-1" onClick={saveAvailability} disabled={saving}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Save
                </Button>
              </div>
            )
          }
        >
          {loadingAvail ? (
            <div className="space-y-3">
              <div className="h-8 rounded-lg shimmer-bg" />
              <div className="h-10 rounded-lg shimmer-bg" />
            </div>
          ) : editing ? (
            <div className="space-y-4">
              {/* Day toggles */}
              <div>
                <div className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Available days</div>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map(day => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                        draftDays.includes(day)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hours input */}
              <div>
                <div className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Available hours</div>
                <div className="relative">
                  <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={draftHours}
                    onChange={e => setDraftHours(e.target.value)}
                    placeholder="e.g. 9:00 AM – 5:00 PM"
                    className="pl-10"
                    autoComplete="off"
                  />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Use a time range such as 9:00 AM – 5:00 PM. Booking offers 30-minute slots.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Display days */}
              <div>
                <div className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Available days</div>
                {availDays.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {DAYS.filter(d => availDays.includes(d)).map(day => (
                      <span key={day} className="rounded-lg border border-success/30 bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                        {day.slice(0, 3)}
                      </span>
                    ))}
                    {DAYS.filter(d => !availDays.includes(d)).map(day => (
                      <span key={day} className="rounded-lg border border-border/40 px-3 py-1 text-xs text-muted-foreground/40">
                        {day.slice(0, 3)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No days set. Click Edit to configure.</p>
                )}
              </div>

              {/* Display hours */}
              <div>
                <div className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Available hours</div>
                <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/60 px-3 py-2.5">
                  <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium">
                    {availHours || <span className="text-muted-foreground">Not set</span>}
                  </span>
                </div>
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </DashboardLayout>
  );
};
export default Schedule;
