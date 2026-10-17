import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard, SectionCard, StatCardSkeleton, SectionCardSkeleton } from "@/components/dashboard/Cards";
import { ShieldAlert, AlertTriangle, Lock, Activity } from "lucide-react";
import { useSecurityEvents, useAdminStats } from "@/hooks/use-supabase-data";
import { format } from "date-fns";

const levelColor: Record<string, string> = {
  Info:     "bg-success/15 text-success",
  Critical: "bg-destructive/15 text-destructive",
  Warning:  "bg-warning/15 text-warning",
};

const roleLevel: Record<string, string> = {
  admin:   "Critical",
  doctor:  "Info",
  patient: "Info",
};

const Security = () => {
  const { data: events, loading: eventsLoading } = useSecurityEvents();
  const { data: stats,  loading: statsLoading  } = useAdminStats();

  return (
    <DashboardLayout requiredRole="admin">
      <div className="mb-7">
        <p className="text-sm text-muted-foreground">Compliance & access</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">Security</h1>
      </div>

      {statsLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="stagger grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard icon={ShieldAlert}   label="Security review" value="Not assessed"         trend="Database policies need verification" accent="warning" />
          <StatCard icon={Lock}          label="Total users"   value={stats?.totalUsers ?? 0}  trend="registered accounts"              accent="primary" />
          <StatCard icon={AlertTriangle} label="Admin accounts" value={stats?.admins ?? 0}     trend="privileged access"                accent="warning" />
          <StatCard icon={Activity}      label="Live sessions" value={stats?.liveConsults ?? 0} trend="active consultations"            accent="secondary" />
        </div>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <SectionCard title="Access safeguards" className="lg:col-span-3">
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Staff invitations require an active administrator session with multi-factor authentication.</li>
            <li>Global MFA enforcement for every staff login is not implemented in this app.</li>
            <li>Database row-level security policies have not been verified from this repository.</li>
          </ul>
        </SectionCard>

        {eventsLoading ? (
          <SectionCardSkeleton rows={5} className="lg:col-span-2" />
        ) : (
          <SectionCard title="Recent account activity" className="lg:col-span-2">
            {events && events.length > 0 ? (
              <ul className="divide-y divide-border/60">
                {events.map((ev, i) => {
                  const level = roleLevel[ev.role] ?? "Info";
                  return (
                    <li key={i} className="flex items-center gap-4 py-3">
                      <div className="text-xs font-mono text-muted-foreground w-28 shrink-0">
                        {format(new Date(ev.time), "MMM d, h:mm a")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{ev.event}</div>
                        <div className="text-xs text-muted-foreground truncate">{ev.who} · {ev.role}</div>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${levelColor[level]}`}>
                        {level}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">No recent activity.</p>
            )}
          </SectionCard>
        )}

        <SectionCard title="Compliance review status">
          <ul className="space-y-3 text-sm">
            {[
              { l: "HIPAA",        s: "Not assessed" },
              { l: "SOC 2 Type II", s: "Not assessed" },
              { l: "GDPR",         s: "Not assessed" },
              { l: "ISO 27001",    s: "Not assessed" },
            ].map((c, i) => (
              <li key={i} className="flex items-center justify-between rounded-xl border border-border/60 bg-background/60 px-3 py-2.5">
                <span className="font-medium">{c.l}</span>
                <span className="text-xs font-semibold text-warning">{c.s}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </DashboardLayout>
  );
};
export default Security;
