import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SectionCard, SectionCardSkeleton } from "@/components/dashboard/Cards";
import { Input } from "@/components/ui/input";
import { Search, ShieldCheck } from "lucide-react";
import { useAuditLog } from "@/hooks/use-supabase-data";
import { format } from "date-fns";

const actionColor: Record<string, string> = {
  created:    "bg-success/15 text-success",
  updated:    "bg-primary/15 text-primary",
  deleted:    "bg-destructive/15 text-destructive",
  deactivated:"bg-warning/15 text-warning",
  activated:  "bg-success/15 text-success",
  sent:       "bg-secondary/15 text-secondary",
  confirmed:  "bg-success/15 text-success",
  cancelled:  "bg-destructive/15 text-destructive",
};

export default function AuditLog() {
  const { data: logs, loading } = useAuditLog();
  const [search, setSearch] = useState("");

  const filtered = (logs ?? []).filter((l: any) =>
    !search.trim() ||
    l.actor_email?.toLowerCase().includes(search.toLowerCase()) ||
    l.action?.toLowerCase().includes(search.toLowerCase()) ||
    l.entity?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout requiredRole="admin">
      <div className="mb-7">
        <p className="text-sm text-muted-foreground">Compliance & traceability</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">Audit Log</h1>
        <p className="mt-1 text-sm text-muted-foreground">Full record of all admin and system actions.</p>
      </div>

      {loading ? <SectionCardSkeleton rows={8} /> : (
        <SectionCard
          title={`${filtered.length} events`}
          action={
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search..." className="h-9 pl-9 w-56" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          }
        >
          {filtered.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="pb-3 pr-4 hidden md:table-cell">Time</th>
                    <th className="pb-3 pr-4">Actor</th>
                    <th className="pb-3 pr-4">Action</th>
                    <th className="pb-3 pr-4">Entity</th>
                    <th className="pb-3 hidden lg:table-cell">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filtered.map((l: any) => (
                    <tr key={l.id} className="hover:bg-accent/40">
                      <td className="py-3 pr-4 text-xs text-muted-foreground hidden md:table-cell whitespace-nowrap">
                        {format(new Date(l.created_at), "MMM d, h:mm a")}
                      </td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground">{l.actor_email ?? "System"}</td>
                      <td className="py-3 pr-4">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${actionColor[l.action] ?? "bg-muted text-muted-foreground"}`}>
                          {l.action}
                        </span>
                      </td>
                      <td className="py-3 pr-4 capitalize text-sm font-medium">{l.entity}</td>
                      <td className="py-3 text-xs text-muted-foreground hidden lg:table-cell max-w-[200px] truncate">
                        {l.details ? JSON.stringify(l.details) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <ShieldCheck className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No audit events yet. Actions will appear here automatically.</p>
            </div>
          )}
        </SectionCard>
      )}
    </DashboardLayout>
  );
}
