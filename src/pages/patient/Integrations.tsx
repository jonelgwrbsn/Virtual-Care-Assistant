import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SectionCard, SectionCardSkeleton } from "@/components/dashboard/Cards";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Apple, Activity, Watch, Smartphone, ShieldCheck, Clock, CheckCircle2, CircleDashed, Lock, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useIntegrationPreferences, upsertIntegrationPreferences } from "@/hooks/use-supabase-data";
import { getSession } from "@/lib/auth";
import { Link } from "react-router-dom";

type Status = "planned" | "in-progress" | "ready";

interface Provider {
  id: string;
  name: string;
  description: string;
  icon: any;
  metrics: string[];
  status: Status;
  eta: string;
}

const providers: Provider[] = [
  {
    id: "apple-health",
    name: "Apple HealthKit",
    description: "Sync vitals from iPhone & Apple Watch — heart rate, sleep, activity, ECG.",
    icon: Apple,
    metrics: ["Heart rate", "SpO₂", "Sleep", "Steps", "ECG"],
    status: "planned",
    eta: "Q3 · pending backend sync job",
  },
  {
    id: "google-fit",
    name: "Google Fit",
    description: "Pull activity, heart rate and body measurements from Android & Wear OS.",
    icon: Activity,
    metrics: ["Heart rate", "Steps", "Calories", "Weight"],
    status: "planned",
    eta: "Q3 · pending backend sync job",
  },
  {
    id: "fitbit",
    name: "Fitbit",
    description: "Continuous heart rate, sleep stages and stress score from Fitbit devices.",
    icon: Watch,
    metrics: ["Heart rate", "Sleep stages", "Stress"],
    status: "planned",
    eta: "Backlog",
  },
  {
    id: "manual",
    name: "Manual entry",
    description: "Log vitals by hand from any device, no integration required.",
    icon: Smartphone,
    metrics: ["Any metric"],
    status: "ready",
    eta: "Available now",
  },
];

const roadmap = [
  { phase: "Phase 1", title: "Manual vitals logging",                  status: "ready"       as Status, note: "Log vitals manually from the Vitals page — live now." },
  { phase: "Phase 2", title: "Backend sync worker",                    status: "planned"     as Status, note: "Scheduled edge function to ingest provider webhooks." },
  { phase: "Phase 3", title: "Apple HealthKit & Google Fit OAuth",     status: "planned"     as Status, note: "User-level OAuth, per-metric consent, daily backfill." },
  { phase: "Phase 4", title: "Live device streaming",                  status: "planned"     as Status, note: "Wear OS / watchOS companion for real-time heart rate." },
];

const statusStyles: Record<Status, string> = {
  planned:      "text-muted-foreground bg-muted",
  "in-progress":"text-warning bg-warning/10",
  ready:        "text-success bg-success/10",
};

const statusLabel: Record<Status, string> = {
  planned:      "Planned",
  "in-progress":"In progress",
  ready:        "Ready",
};

