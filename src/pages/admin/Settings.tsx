import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SectionCard, SectionCardSkeleton } from "@/components/dashboard/Cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { writeAuditLog } from "@/hooks/use-supabase-data";
import { toast } from "sonner";

interface PlatformSettings {
  id: string;
  org_name: string;
  domain: string;
  timezone: string;
}

const Settings = () => {
  const session = getSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [org, setOrg] = useState("");
  const [domain, setDomain] = useState("");
  const [timezone, setTimezone] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const { data, error } = await supabase
          .from("platform_settings")
          .select("id, org_name, domain, timezone")
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        if (cancelled) return;

        if (data) {
          const settings = data as PlatformSettings;
          setSettingsId(settings.id);
          setOrg(settings.org_name);
          setDomain(settings.domain);
          setTimezone(settings.timezone);
        } else {
          setSettingsId(null);
          setOrg("");
          setDomain("");
          setTimezone("");
        }
      } catch (error) {
        console.error("Unable to load platform settings:", error);
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : "Unable to load platform settings.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const handleSave = async () => {
    const trimmedOrg = org.trim();
    const trimmedDomain = domain.trim();
    const trimmedTimezone = timezone.trim();
    if (!trimmedOrg || !trimmedDomain || !trimmedTimezone) {
      toast.error("Organization name, domain, and timezone are required.");
      return;
    }
    if (trimmedOrg.length > 120 || trimmedDomain.length > 253 || trimmedTimezone.length > 100) {
      toast.error("One or more settings exceed the allowed length.");
      return;
    }
    if (!session) {
      toast.error("Your administrator session is unavailable. Sign in again.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        org_name: trimmedOrg,
        domain: trimmedDomain,
        timezone: trimmedTimezone,
        updated_at: new Date().toISOString(),
        updated_by: session.id,
      };
      let updatedSettingsId = settingsId;

      if (settingsId) {
        const { data, error } = await supabase
          .from("platform_settings")
          .update(payload)
          .eq("id", settingsId)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("No settings record was updated. Check the database permissions.");
      } else {
        const { data, error } = await supabase
          .from("platform_settings")
          .insert({
            ...payload,
            mfa: false,
            ai_triage: false,
            data_export: false,
            maintenance_mode: false,
            notif_critical_alerts: false,
            notif_daily_summary: false,
            notif_weekly_digest: false,
            notif_new_users: false,
          })
          .select("id")
          .single();
        if (error) throw error;
        setSettingsId(data.id);
        updatedSettingsId = data.id;
      }

      try {
        await writeAuditLog(session.id, session.email, "updated", "platform_settings", updatedSettingsId ?? undefined);
        toast.success("Organization settings saved.");
      } catch (auditError) {
        console.error("Organization settings saved but audit logging failed:", auditError);
        toast.warning("Settings were saved, but their audit record could not be saved.");
      }
    } catch (error) {
      console.error("Unable to save platform settings:", error);
      toast.error(error instanceof Error ? error.message : "Unable to save platform settings.");
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

      {loadError && (
        <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="text-destructive">Could not load settings: {loadError}</p>
          <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
            Retry
          </Button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="Organization profile">
          <p className="mb-4 text-xs text-muted-foreground">
            These values are stored in the platform settings table. They do not yet change
            application branding, URLs, or timezone behavior elsewhere in the app.
          </p>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="org">Organization name</Label>
              <Input id="org" maxLength={120} value={org} onChange={(event) => setOrg(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="domain">Primary domain</Label>
              <Input id="domain" maxLength={253} value={domain} onChange={(event) => setDomain(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="timezone">Timezone</Label>
              <Input id="timezone" maxLength={100} value={timezone} onChange={(event) => setTimezone(event.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving || !!loadError} className="gap-2 bg-gradient-primary text-primary-foreground">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save organization profile
              </Button>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Security and platform controls">
          <ul className="space-y-3 text-sm">
            <li className="rounded-xl border border-border/60 bg-background/60 p-3.5">
              <div className="font-semibold">Staff multi-factor authentication</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Required by the app for doctor and administrator workspaces. Database enforcement
                requires the reviewed RLS migration to be applied in Supabase.
              </p>
            </li>
            <li className="rounded-xl border border-border/60 bg-background/60 p-3.5">
              <div className="font-semibold">Maintenance mode, AI controls, and patient export</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Not available as operational controls yet. They are intentionally not editable here.
              </p>
            </li>
          </ul>
        </SectionCard>

        <SectionCard title="Notification delivery" className="lg:col-span-2">
          <p className="text-sm text-muted-foreground">
            Email notifications and scheduled summaries are not connected to a delivery service.
            Notification preferences are disabled until delivery and monitoring are implemented.
          </p>
        </SectionCard>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
