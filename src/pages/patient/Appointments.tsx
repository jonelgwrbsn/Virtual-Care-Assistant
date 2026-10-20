import { DashboardLayout } from "@/components/DashboardLayout";
import { SectionCard, SectionCardSkeleton } from "@/components/dashboard/Cards";
import { Calendar, Clock, Video, MapPin, Plus, MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePatientAppointments } from "@/hooks/use-supabase-data";
import { BookAppointmentModal } from "@/components/BookAppointmentModal";
import { format } from "date-fns";
import { useState } from "react";

const modeIcon = { video: Video, "in-person": MapPin, chat: MessagesSquare } as const;

const statusColor: Record<string, string> = {
  confirmed: "text-success bg-success/10",
  pending:   "text-warning bg-warning/10",
  cancelled: "text-destructive bg-destructive/10",
  completed: "text-muted-foreground bg-muted",
};

type PatientAppointment = NonNullable<ReturnType<typeof usePatientAppointments>["data"]>["upcoming"][number];

const Appointments = () => {
  const [bookOpen, setBookOpen] = useState(false);
  // refetch trigger
  const [refetchKey, setRefetchKey] = useState(0);
  const { data, loading, error } = usePatientAppointments(refetchKey);
  const upcoming = data?.upcoming ?? [];
  const past = data?.past ?? [];
  const declined = data?.declined ?? [];
  const approved = data?.approved ?? [];

  return (
    <DashboardLayout requiredRole="patient">
      <BookAppointmentModal
        open={bookOpen}
        onClose={() => setBookOpen(false)}
        onBooked={() => setRefetchKey(k => k + 1)}
      />

      <div className="mb-7 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-muted-foreground">Your schedule</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Appointments</h1>
        </div>
        <Button onClick={() => setBookOpen(true)} className="bg-gradient-primary text-primary-foreground gap-2">
          <Plus className="h-4 w-4" /> Book appointment
        </Button>
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Failed to load appointments: {error}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {loading ? (
          <>
            <SectionCardSkeleton rows={3} className="lg:col-span-2" />
            <SectionCardSkeleton rows={3} />
          </>
        ) : (
          <>
            <SectionCard title={`Upcoming (${upcoming.length})`} className="lg:col-span-2">
              {upcoming.length > 0 ? (
                <ul className="space-y-3">
                  {upcoming.map((a: PatientAppointment) => {
                    const Icon = modeIcon[a.mode as keyof typeof modeIcon] ?? Calendar;
                    const doctor = a.doctor?.[0]?.full_name ?? "Unknown doctor";
                    return (
                      <li key={a.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-border/60 bg-background/60 p-4 sm:flex-nowrap">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold">{doctor}</div>
                          <div className="text-xs text-muted-foreground capitalize">{a.mode}{a.notes ? ` · ${a.notes}` : ""}</div>
                        </div>
                        <div className="text-right text-xs shrink-0">
                          <div className="font-medium">{format(new Date(a.scheduled_at), "MMM d, yyyy")}</div>
                          <div className="flex items-center gap-1 text-muted-foreground justify-end">
                            <Clock className="h-3 w-3" />
                            {format(new Date(a.scheduled_at), "h:mm a")}
                          </div>
                          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusColor[a.status]}`}>
                            {a.status === "confirmed" ? "Approved" : a.status}
                          </span>
                        </div>
                        {a.status === "confirmed" && (a.mode === "video" || a.mode === "chat") && (
                          <Button asChild size="sm" className="w-full bg-gradient-primary text-primary-foreground sm:w-auto">
                            <a
                              href={`https://meet.vca.health/${a.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Join
                            </a>
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <Calendar className="h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No upcoming appointments</p>
                  <Button size="sm" onClick={() => setBookOpen(true)} className="bg-gradient-primary text-primary-foreground gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Book your first appointment
                  </Button>
                </div>
              )}
            </SectionCard>

            <SectionCard title="Appointment history">
              <div>
                <h2 className="text-sm font-semibold">Approved requests ({approved.length})</h2>
                {approved.length > 0 ? (
                  <ul className="divide-y divide-border/60">
                    {approved.slice(0, 6).map((appointment: PatientAppointment) => {
                      const doctor = appointment.doctor?.[0]?.full_name ?? "Unknown doctor";
                      return (
                        <li key={appointment.id} className="py-3">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" /> {doctor}
                          </div>
                          <div className="mt-0.5 flex items-center justify-between gap-2">
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(appointment.scheduled_at), "MMM d, yyyy")}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusColor.confirmed}`}>
                              Approved
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="py-3 text-sm text-muted-foreground">No approved requests yet.</p>
                )}
              </div>

              <div>
                <h2 className="text-sm font-semibold">Past visits ({past.length})</h2>
                {past.length > 0 ? (
                  <ul className="divide-y divide-border/60">
                    {past.slice(0, 6).map((p: PatientAppointment) => {
                      const doctor = p.doctor?.[0]?.full_name ?? "Unknown doctor";
                      return (
                        <li key={p.id} className="py-3">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" /> {doctor}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {format(new Date(p.scheduled_at), "MMM d, yyyy")} · {p.notes ?? p.status}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="py-3 text-sm text-muted-foreground">No past visits yet.</p>
                )}
              </div>

              <div className="mt-3 border-t border-border/60 pt-3">
                <h2 className="text-sm font-semibold">Declined requests ({declined.length})</h2>
                {declined.length > 0 ? (
                  <ul className="divide-y divide-border/60">
                    {declined.slice(0, 6).map((appointment: PatientAppointment) => {
                      const doctor = appointment.doctor?.[0]?.full_name ?? "Unknown doctor";
                      return (
                        <li key={appointment.id} className="py-3">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" /> {doctor}
                          </div>
                          <div className="mt-0.5 flex items-center justify-between gap-2">
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(appointment.scheduled_at), "MMM d, yyyy")}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusColor.cancelled}`}>
                              Declined
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="py-3 text-sm text-muted-foreground">No declined requests.</p>
                )}
              </div>
            </SectionCard>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};
export default Appointments;