const Integrations = () => {
  const session = getSession();
  const { data: savedPrefs, loading: prefsLoading } = useIntegrationPreferences();

  const [preferred, setPreferred] = useState<string | null>(null);
  const [notify, setNotify]       = useState(true);
  const [saving, setSaving]       = useState(false);
  const [hydrated, setHydrated]   = useState(false);

  // Hydrate local state from DB once loaded
  useEffect(() => {
    if (prefsLoading || hydrated) return;
    if (savedPrefs) {
      setPreferred(savedPrefs.preferred_provider ?? null);
      setNotify(savedPrefs.notify_when_available ?? true);
    }
    setHydrated(true);
  }, [savedPrefs, prefsLoading, hydrated]);

  const persist = async (newPreferred: string | null, newNotify: boolean) => {
    if (!session) return;
    setSaving(true);
    try {
      await upsertIntegrationPreferences(session.id, newPreferred, newNotify);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  const choose = async (p: Provider) => {
    setPreferred(p.id);
    await persist(p.id, notify);
    toast.success(`Preference saved: ${p.name}`, {
      description: "We'll enable it automatically once the sync job ships.",
    });
  };

  const handleNotifyToggle = async (val: boolean) => {
    setNotify(val);
    await persist(preferred, val);
    toast.success(val ? "You'll be notified when your provider goes live." : "Notifications turned off.");
  };

  return (
    <DashboardLayout requiredRole="patient">
      <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Connected devices</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Integration roadmap</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Pick a preferred source for your vitals. Connections stay locked until our backend sync job is live —
            we'll enable your choice automatically and notify you.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs">
          <ShieldCheck className="h-4 w-4 text-success" />
          <span className="text-muted-foreground">Manual entry available · device sync coming soon</span>
        </div>
      </div>

      {/* Providers */}
      {prefsLoading && !hydrated ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1,2,3,4].map(i => <SectionCardSkeleton key={i} rows={3} />)}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {providers.map((p) => {
            const isPreferred = preferred === p.id;
            const isReady     = p.status === "ready";
            return (
              <div
                key={p.id}
                className={`card-modern relative overflow-hidden p-5 transition-all ${isPreferred ? "ring-2 ring-primary/40" : ""}`}
              >
                {isPreferred && (
                  <div className="absolute right-3 top-3 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                    Preferred
                  </div>
                )}
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <p.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-base font-semibold tracking-tight">{p.name}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusStyles[p.status]}`}>
                        {statusLabel[p.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {p.metrics.map((m) => (
                        <span key={m} className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{m}</span>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" /> {p.eta}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant={isPreferred ? "secondary" : "outline"}
                          onClick={() => choose(p)}
                          disabled={saving || isReady}
                        >
                          {saving && isPreferred
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : isPreferred ? "Selected" : "Choose"}
                        </Button>
                        {p.id === "manual" ? (
                          <Button size="sm" asChild className="bg-gradient-primary text-primary-foreground gap-1.5">
                            <Link to="/patient/vitals">
                              Log vitals <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        ) : (
                          <Button size="sm" disabled className="gap-1.5">
                            <Lock className="h-3.5 w-3.5" /> Connect
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Roadmap + preferences */}
      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <SectionCard title="Rollout roadmap" className="lg:col-span-2">
          <ol className="relative space-y-5 pl-6">
            <span className="absolute left-2 top-1.5 bottom-1.5 w-px bg-border" />
            {roadmap.map((r) => {
              const Icon = r.status === "ready" ? CheckCircle2 : CircleDashed;
              const tone = r.status === "ready" ? "text-success" : r.status === "in-progress" ? "text-warning" : "text-muted-foreground";
              return (
                <li key={r.title} className="relative">
                  <span className={`absolute -left-6 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-background ${tone}`}>
                    <Icon className={`h-4 w-4 ${r.status === "in-progress" ? "animate-spin-slow" : ""}`} />
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{r.phase}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusStyles[r.status]}`}>
                      {statusLabel[r.status]}
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-semibold">{r.title}</div>
                  <p className="text-xs text-muted-foreground">{r.note}</p>
                </li>
              );
            })}
          </ol>
        </SectionCard>

        <SectionCard title="Your preferences">
          {prefsLoading && !hydrated ? (
            <div className="space-y-3">
              <div className="h-14 rounded-xl shimmer-bg" />
              <div className="h-14 rounded-xl shimmer-bg" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-border/60 bg-background/60 p-3">
                <div className="text-xs text-muted-foreground">Preferred source</div>
                <div className="mt-1 flex items-center gap-2 text-sm font-semibold">
                  {preferred
                    ? providers.find((p) => p.id === preferred)?.name
                    : <span className="text-muted-foreground font-normal">Not selected</span>}
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/60 p-3">
                <div className="pr-3">
                  <div className="text-sm font-medium">Notify me when available</div>
                  <div className="text-xs text-muted-foreground">Email the moment your provider goes live.</div>
                </div>
                <Switch checked={notify} onCheckedChange={handleNotifyToggle} disabled={saving} />
              </div>

              <div className="flex items-start gap-2 rounded-xl border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  Connections are disabled by design until the sync worker is deployed. Your preference is saved to your account and won't transmit any health data.
                </span>
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </DashboardLayout>
  );
};

export default Integrations;
