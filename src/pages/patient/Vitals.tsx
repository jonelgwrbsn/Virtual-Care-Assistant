import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard, SectionCard, StatCardSkeleton, SectionCardSkeleton } from "@/components/dashboard/Cards";
import { Heart, Thermometer, Activity, Wind, Gauge, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLatestVitals, useVitalsHistory } from "@/hooks/use-supabase-data";
import { LogVitalsModal } from "@/components/LogVitalsModal";
import { format } from "date-fns";

const bpStatus = (sys: number, dia: number) => {
  if (sys < 120 && dia < 80) return { label: "Optimal",      color: "text-success" };
  if (sys < 130 && dia < 80) return { label: "Elevated",     color: "text-warning" };
  if (sys < 140 || dia < 90) return { label: "High Stage 1", color: "text-warning" };
  return                            { label: "High Stage 2", color: "text-destructive" };
};

const hrStatus = (hr: number) => {
  if (hr >= 60 && hr <= 100) return "Normal";
  if (hr < 60) return "Low";
  return "Elevated";
};

const Vitals = () => {
  const [logOpen, setLogOpen] = useState(false);
  const [refetchKey, setRefetchKey] = useState(0);

  const { data: latest,  loading: latestLoading  } = useLatestVitals(refetchKey);
  const { data: history, loading: historyLoading } = useVitalsHistory(refetchKey);
  const loading = latestLoading || historyLoading;

  const bp = latest ? bpStatus(latest.systolic_bp, latest.diastolic_bp) : null;

  return (
    <DashboardLayout requiredRole="patient">
      <LogVitalsModal
        open={logOpen}
        onClose={() => setLogOpen(false)}
        onLogged={() => { setLogOpen(false); setRefetchKey(k => k + 1); }}
      />

      <div className="mb-7 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-muted-foreground">Live monitoring</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Vitals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {latest
              ? `Last updated ${format(new Date(latest.recorded_at), "MMM d, h:mm a")}`
              : "No readings yet. Log your first entry below."}
          </p>
        </div>
        <Button onClick={() => setLogOpen(true)} className="bg-gradient-primary text-primary-foreground gap-2">
          <Plus className="h-4 w-4" /> Log vitals
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="stagger grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard icon={Heart}       label="Heart rate"     value={latest ? `${latest.heart_rate}` : "—"}                         trend={latest ? `bpm · ${hrStatus(latest.heart_rate)}` : "No data"} accent="primary" />
          <StatCard icon={Gauge}       label="Blood pressure" value={latest ? `${latest.systolic_bp}/${latest.diastolic_bp}` : "—"} trend={bp?.label ?? "No data"}                                      accent="success" />
          <StatCard icon={Wind}        label="SpO₂"           value={latest ? `${latest.spo2}%` : "—"}                              trend={latest && latest.spo2 >= 95 ? "Normal" : latest ? "Low — consult" : "No data"} accent="secondary" />
          <StatCard icon={Thermometer} label="Body temp"      value={latest ? `${latest.body_temp}°C` : "—"}                        trend={latest && latest.body_temp <= 37.5 ? "Normal" : latest ? "Elevated" : "No data"} accent="warning" />
        </div>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {historyLoading ? (
          <SectionCardSkeleton rows={7} className="lg:col-span-2" />
        ) : (
          <SectionCard title="7-day overview" className="lg:col-span-2">
            {history && history.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <th className="pb-3 pr-4">Date</th>
                      <th className="pb-3 pr-4">Heart rate</th>
                      <th className="pb-3 pr-4">Blood pressure</th>
                      <th className="pb-3 pr-4">SpO₂</th>
                      <th className="pb-3">Temp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {history.map((h: any, i: number) => {
                      const isLatest = i === history.length - 1;
                      const bpS = bpStatus(h.systolic_bp, h.diastolic_bp);
                      return (
                        <tr key={h.recorded_at} className={isLatest ? "font-semibold" : ""}>
                          <td className="py-3 pr-4">{isLatest ? "Latest" : format(new Date(h.recorded_at), "EEE, MMM d")}</td>
                          <td className="py-3 pr-4">{h.heart_rate} bpm</td>
                          <td className="py-3 pr-4"><span className={bpS.color}>{h.systolic_bp}/{h.diastolic_bp}</span></td>
                          <td className="py-3 pr-4">{h.spo2}%</td>
                          <td className="py-3">{h.body_temp}°C</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <Activity className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No vitals recorded yet.</p>
                <Button size="sm" onClick={() => setLogOpen(true)} className="bg-gradient-primary text-primary-foreground gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Log your first reading
                </Button>
              </div>
            )}
          </SectionCard>
        )}

        {latestLoading ? (
          <SectionCardSkeleton rows={3} />
        ) : (
          <SectionCard
            title="Today's snapshot"
            action={
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setLogOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Log
              </Button>
            }
          >
            {latest ? (
              <div className="space-y-3">
                {[
                  { icon: Activity,    label: "Steps",       value: latest.steps ? latest.steps.toLocaleString() : "—" },
                  { icon: Heart,       label: "Resting HR",  value: `${latest.heart_rate} bpm` },
                  { icon: Thermometer, label: "Temperature", value: `${latest.body_temp}°C` },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/60 p-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <s.icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground">{s.label}</div>
                      <div className="text-sm font-semibold">{s.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <p className="text-sm text-muted-foreground">No data yet.</p>
                <Button size="sm" onClick={() => setLogOpen(true)} className="bg-gradient-primary text-primary-foreground gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Log now
                </Button>
              </div>
            )}
          </SectionCard>
        )}
      </div>
    </DashboardLayout>
  );
};
export default Vitals;
