import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SectionCard, SectionCardSkeleton } from "@/components/dashboard/Cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { toast } from "sonner";

interface PlatformSettings {
  id: string;
  org_name: string;
  domain: string;
  timezone: string;
  mfa: boolean;
  ai_triage: boolean;
  data_export: boolean;
  maintenance_mode: boolean;
  notif_critical_alerts: boolean;
  notif_daily_summary: boolean;
  notif_weekly_digest: boolean;
  notif_new_users: boolean;
}

const Settings = () => {
  const session = getSession();
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  const [org,    setOrg]    = useState("Virtual Care Assistant");
  const [domain, setDomain] = useState("vca.health");
  const [tz,     setTz]     = useState("UTC+08:00 (Asia/Manila)");

  const [prefs, setPrefs] = useState({
    mfa:         true,
    aiTriage:    true,
    dataExport:  true,
    maintenance: false,
  });

  const [notifs, setNotifs] = useState({
    criticalAlerts: true,
    dailySummary:   true,
    weeklyDigest:   false,
    newUsers:       false,
  });

  // Load settings on mount
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("platform_settings")
          .select("*")
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          const s = data as PlatformSettings;
          setSettingsId(s.id);
          setOrg(s.org_name);
          setDomain(s.domain);
          setTz(s.timezone);
          setPrefs({ mfa: s.mfa, aiTriage: s.ai_triage, dataExport: s.data_export, maintenance: s.maintenance_mode });
          setNotifs({ criticalAlerts: s.notif_critical_alerts, dailySummary: s.notif_daily_summary, weeklyDigest: s.notif_weekly_digest, newUsers: s.notif_new_users });
        }
      } catch (e: any) {
        toast.error("Failed to load settings");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        org_name:              org.trim(),
        domain:                domain.trim(),
        timezone:              tz.trim(),
        mfa:                   prefs.mfa,
        ai_triage:             prefs.aiTriage,
        data_export:           prefs.dataExport,
        maintenance_mode:      prefs.maintenance,
        notif_critical_alerts: notifs.criticalAlerts,
        notif_daily_summary:   notifs.dailySummary,
        notif_weekly_digest:   notifs.weeklyDigest,
        notif_new_users:       notifs.newUsers,
        updated_at:            new Date().toISOString(),
        updated_by:            session?.id ?? null,
      };

      if (settingsId) {
        const { error } = await supabase.from("platform_settings").update(payload).eq("id", settingsId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("platform_settings").insert(payload).select("id").single();
        if (error) throw error;
        setSettingsId(data.id);
      }

      toast.success("Settings saved", { description: `Organization: ${org} · Timezone: ${tz}` });
    } catch (e: any) {
      console.error("Settings save error:", e);
      toast.error(e.message ?? "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout requiredRole="admin">
        <div className="mb-7">
          <p className="text-sm text-muted-foreground">System configuration</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Settings</h1>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <SectionCardSkeleton rows={3} />
          <SectionCardSkeleton rows={4} />
          <SectionCardSkeleton rows={4} className="lg:col-span-2" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout requiredRole="admin">
      <div className="mb-7">
        <p className="text-sm text-muted-foreground">System configuration</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">Settings</h1>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="Organization">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="org">Organization name</Label>
              <Input id="org" value={org} onChange={e => setOrg(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="domain">Primary domain</Label>
              <Input id="domain" value={domain} onChange={e => setDomain(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tz">Timezone</Label>
              <Input id="tz" value={tz} onChange={e => setTz(e.target.value)} />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Platform preferences">
          <div className="space-y-4">
            {[
              { key: "aiTriage",    label: "AI triage suggestions",       desc: "Show AI-driven priority on patient queue." },
              { key: "dataExport",  label: "Patient data export",         desc: "Allow patients to export their records." },
              { key: "maintenance", label: "Maintenance mode",            desc: "Temporarily restrict access for upgrades." },
            ].map(p => (
              <div key={p.key} className="flex items-start justify-between gap-4 rounded-xl border border-border/60 bg-background/60 p-3.5">
                <div>
                  <div className="text-sm font-semibold">{p.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{p.desc}</div>
                </div>
                <Switch
                  checked={prefs[p.key as keyof typeof prefs]}
                  onCheckedChange={v => setPrefs(prev => ({ ...prev, [p.key]: v }))}
                />
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Notifications" className="lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { key: "criticalAlerts", label: "Email alerts for critical incidents" },
              { key: "dailySummary",   label: "Daily operations summary" },
              { key: "weeklyDigest",   label: "Weekly analytics digest" },
              { key: "newUsers",       label: "New user registrations" },
            ].map(n => (
              <label key={n.key} className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-background/60 p-3.5 cursor-pointer">
                <span className="text-sm">{n.label}</span>
                <Switch
                  checked={notifs[n.key as keyof typeof notifs]}
                  onCheckedChange={v => setNotifs(prev => ({ ...prev, [n.key]: v }))}
                />
              </label>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="bg-gradient-primary text-primary-foreground gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> Save changes</>}
            </Button>
          </div>
        </SectionCard>
      </div>
    </DashboardLayout>
  );
};
export default Settings;
