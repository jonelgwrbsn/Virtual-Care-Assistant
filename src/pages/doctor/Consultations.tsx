import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard, SectionCard, StatCardSkeleton, SectionCardSkeleton } from "@/components/dashboard/Cards";
import { MessagesSquare, Video, Clock, CheckCircle2, FileText, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useLiveConsultations, useCompletedConsultations } from "@/hooks/use-supabase-data";
import { formatDistanceToNow, format } from "date-fns";

const Consultations = () => {
  const { data: live,      loading: liveLoading }      = useLiveConsultations();
  const { data: completed, loading: completedLoading } = useCompletedConsultations();
  const loading = liveLoading || completedLoading;

  const avgDuration = completed && completed.length > 0
    ? Math.round(
        completed.reduce((sum: number, c: any) => {
          if (!c.ended_at) return sum;
          const mins = (new Date(c.ended_at).getTime() - new Date(c.started_at).getTime()) / 60000;
          return sum + mins;
        }, 0) / completed.filter((c: any) => c.ended_at).length
      )
    : 0;

  return (
    <DashboardLayout requiredRole="doctor">
      <div className="mb-7">
        <p className="text-sm text-muted-foreground">Doctor portal</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">Consultations</h1>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="stagger grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard icon={MessagesSquare} label="Active now"       value={live?.length ?? 0}      trend="Live sessions"          accent="primary" />
          <StatCard icon={CheckCircle2}   label="Completed today"  value={completed?.length ?? 0} trend="consultations"          accent="success" />
          <StatCard icon={Clock}          label="Avg duration"     value={avgDuration > 0 ? `${avgDuration}m` : "—"} trend="today" accent="secondary" />
          <StatCard icon={FileText}       label="With summaries"   value={(completed ?? []).filter((c: any) => c.summary).length} trend="documented" accent="warning" />
        </div>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {liveLoading ? (
          <SectionCardSkeleton rows={2} className="lg:col-span-2" />
        ) : (
          <SectionCard title="Live sessions" className="lg:col-span-2">
            {live && live.length > 0 ? (
              <ul className="space-y-3">
                {live.map((c: any) => {
                  const patient = (c.patient as any);
                  const initials = patient?.full_name?.split(" ").map((s: string) => s[0]).join("") ?? "?";
                  const appt = (c.appointment as any);
                  return (
                    <li key={c.id} className="flex items-center gap-4 rounded-xl border border-border/60 bg-background/60 p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold">{patient?.full_name ?? "Unknown"}</div>
                        <div className="text-xs text-muted-foreground">
                          {appt?.notes ?? "Consultation"} · started {formatDistanceToNow(new Date(c.started_at), { addSuffix: true })}
                        </div>
                      </div>
                      <span className="rounded-full bg-success/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-success capitalize">
                        {appt?.mode ?? "Chat"}
                      </span>
                      <Button asChild size="sm" className="bg-gradient-primary text-primary-foreground gap-1.5">
                        <a
                          href={`https://meet.vca.health/${c.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Video className="h-3.5 w-3.5" /> Join
                        </a>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">No live sessions right now.</p>
            )}
          </SectionCard>
        )}

        {completedLoading ? (
          <SectionCardSkeleton rows={3} />
        ) : (
          <SectionCard title="Completed today">
            {completed && completed.length > 0 ? (
              <ul className="divide-y divide-border/60">
                {completed.map((c: any) => {
                  const patient = (c.patient as any);
                  return (
                    <li key={c.id} className="py-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium">{patient?.full_name ?? "Unknown"}</div>
                        <Link to="/doctor/patients" className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline shrink-0">
                          <Activity className="h-3 w-3" /> Progress
                        </Link>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {c.ended_at ? format(new Date(c.ended_at), "h:mm a") : "—"} · {(c.appointment as any)?.notes ?? "Consultation"}
                      </div>
                      {c.summary && (
                        <div className="mt-1 text-xs text-success line-clamp-1">{c.summary}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">No completed consultations today.</p>
            )}
          </SectionCard>
        )}
      </div>
    </DashboardLayout>
  );
};
export default Consultations;
