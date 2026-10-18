import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard, SectionCard, StatCardSkeleton, SectionCardSkeleton } from "@/components/dashboard/Cards";
import { ClipboardList, CheckCircle2, XCircle, Clock, Check, X, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAllAppointments, useAdminStats, useAllDoctors, updateAppointmentStatus, reassignAppointmentDoctor, writeAuditLog } from "@/hooks/use-supabase-data";
import { getSession } from "@/lib/auth";
import { format } from "date-fns";
import { toast } from "sonner";

const statusColor: Record<string, string> = {
  confirmed: "bg-success/15 text-success",
  pending:   "bg-warning/15 text-warning",
  cancelled: "bg-destructive/15 text-destructive",
  completed: "bg-muted text-muted-foreground",
};

const AdminAppointments = () => {
  const adminSession = getSession();
  const [refetchKey, setRefetchKey] = useState(0);
  const { data: appts,  loading: apptsLoading, error: apptsError } = useAllAppointments(refetchKey);
  const { data: stats, loading: statsLoading, error: statsError } = useAdminStats();
  const { data: doctors } = useAllDoctors();

  const [updating, setUpdating]   = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState<Record<string, string>>({});

  // Reassign modal
  const [reassignAppt, setReassignAppt] = useState<any | null>(null);
  const [newDoctorId, setNewDoctorId]   = useState("");
  const [reassigning, setReassigning]   = useState(false);

  const getStatus = (a: any) => localStatus[a.id] ?? a.status;

  const handleUpdate = async (id: string, status: string, patientName: string) => {
    setUpdating(id);
    try {
      await updateAppointmentStatus(id, status);
      setLocalStatus(prev => ({ ...prev, [id]: status }));
      let auditFailed = false;
      if (adminSession) {
        try {
          await writeAuditLog(adminSession.id, adminSession.email, status, "appointment", id, { patient: patientName });
        } catch (auditError) {
          auditFailed = true;
          console.error("Appointment updated but audit logging failed:", auditError);
        }
      }
      if (auditFailed || !adminSession) {
        toast.warning(`Appointment ${status}, but the audit record could not be saved.`);
      }
      else toast.success(`Appointment ${status}`);
      setRefetchKey(k => k + 1);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update");
    } finally {
      setUpdating(null);
    }
  };

  const handleReassign = async () => {
    if (!newDoctorId || !reassignAppt) return toast.error("Select a doctor");
    setReassigning(true);
    try {
      await reassignAppointmentDoctor(reassignAppt.id, newDoctorId);
      const doctorName = doctors?.find((d: any) => d.id === newDoctorId)?.full_name ?? newDoctorId;
      let auditFailed = false;
      if (adminSession) {
        try {
          await writeAuditLog(adminSession.id, adminSession.email, "updated", "appointment", reassignAppt.id, { reassigned_to: doctorName });
        } catch (auditError) {
          auditFailed = true;
          console.error("Appointment reassigned but audit logging failed:", auditError);
        }
      }
      if (auditFailed || !adminSession) {
        toast.warning(`Appointment reassigned to ${doctorName}, but its audit record could not be saved.`);
      }
      else toast.success(`Reassigned to ${doctorName}`);
      setReassignAppt(null);
      setNewDoctorId("");
      setRefetchKey(k => k + 1);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to reassign");
    } finally {
      setReassigning(false);
    }
  };

  return (
    <DashboardLayout requiredRole="admin">
      {/* Reassign modal */}
      <Dialog open={!!reassignAppt} onOpenChange={v => !v && setReassignAppt(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reassign appointment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Patient: <span className="font-semibold text-foreground">{reassignAppt?.patient?.full_name}</span>
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Assign to doctor</label>
              <Select value={newDoctorId} onValueChange={setNewDoctorId}>
                <SelectTrigger><SelectValue placeholder="Select a doctor..." /></SelectTrigger>
                <SelectContent>
                  {(doctors ?? []).map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignAppt(null)} disabled={reassigning}>Cancel</Button>
            <Button onClick={handleReassign} disabled={reassigning || !newDoctorId} className="bg-gradient-primary text-primary-foreground">
              {reassigning ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reassign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mb-7">
        <p className="text-sm text-muted-foreground">Scheduling overview</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">Appointments</h1>
      </div>

      {statsLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : statsError ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Could not load appointment counts: {statsError}
        </p>
      ) : (
        <div className="stagger grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard icon={ClipboardList} label="Total"     value={stats?.totalAppointments ?? 0} trend="all time"              accent="primary" />
          <StatCard icon={CheckCircle2}  label="Confirmed" value={stats?.confirmedAppts ?? 0}    trend="scheduled"             accent="success" />
          <StatCard icon={Clock}         label="Pending"   value={stats?.pendingAppts ?? 0}      trend="awaiting confirmation" accent="secondary" />
          <StatCard icon={XCircle}       label="Cancelled" value={stats?.cancelledAppts ?? 0}    trend="total"                 accent="warning" />
        </div>
      )}

      <div className="mt-6">
        {apptsLoading ? <SectionCardSkeleton rows={6} /> : apptsError ? (
          <p className="py-6 text-center text-sm text-destructive">Failed to load appointments.</p>
        ) : (
          <SectionCard title={`${appts?.length ?? 0} appointments`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="pb-3 pr-4">Patient</th>
                    <th className="pb-3 pr-4 hidden sm:table-cell">Doctor</th>
                    <th className="pb-3 pr-4 hidden md:table-cell">When</th>
                    <th className="pb-3 pr-4 hidden md:table-cell">Mode</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {(appts ?? []).map((a: any) => {
                    const status = getStatus(a);
                    const isUpdating = updating === a.id;
                    const patientName = (a.patient as any)?.full_name ?? "—";
                    return (
                      <tr key={a.id} className="hover:bg-accent/40">
                        <td className="py-3 pr-4 font-medium">{patientName}</td>
                        <td className="py-3 pr-4 text-muted-foreground hidden sm:table-cell">{(a.doctor as any)?.full_name ?? "—"}</td>
                        <td className="py-3 pr-4 text-muted-foreground hidden md:table-cell text-xs">
                          {format(new Date(a.scheduled_at), "MMM d, yyyy · h:mm a")}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground hidden md:table-cell capitalize">{a.mode}</td>
                        <td className="py-3 pr-4">
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${statusColor[status]}`}>{status}</span>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1 flex-wrap">
                            {status === "pending" && (
                              <>
                                <Button size="sm" variant="outline" disabled={isUpdating} className="h-7 gap-1 text-success border-success/30 hover:bg-success/10 px-2" onClick={() => handleUpdate(a.id, "confirmed", patientName)}>
                                  <Check className="h-3 w-3" /> Confirm
                                </Button>
                                <Button size="sm" variant="outline" disabled={isUpdating} className="h-7 gap-1 text-destructive border-destructive/30 hover:bg-destructive/10 px-2" onClick={() => handleUpdate(a.id, "cancelled", patientName)}>
                                  <X className="h-3 w-3" /> Cancel
                                </Button>
                              </>
                            )}
                            {status === "confirmed" && (
                              <Button size="sm" variant="outline" disabled={isUpdating} className="h-7 gap-1 text-destructive border-destructive/30 hover:bg-destructive/10 px-2" onClick={() => handleUpdate(a.id, "cancelled", patientName)}>
                                <X className="h-3 w-3" /> Cancel
                              </Button>
                            )}
                            {(status === "pending" || status === "confirmed") && (
                              <Button size="sm" variant="outline" disabled={isUpdating} className="h-7 gap-1 px-2" onClick={() => { setReassignAppt(a); setNewDoctorId(""); }}>
                                <RefreshCw className="h-3 w-3" /> Reassign
                              </Button>
                            )}
                            {(status === "cancelled" || status === "completed") && (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}
      </div>
    </DashboardLayout>
  );
};
export default AdminAppointments;
