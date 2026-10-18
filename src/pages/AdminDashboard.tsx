import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard, SectionCard, StatCardSkeleton, SectionCardSkeleton } from "@/components/dashboard/Cards";
import { Users, Stethoscope, ShieldCheck, ClipboardList, UserPlus, CalendarPlus, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";
import { useAdminStats, useAllUsers, useAllAppointments } from "@/hooks/use-supabase-data";
import { format, formatDistanceToNow } from "date-fns";

const statusColor: Record<string, string> = {
  confirmed: "bg-success/15 text-success",
  pending:   "bg-warning/15 text-warning",
  cancelled: "bg-destructive/15 text-destructive",
  completed: "bg-muted text-muted-foreground",
};

const AdminDashboard = () => {
  const { data: stats, loading: statsLoading, error: statsError } = useAdminStats();
  const { data: users,  loading: usersLoading }  = useAllUsers();
  const { data: appts,  loading: apptsLoading }  = useAllAppointments();

  // Recent 5 appointments for the overview
  const recentAppts = (appts ?? []).slice(0, 5);

  return (
    <DashboardLayout requiredRole="admin">
      <div className="mb-7">
        <p className="text-sm text-muted-foreground">Hospital operations</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">Admin overview</h1>
      </div>

      {statsLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : statsError ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Could not load platform counts: {statsError}
        </p>
      ) : (
        <div className="stagger grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard icon={Users}        label="Total users"     value={stats?.totalUsers ?? 0}       trend={`${stats?.patients ?? 0} patients`}  accent="primary" />
          <StatCard icon={Stethoscope}  label="Active doctors"  value={stats?.doctors ?? 0}          trend="on platform"                         accent="secondary" />
          <StatCard icon={ClipboardList} label="Appointments"   value={stats?.totalAppointments ?? 0} trend={`${stats?.pendingAppts ?? 0} pending`} accent="warning" />
          <StatCard icon={ShieldCheck}  label="Live consults"   value={stats?.liveConsults ?? 0}     trend="active now"                          accent="success" />
        </div>
      )}

      {/* Quick actions */}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { icon: UserPlus,     label: "Invite user",           desc: "Add doctor, patient, or admin",    to: "/admin/users",        accent: "bg-primary/10 text-primary" },
          { icon: CalendarPlus, label: "Manage appointments",   desc: "Confirm, cancel, or reschedule",   to: "/admin/appointments", accent: "bg-secondary/10 text-secondary" },
          { icon: BarChart3,    label: "View analytics",        desc: "Platform performance & trends",    to: "/admin/analytics",    accent: "bg-success/10 text-success" },
        ].map((a, i) => (
          <Link key={i} to={a.to} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-4 transition-all hover:border-primary/30 hover:shadow-soft">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${a.accent}`}>
              <a.icon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">{a.label}</div>
              <div className="text-xs text-muted-foreground">{a.desc}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {usersLoading ? (
          <SectionCardSkeleton rows={5} className="lg:col-span-2" />
        ) : (
          <SectionCard title="Recent users" className="lg:col-span-2" action={
            <Link to="/admin/users" className="text-xs font-semibold text-primary hover:underline">View all</Link>
          }>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="pb-3 pr-4">User</th>
                    <th className="pb-3 pr-4 hidden sm:table-cell">Role</th>
                    <th className="pb-3 pr-4 hidden md:table-cell">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {(users ?? []).slice(0, 6).map((u: any) => (
                    <tr key={u.id} className="transition-colors hover:bg-accent/40">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-primary text-[11px] font-bold text-primary-foreground">
                            {u.full_name.split(" ").map((s: string) => s[0]).slice(0, 2).join("")}
                          </div>
                          <div>
                            <div className="font-medium">{u.full_name}</div>
                            <div className="text-xs text-muted-foreground">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 hidden sm:table-cell">
                        <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-foreground/70 capitalize">{u.role}</span>
                      </td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground hidden md:table-cell">
                        {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}

        {apptsLoading ? (
          <SectionCardSkeleton rows={3} />
        ) : (
          <SectionCard title="Recent appointments">
            <ul className="divide-y divide-border/60">
              {recentAppts.map((a: any) => (
                <li key={a.id} className="py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium truncate">{(a.patient as any)?.full_name ?? "—"}</div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusColor[a.status]}`}>{a.status}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {(a.doctor as any)?.full_name ?? "—"} · {format(new Date(a.scheduled_at), "MMM d, h:mm a")}
                  </div>
                </li>
              ))}
            </ul>
            <Link to="/admin/appointments" className="mt-3 block text-center text-xs font-semibold text-primary hover:underline">
              Manage all appointments →
            </Link>
          </SectionCard>
        )}
      </div>
    </DashboardLayout>
  );
};
export default AdminDashboard;
