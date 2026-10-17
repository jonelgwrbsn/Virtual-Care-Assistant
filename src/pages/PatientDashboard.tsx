import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard, SectionCard, StatCardSkeleton, SectionCardSkeleton } from "@/components/dashboard/Cards";
import { Activity, Heart, Calendar, MessagesSquare, ArrowRight, Thermometer, AlertCircle, Phone, Wind } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { getSession } from "@/lib/auth";
import { useLatestVitals, usePatientConsultations, usePatientAppointments } from "@/hooks/use-supabase-data";
import { BookAppointmentModal } from "@/components/BookAppointmentModal";
import { format, formatDistanceToNow } from "date-fns";
import { useState } from "react";

const recommendationLevel: Record<string, { label: string; color: string }> = {
  completed: { label: "Reviewed", color: "text-success bg-success/10" },
  ai:        { label: "Monitor",  color: "text-success bg-success/10" },
  escalated: { label: "Consult",  color: "text-warning bg-warning/10" },
  live:      { label: "Active",   color: "text-primary bg-primary/10" },
};

const PatientDashboard = () => {
  const session = getSession();
  const { data: vitals, loading: vitalsLoading } = useLatestVitals();
  const { data: consults, loading: consultsLoading } = usePatientConsultations();
  const { data: appts, loading: apptsLoading } = usePatientAppointments();
  const [bookOpen, setBookOpen] = useState(false);

  const loading = vitalsLoading || consultsLoading || apptsLoading;
  const nextAppt = appts?.upcoming?.[0];
  const nextDoctor = (nextAppt?.doctor as any)?.full_name ?? "—";

  return (
    <DashboardLayout requiredRole="patient">
      <BookAppointmentModal open={bookOpen} onClose={() => setBookOpen(false)} />
      <div className="mb-7 animate-fade-in">
        <p className="text-sm text-muted-foreground">Welcome back</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">Hello, {session?.name?.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Here's your health snapshot for today.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="stagger grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard icon={Heart}       label="Heart rate"      value={vitals ? `${vitals.heart_rate}` : "—"}                          trend="bpm · resting"  accent="primary" />
          <StatCard icon={Thermometer} label="Body temp"       value={vitals ? `${vitals.body_temp}°C` : "—"}                         trend="Latest reading" accent="success" />
          <StatCard icon={Wind}        label="SpO₂"            value={vitals ? `${vitals.spo2}%` : "—"}                               trend="Oxygen sat."    accent="secondary" />
          <StatCard icon={Activity}    label="Steps today"     value={vitals ? vitals.steps.toLocaleString() : "—"}                   trend="steps"          accent="warning" />
        </div>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <SectionCard title="Start a care session" className="lg:col-span-2 bg-gradient-soft border-primary/10">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="max-w-md">
              <p className="text-sm text-muted-foreground">Describe your symptoms or upload a photo. The AI assistant will triage and guide you in seconds.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {["Headache", "Sore throat", "Skin rash", "Cough", "Fever"].map((s) => (
                  <Link key={s} to="/patient/chat" className="rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors">{s}</Link>
                ))}
              </div>
            </div>
            <Button asChild className="bg-gradient-primary text-primary-foreground hover:shadow-glow shrink-0">
              <Link to="/patient/chat" className="gap-2">
                <MessagesSquare className="h-4 w-4" /> Open Care Chat
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </SectionCard>

        <SectionCard title="Next appointment">
          {apptsLoading ? (
            <div className="space-y-2">
              <div className="h-12 w-full rounded-xl shimmer-bg" />
              <div className="h-8 w-full rounded-lg shimmer-bg" />
            </div>
          ) : nextAppt ? (
            <>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold">{nextDoctor}</div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(nextAppt.scheduled_at), "MMM d · h:mm a")}
                  </div>
                  <div className="text-xs text-muted-foreground capitalize">{nextAppt.mode}</div>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button asChild variant="outline" size="sm" className="flex-1">
                  <Link to="/patient/appointments">View details</Link>
                </Button>
                {nextAppt.status === "confirmed" &&
                  (nextAppt.mode === "video" || nextAppt.mode === "chat") && (
                    <Button asChild size="sm" className="flex-1 bg-gradient-primary text-primary-foreground gap-1.5">
                      <a
                        href={`https://meet.vca.health/${nextAppt.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MessagesSquare className="h-3.5 w-3.5" /> Join
                      </a>
                    </Button>
                  )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <Calendar className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No upcoming appointments</p>
              <Button asChild size="sm" className="bg-gradient-primary text-primary-foreground">
                <Link to="/patient/appointments">Book now</Link>
              </Button>            </div>
          )}
        </SectionCard>
      </div>

      {/* Emergency banner */}
      <div className="mt-4 flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
        <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
        <p className="flex-1 text-xs text-muted-foreground">
          <span className="font-semibold text-destructive">Emergency?</span> This app is for non-severe symptoms only. For emergencies, call <span className="font-semibold">911</span> or your local emergency number immediately.
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-destructive hover:bg-destructive/10 shrink-0"
          onClick={() => window.location.href = "tel:911"}
        >
          <Phone className="h-3.5 w-3.5" /> Emergency
        </Button>
      </div>

      {loading ? (
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <SectionCardSkeleton rows={3} />
          <SectionCardSkeleton rows={3} />
        </div>
      ) : (
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <SectionCard title="Recent assessments">
            {consults && consults.length > 0 ? (
              <ul className="divide-y divide-border/60">
                {consults.map((c: any) => {
                  const rec = recommendationLevel[c.status] ?? { label: c.status, color: "text-muted-foreground bg-muted" };
                  return (
                    <li key={c.id} className="flex items-center justify-between py-3">
                      <div>
                        <div className="text-sm font-medium line-clamp-1">{c.summary ?? "AI triage session"}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(c.started_at), { addSuffix: true })}
                        </div>
                      </div>
                      <span className={`ml-3 shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${rec.color}`}>{rec.label}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">No assessments yet. Start a care chat to get triaged.</p>
            )}
          </SectionCard>

          <SectionCard title="Health tips">
            <div className="space-y-3">
              {[
                "Drink at least 8 glasses of water today",
                "10 minutes of sunlight boosts vitamin D",
                "Aim for 7–9 hours of sleep tonight",
              ].map((t, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/60 p-3">
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <p className="text-sm">{t}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}
    </DashboardLayout>
  );
};
export default PatientDashboard;
