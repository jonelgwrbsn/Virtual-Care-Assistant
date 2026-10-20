import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard, SectionCard, StatCardSkeleton, SectionCardSkeleton } from "@/components/dashboard/Cards";
import { Users, MessagesSquare, ClipboardList, AlertCircle, Eye, ArrowRight, Calendar, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  useDoctorQueue,
  useLiveConsultations,
  useCompletedConsultations,
  useDoctorAiConsultations,
  useDoctorPatients,
  useDoctorDataRefresh,
  updateDoctorAppointmentStatus,
} from "@/hooks/use-supabase-data";
import { formatDistanceToNow, format } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

const priorityConfig = (status: string, scheduledAt: string) => {
  const minsUntil = (new Date(scheduledAt).getTime() - Date.now()) / 60000;
  if (status === "confirmed" && minsUntil >= -30 && minsUntil <= 30) return { label: "Urgent",   color: "bg-destructive/15 text-destructive" };
  if (status === "pending")                       return { label: "Pending",  color: "bg-warning/15 text-warning" };
  return                                                 { label: "Routine",  color: "bg-success/15 text-success" };
};

const DoctorDashboard = () => {
  const { refetchKey, refresh } = useDoctorDataRefresh();
  const { data: queueData, loading: queueLoading, error: queueError } = useDoctorQueue(refetchKey);
  const { data: live, loading: liveLoading, error: liveError } = useLiveConsultations(refetchKey);
  const { data: completed, loading: completedLoading, error: completedError } = useCompletedConsultations(refetchKey);
  const { data: aiConsultations, loading: aiConsultationsLoading, error: aiConsultationsError } = useDoctorAiConsultations(refetchKey);
  const { data: patients, loading: patientsLoading, error: patientsError } = useDoctorPatients(refetchKey);
  const [updatingAppointmentId, setUpdatingAppointmentId] = useState<string | null>(null);

  const queue = queueData?.appointments ?? [];
  const loading = queueLoading || liveLoading || completedLoading || aiConsultationsLoading || patientsLoading;
  const dataError = [liveError, completedError, aiConsultationsError, patientsError].find(Boolean);

  const urgentCount = queue.filter(a => {
    const mins = (new Date(a.scheduled_at).getTime() - Date.now()) / 60000;
    return a.status === "confirmed" && mins >= -30 && mins <= 30;
  }).length;

  const setAppointmentStatus = async (id: string, status: "confirmed" | "cancelled" | "completed") => {
    setUpdatingAppointmentId(id);
    try {
      await updateDoctorAppointmentStatus(id, status);
      toast.success(status === "confirmed" ? "Appointment approved" : status === "cancelled" ? "Appointment declined" : "Appointment marked complete");
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update appointment.");
    } finally {
      setUpdatingAppointmentId(null);
    }
  };

  return (
    <DashboardLayout requiredRole="doctor">
      <div className="mb-7 animate-fade-in">
        <p className="text-sm text-muted-foreground">Doctor portal</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">Today's queue</h1>
      </div>

      {dataError && (
        <p role="alert" className="mb-5 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Some doctor records could not be loaded. Counts may be incomplete: {dataError}
        </p>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="stagger grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard icon={Users}        label="Patients" value={patients?.length ?? 0} trend="On your roster" accent="primary" />
          <StatCard icon={MessagesSquare} label="Live sessions"   value={live?.length ?? 0}        trend="Active now"                    accent="secondary" />
          <StatCard icon={ClipboardList} label="Confirmed appointments" value={queueData?.confirmedUpcomingCount ?? 0} trend={`${queueData?.confirmedTodayCount ?? 0} today · all upcoming`} accent="success" />
          <StatCard icon={AlertCircle}   label="Pending review"   value={queueData?.pendingCount ?? 0} trend="Needs confirmation" accent="warning" />
          <StatCard icon={MessagesSquare} label="Patient chats" value={aiConsultations?.length ?? 0} trend="AI triage today" accent="secondary" />
        </div>
      )}

      {loading ? (
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          <SectionCardSkeleton rows={5} className="lg:col-span-2" />
          <SectionCardSkeleton rows={3} />
        </div>
      ) : (
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          <SectionCard title="Upcoming appointments & requests" className="lg:col-span-2" action={
            <Button asChild variant="ghost" size="sm" className="gap-1.5"><Link to="/doctor/schedule"><Calendar className="h-3.5 w-3.5" /> View schedule</Link></Button>
          }>
            {queueError ? (
              <div role="alert" className="flex flex-col items-center gap-3 py-6 text-center">
                <p className="text-sm text-destructive">Could not load your appointment queue: {queueError}</p>
                <Button type="button" variant="outline" size="sm" onClick={refresh}>Retry</Button>
              </div>
            ) : queue.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <th className="pb-3 pr-4">Patient</th>
                      <th className="pb-3 pr-4 hidden sm:table-cell">Reason</th>
                      <th className="pb-3 pr-4">Priority</th>
                      <th className="pb-3 pr-4 hidden md:table-cell">Time</th>
                      <th className="pb-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {queue.map(a => {
                      const patient = a.patient;
                      const initials = patient?.full_name?.split(" ").map((s: string) => s[0]).join("") ?? "?";
                      const priority = priorityConfig(a.status, a.scheduled_at);
                      return (
                        <tr key={a.id} className="group transition-colors hover:bg-accent/40">
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-primary text-[11px] font-bold text-primary-foreground">
                                {initials}
                              </div>
                              <div className="font-medium">{patient?.full_name ?? "Unknown"}</div>
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground hidden sm:table-cell line-clamp-1 max-w-[180px]">{a.notes ?? "—"}</td>
                          <td className="py-3 pr-4">
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${priority.color}`}>{priority.label}</span>
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground hidden md:table-cell text-xs">
                            {format(new Date(a.scheduled_at), new Date(a.scheduled_at).toDateString() === new Date().toDateString() ? "h:mm a" : "MMM d, h:mm a")}
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex justify-end gap-1">
                              {a.status === "pending" && (
                                <>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    aria-label={`Approve appointment for ${patient?.full_name ?? "patient"}`}
                                    disabled={updatingAppointmentId === a.id}
                                    onClick={() => void setAppointmentStatus(a.id, "confirmed")}
                                  >
                                    {updatingAppointmentId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    aria-label={`Decline appointment for ${patient?.full_name ?? "patient"}`}
                                    disabled={updatingAppointmentId === a.id}
                                    onClick={() => void setAppointmentStatus(a.id, "cancelled")}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                              {a.status === "confirmed" && (
                                <>
                                  {a.mode === "chat" && (
                                    <Button asChild type="button" variant="outline" size="sm" className="gap-1.5">
                                      <Link to={`/doctor/appointments/${a.id}/chat`}>
                                        <MessagesSquare className="h-3.5 w-3.5" /> Chat
                                      </Link>
                                    </Button>
                                  )}
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    aria-label={`Complete appointment for ${patient?.full_name ?? "patient"}`}
                                    disabled={updatingAppointmentId === a.id}
                                    onClick={() => void setAppointmentStatus(a.id, "completed")}
                                  >
                                    {updatingAppointmentId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Complete"}
                                  </Button>
                                </>
                              )}
                              <Button asChild variant="ghost" size="sm" className="gap-1.5 opacity-70 group-hover:opacity-100">
                                {patient?.id ? (
                                  <Link to={`/doctor/patients?patient=${encodeURIComponent(patient.id)}`}>
                                    <Eye className="h-3.5 w-3.5" /> Open
                                  </Link>
                                ) : <span>Unavailable</span>}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Your queue is clear</p>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    Pending booking requests and confirmed appointments appear here. There are none right now; check your full schedule for other dates.
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link to="/doctor/schedule">Open full schedule</Link>
                </Button>
              </div>
            )}
          </SectionCard>

          <SectionCard title="AI assistant insights">
            <div className="space-y-3">
              {completed && completed.length > 0 ? (
                completed.slice(0, 3).map(c => {
                  const patient = c.patient;
                  return (
                    <div key={c.id} className="rounded-xl border border-border/60 bg-background/60 p-3">
                      <div className="mb-1 h-1 w-8 rounded-full bg-primary" />
                      <p className="text-sm line-clamp-2">{c.summary ?? "Consultation completed"}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {patient?.full_name} · {c.ended_at ? formatDistanceToNow(new Date(c.ended_at), { addSuffix: true }) : "—"}
                      </p>
                      {patient?.id && (
                        <Link to={`/doctor/patients?patient=${encodeURIComponent(patient.id)}`} className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline">
                          View patient <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">No completed consultations today yet.</p>
              )}
              <Button asChild variant="outline" size="sm" className="w-full gap-1.5">
                <Link to="/doctor/consultations">View all consultations <ArrowRight className="h-3.5 w-3.5" /></Link>
              </Button>
            </div>
          </SectionCard>
        </div>
      )}
    </DashboardLayout>
  );
};
export default DoctorDashboard;
