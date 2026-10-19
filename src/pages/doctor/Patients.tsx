import { DashboardLayout } from "@/components/DashboardLayout";
import { SectionCard, SectionCardSkeleton } from "@/components/dashboard/Cards";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useDoctorPatients, usePatientProfile } from "@/hooks/use-supabase-data";
import { Avatar } from "@/components/AvatarUpload";
import { format, formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const statusConfig = (status: string) => {
  switch (status) {
    case "confirmed": return { label: "Active",      color: "bg-success/15 text-success" };
    case "pending":   return { label: "Pending",     color: "bg-warning/15 text-warning" };
    case "completed": return { label: "Stable",      color: "bg-success/15 text-success" };
    case "cancelled": return { label: "Rescheduled", color: "bg-muted text-muted-foreground" };
    default:          return { label: status,        color: "bg-muted text-muted-foreground" };
  }
};

const Patients = () => {
  const { data: patients, loading } = useDoctorPatients();
  const [search, setSearch] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedPatientId = searchParams.get("patient");

  const filtered = (patients ?? []).filter(p =>
    p.full_name.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const selectedPatient = patients?.find(p => p.id === selectedPatientId);
    if (selectedPatient) setSearch(selectedPatient.full_name);
  }, [patients, selectedPatientId]);

  const closePatient = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("patient");
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <DashboardLayout requiredRole="doctor">
      {selectedPatientId && (
        <PatientProfileDialog patientId={selectedPatientId} onClose={closePatient} />
      )}
      <div className="mb-7">
        <p className="text-sm text-muted-foreground">Doctor portal</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">Patients</h1>
        <p className="mt-1 text-sm text-muted-foreground">All patients you currently treat or monitor.</p>
      </div>

      {loading ? (
        <SectionCardSkeleton rows={6} />
      ) : (
        <SectionCard
          title={`${filtered.length} patient${filtered.length !== 1 ? "s" : ""}`}
          action={
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="h-9 pl-9 w-56"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          }
        >
          {filtered.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="pb-3 pr-4">Patient</th>
                    <th className="pb-3 pr-4 hidden md:table-cell">Last visit</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 text-right">Profile</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filtered.map(p => {
                    const cfg = statusConfig(p.lastStatus);
                    return (
                      <tr key={p.id} className="transition-colors hover:bg-accent/40">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2.5">
                            <Avatar avatarUrl={p.avatar_url ?? null} name={p.full_name} size="sm" />
                            <div className="font-medium">{p.full_name}</div>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground hidden md:table-cell text-xs">
                          {formatDistanceToNow(new Date(p.lastVisit), { addSuffix: true })}
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${cfg.color}`}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setSearchParams({ patient: p.id })}
                          >
                            Open profile
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {search ? "No patients match your search." : "No patients assigned yet."}
            </p>
          )}
        </SectionCard>
      )}
    </DashboardLayout>
  );
};

const PatientProfileDialog = ({ patientId, onClose }: { patientId: string; onClose: () => void }) => {
  const { data, loading, error } = usePatientProfile(patientId);
  const profile = data?.profile;

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{profile?.full_name ?? "Patient profile"}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading patient profile…</p>
        ) : error ? (
          <p role="alert" className="py-4 text-sm text-destructive">
            Couldn’t load this patient profile. Close the dialog and try again.
          </p>
        ) : data ? (
          <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
            <div className="text-sm text-muted-foreground">{profile?.email}</div>
            <section className="rounded-xl border border-border/60 p-3">
              <h3 className="mb-2 text-sm font-semibold">Health background</h3>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Known conditions</dt>
                  <dd>{profile?.medical_conditions || "Not recorded"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Allergies</dt>
                  <dd>{profile?.allergies || "Not recorded"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Blood type</dt>
                  <dd>{profile?.blood_type || "Not recorded"}</dd>
                </div>
              </dl>
            </section>
            <section className="rounded-xl border border-border/60 p-3">
              <h3 className="mb-2 text-sm font-semibold">Latest vitals</h3>
              {data.latestVitals ? (
                <>
                  <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                    <span>Heart rate: {data.latestVitals.heart_rate ?? "—"} bpm</span>
                    <span>Blood pressure: {data.latestVitals.systolic_bp ?? "—"}/{data.latestVitals.diastolic_bp ?? "—"}</span>
                    <span>SpO₂: {data.latestVitals.spo2 ?? "—"}%</span>
                    <span>Temperature: {data.latestVitals.body_temp ?? "—"}°C</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Recorded {data.latestVitals.recorded_at ? formatDistanceToNow(new Date(data.latestVitals.recorded_at), { addSuffix: true }) : "date unavailable"}
                  </p>
                </>
              ) : <p className="text-sm text-muted-foreground">No vitals recorded.</p>}
            </section>
            <section className="rounded-xl border border-border/60 p-3">
              <h3 className="mb-2 text-sm font-semibold">Recent AI triage</h3>
              {data.consultations.length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {data.consultations.map((consultation: { id: string; started_at: string; summary: string | null }) => (
                    <li key={consultation.id}>
                      <span className="font-medium">Triage chat</span>
                      <span className="text-muted-foreground"> · {format(new Date(consultation.started_at), "MMM d, yyyy h:mm a")}</span>
                      {consultation.summary && <p className="text-muted-foreground">{consultation.summary}</p>}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted-foreground">No AI triage sessions are available.</p>}
              {data.recentMessages.length > 0 && (
                <div className="mt-3 border-t border-border/60 pt-3">
                  <h4 className="mb-1 text-xs font-semibold text-muted-foreground">Recent patient messages</h4>
                  <ul className="space-y-2 text-sm">
                    {data.recentMessages.map((message: { id: string; content: string; created_at: string }) => (
                      <li key={message.id}>
                        <p>{message.content}</p>
                        <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
            <section className="rounded-xl border border-border/60 p-3">
              <h3 className="mb-2 text-sm font-semibold">Recent records</h3>
              {data.records.length > 0 ? (
                <ul className="space-y-1 text-sm">
                  {data.records.map((record: { id: string; title: string; recorded_date: string | null }) => (
                    <li key={record.id}>{record.title} · {record.recorded_date ? format(new Date(record.recorded_date), "MMM d, yyyy") : "Date unavailable"}</li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted-foreground">No records available.</p>}
            </section>
            <section className="rounded-xl border border-border/60 p-3">
              <h3 className="mb-2 text-sm font-semibold">Recent appointments</h3>
              {data.appointments.length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {data.appointments.map((appointment: { id: string; scheduled_at: string; status: string; mode: string }) => (
                    <li key={appointment.id} className="flex items-center justify-between gap-2">
                      <span>{format(new Date(appointment.scheduled_at), "MMM d, yyyy h:mm a")} · {appointment.mode}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{appointment.status}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted-foreground">No appointments found.</p>}
            </section>
          </div>
        ) : (
          <p role="alert" className="py-4 text-sm text-destructive">Patient profile not found.</p>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default Patients;
