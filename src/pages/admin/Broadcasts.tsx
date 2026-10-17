import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SectionCard, SectionCardSkeleton } from "@/components/dashboard/Cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Megaphone, Loader2, Users, Stethoscope, Globe } from "lucide-react";
import { useBroadcastNotifications, sendBroadcast } from "@/hooks/use-supabase-data";
import { getSession } from "@/lib/auth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const targetIcon: Record<string, any> = { all: Globe, patient: Users, doctor: Stethoscope };
const targetLabel: Record<string, string> = { all: "Everyone", patient: "Patients", doctor: "Doctors" };
const targetColor: Record<string, string> = {
  all: "bg-primary/10 text-primary",
  patient: "bg-secondary/10 text-secondary",
  doctor: "bg-success/10 text-success",
};

export default function Broadcasts() {
  const session = getSession();
  const [refetchKey, setRefetchKey] = useState(0);
  const { data: broadcasts, loading } = useBroadcastNotifications(refetchKey);

  const [title, setTitle]   = useState("");
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState("all");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!title.trim()) return toast.error("Title is required");
    if (!message.trim()) return toast.error("Message is required");
    if (!session) return;
    setSending(true);
    try {
      await sendBroadcast(session.id, title.trim(), message.trim(), target);
      toast.success(`Broadcast sent to ${targetLabel[target]}`);
      setTitle(""); setMessage(""); setTarget("all");
      setRefetchKey(k => k + 1);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <DashboardLayout requiredRole="admin">
      <div className="mb-7">
        <p className="text-sm text-muted-foreground">System communications</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">Broadcast Notifications</h1>
        <p className="mt-1 text-sm text-muted-foreground">Send system-wide messages to patients, doctors, or everyone.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Compose */}
        <SectionCard title="New broadcast">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input placeholder="e.g. Scheduled maintenance" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <textarea
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
                placeholder="Write your message here..."
                value={message}
                onChange={e => setMessage(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Send to</Label>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Everyone</SelectItem>
                  <SelectItem value="patient">Patients only</SelectItem>
                  <SelectItem value="doctor">Doctors only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSend} disabled={sending} className="w-full bg-gradient-primary text-primary-foreground gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Megaphone className="h-4 w-4" /> Send broadcast</>}
            </Button>
          </div>
        </SectionCard>

        {/* History */}
        <div className="lg:col-span-2">
          {loading ? <SectionCardSkeleton rows={5} /> : (
            <SectionCard title={`${broadcasts?.length ?? 0} sent`}>
              {broadcasts && broadcasts.length > 0 ? (
                <ul className="divide-y divide-border/60">
                  {broadcasts.map((b: any) => {
                    const Icon = targetIcon[b.target_role] ?? Globe;
                    return (
                      <li key={b.id} className="py-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${targetColor[b.target_role]}`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold">{b.title}</div>
                              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{b.message}</p>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${targetColor[b.target_role]}`}>
                              {targetLabel[b.target_role]}
                            </span>
                            <div className="mt-1 text-[10px] text-muted-foreground">
                              {formatDistanceToNow(new Date(b.created_at), { addSuffix: true })}
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">No broadcasts sent yet.</p>
              )}
            </SectionCard>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
