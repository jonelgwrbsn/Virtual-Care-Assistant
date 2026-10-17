import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard, SectionCard, StatCardSkeleton, ChartSkeleton } from "@/components/dashboard/Cards";
import { TrendingUp, Users, MessagesSquare, CheckCircle2 } from "lucide-react";
import { useAdminStats, useAnalyticsData } from "@/hooks/use-supabase-data";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
  PieChart, Pie, Cell,
} from "recharts";

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--muted-foreground))",
];

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "12px",
  fontSize: "12px",
  boxShadow: "var(--shadow-card)",
  padding: "8px 12px",
};

const Analytics = () => {
  const { data: stats,     loading: statsLoading }     = useAdminStats();
  const { data: analytics, loading: analyticsLoading } = useAnalyticsData();
  const loading = statsLoading || analyticsLoading;

  const resolutionRate = stats && stats.totalConsults > 0
    ? Math.round(((stats.totalConsults - stats.liveConsults) / stats.totalConsults) * 100)
    : 0;

  return (
    <DashboardLayout requiredRole="admin">
      <div className="mb-7 animate-fade-in">
        <p className="text-sm text-muted-foreground">Insights</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">Live performance across the platform.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="stagger grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard icon={Users}        label="Total users"      value={stats?.totalUsers ?? 0}    trend={`${stats?.patients ?? 0} patients`}  accent="primary" />
          <StatCard icon={MessagesSquare} label="Consultations"  value={stats?.totalConsults ?? 0} trend="all time"                            accent="secondary" />
          <StatCard icon={CheckCircle2} label="Resolved"         value={`${resolutionRate}%`}      trend="resolution rate"                    accent="success" />
          <StatCard icon={TrendingUp}   label="Live now"         value={stats?.liveConsults ?? 0}  trend="active sessions"                    accent="warning" />
        </div>
      )}

      {loading ? (
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          <ChartSkeleton className="lg:col-span-2" />
          <ChartSkeleton />
        </div>
      ) : (
        <div className="mt-6 grid gap-5 lg:grid-cols-3 animate-fade-in" style={{ animationDelay: "200ms" }}>
          <SectionCard title="Consultations · this week" className="lg:col-span-2">
            {analytics && analytics.trend.some((d) => d.consults > 0) ? (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.trend} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gConsults" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="hsl(var(--primary))"   stopOpacity={0.45} />
                        <stop offset="95%" stopColor="hsl(var(--primary))"   stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 6" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "3 3" }} />
                    <Area type="monotone" dataKey="consults" name="Consultations" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#gConsults)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                No consultation data this week yet.
              </div>
            )}
          </SectionCard>

          <SectionCard title="Top conditions">
            {analytics && analytics.conditions.length > 0 ? (
              <>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analytics.conditions}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={48}
                        outerRadius={78}
                        paddingAngle={3}
                        stroke="hsl(var(--card))"
                        strokeWidth={2}
                      >
                        {analytics.conditions.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {analytics.conditions.map((c, i) => (
                    <li key={c.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="font-medium">{c.name}</span>
                      </div>
                      <span className="text-muted-foreground tabular-nums">{c.value}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
                No condition data yet.
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </DashboardLayout>
  );
};
export default Analytics;
