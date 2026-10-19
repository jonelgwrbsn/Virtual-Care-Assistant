import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard, SectionCard, StatCardSkeleton, SectionCardSkeleton } from "@/components/dashboard/Cards";
import {
  Users, UserCog, Stethoscope, Shield, Plus, Search,
  Eye, PowerOff, Power, Heart, FileText, Calendar, Trash2,
  Lock, MessagesSquare, Loader2, Phone, Clock, CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  useAllUsers, useAdminStats, usePatientProfile, useDoctorProfile,
  setUserActive, deleteUserAccount, writeAuditLog,
} from "@/hooks/use-supabase-data";
import { InviteUserModal } from "@/components/InviteUserModal";
import { InvitationManager } from "@/components/InvitationManager";
import { Avatar } from "@/components/AvatarUpload";
import { getSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";

type Tab = "patients" | "doctors";

interface DeletableUser {
  id: string;
  full_name: string;
  email: string;
  role: "patient" | "doctor";
}

const statusBadge = (active: boolean) =>
  active
    ? "bg-success/15 text-success"
    : "bg-destructive/15 text-destructive";

/* ── password gate ── */
const PasswordGate = ({ onUnlock }: { onUnlock: () => void }) => {
  const [pw, setPw]       = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);
    try {
      const session = getSession();
      if (!session) throw new Error("Not logged in");
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: session.email,
        password: pw,
      });
      if (authErr) { setError(true); return; }
      onUnlock();
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-warning/10 text-warning">
        <Lock className="h-8 w-8" />
      </div>
      <div className="text-center">
        <h2 className="font-display text-xl font-bold">Authentication required</h2>
        <p className="mt-1 text-sm text-muted-foreground">Enter your admin password to view this list.</p>
      </div>
      <form onSubmit={verify} className="w-full max-w-xs space-y-3">
        <Input
          type="password"
          placeholder="Your password"
          value={pw}
          onChange={e => { setPw(e.target.value); setError(false); }}
          autoComplete="off"
          className={error ? "border-destructive focus-visible:ring-destructive" : ""}
          autoFocus
        />
        {error && <p className="text-xs text-destructive">Incorrect password. Try again.</p>}
        <Button type="submit" disabled={loading || !pw} className="w-full bg-gradient-primary text-primary-foreground">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unlock"}
        </Button>
      </form>
    </div>
  );
};

/* ── patient profile modal ── */
const PatientProfileModal = ({ id, onClose }: { id: string; onClose: () => void }) => {
  const { data: profile, loading, error } = usePatientProfile(id);
  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Patient profile</DialogTitle></DialogHeader>
        {loading ? (
          <div className="space-y-3 py-4">{[1,2,3].map(i => <div key={i} className="h-12 rounded-xl shimmer-bg" />)}</div>
        ) : error ? (
          <p role="alert" className="py-4 text-sm text-destructive">
            Couldn’t load this patient profile. Close the dialog and try again.
          </p>
        ) : profile ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              <Avatar
                avatarUrl={profile.profile?.avatar_url ?? null}
                name={profile.profile?.full_name ?? ""}
                size="lg"
              />
              <div>
                <div className="font-semibold">{profile.profile?.full_name}</div>
                <div className="text-xs text-muted-foreground">{profile.profile?.email}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Joined {profile.profile?.created_at ? formatDistanceToNow(new Date(profile.profile.created_at), { addSuffix: true }) : "—"}
                  {" · "}
                  <span className={profile.profile?.is_active === false ? "text-destructive" : "text-success"}>
                    {profile.profile?.is_active === false ? "Inactive" : "Active"}
                  </span>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/60 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider"><Heart className="h-3.5 w-3.5" /> Latest vitals</div>
              {profile.latestVitals ? (
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div><div className="text-xs text-muted-foreground">Heart rate</div><div className="font-semibold">{profile.latestVitals.heart_rate} bpm</div></div>
                  <div><div className="text-xs text-muted-foreground">BP</div><div className="font-semibold">{profile.latestVitals.systolic_bp}/{profile.latestVitals.diastolic_bp}</div></div>
                  <div><div className="text-xs text-muted-foreground">SpO₂</div><div className="font-semibold">{profile.latestVitals.spo2}%</div></div>
                </div>
              ) : <p className="text-xs text-muted-foreground">No vitals recorded.</p>}
            </div>
            <div className="rounded-xl border border-border/60 bg-background/60 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider"><FileText className="h-3.5 w-3.5" /> Recent records</div>
              {profile.records.length > 0 ? (
                <ul className="space-y-1">{profile.records.map((r: any) => (
                  <li key={r.id} className="flex items-center justify-between text-xs">
                    <span className="font-medium truncate">{r.title}</span>
                    <span className="text-muted-foreground ml-2 shrink-0">{r.recorded_date ? format(new Date(r.recorded_date), "MMM d, yyyy") : "—"}</span>
                  </li>
                ))}</ul>
              ) : <p className="text-xs text-muted-foreground">No records.</p>}
            </div>
            <div className="rounded-xl border border-border/60 bg-background/60 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider"><Calendar className="h-3.5 w-3.5" /> Recent appointments</div>
              {profile.appointments.length > 0 ? (
                <ul className="space-y-1">{profile.appointments.map((a: any) => (
                  <li key={a.id} className="flex items-center justify-between text-xs">
                    <span className="font-medium">{(a.doctor as any)?.full_name ?? "—"}</span>
                    <span className="text-muted-foreground">{format(new Date(a.scheduled_at), "MMM d, h:mm a")} · {a.status}</span>
                  </li>
                ))}</ul>
              ) : <p className="text-xs text-muted-foreground">No appointments.</p>}
            </div>
          </div>
        ) : null}
        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ── doctor profile modal ── */
const DoctorProfileModal = ({ id, onClose }: { id: string; onClose: () => void }) => {
  const { data: profile, loading, error, realtimeConnected, realtimeError } = useDoctorProfile(id);
  const doctor = profile?.profile;
  const availableDays = doctor?.available_days ?? [];
  const requiredProfileItems = [
    Boolean(doctor?.specialty),
    Boolean(doctor?.license_number),
    availableDays.length > 0,
    Boolean(doctor?.available_hours),
  ];
  const completedProfileItems = requiredProfileItems.filter(Boolean).length;

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Doctor profile</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {realtimeConnected
              ? "Live updates connected"
              : "Live updates unavailable; refreshing every 30 seconds"}
          </p>
          {realtimeError && (
            <p role="status" className="text-xs text-warning">
              Realtime connection issue: {realtimeError}
            </p>
          )}
        </DialogHeader>
        {loading && !profile ? (
          <div className="space-y-3 py-4">{[1,2,3].map(i => <div key={i} className="h-12 rounded-xl shimmer-bg" />)}</div>
        ) : error && !profile ? (
          <p role="alert" className="py-6 text-sm text-destructive">
            Could not load this doctor&apos;s information: {error}
          </p>
        ) : profile && doctor ? (
          <div className="space-y-4 py-2">
            {error && (
              <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                Could not refresh the latest doctor information: {error}
              </p>
            )}
            <div className="flex items-center gap-3">
              <Avatar
                avatarUrl={doctor.avatar_url ?? null}
                name={doctor.full_name}
                size="lg"
              />
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{doctor.full_name}</div>
                <div className="break-all text-xs text-muted-foreground">{doctor.email}</div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span>Joined {formatDistanceToNow(new Date(doctor.created_at), { addSuffix: true })}</span>
                  {" · "}
                  <span className={doctor.is_active === false ? "text-destructive" : "text-success"}>
                    {doctor.is_active === false ? "Inactive" : "Active"}
                  </span>
                  <span>Profile {completedProfileItems}/4 complete</span>
                </div>
              </div>
            </div>

            <section className="rounded-xl border border-border/60 bg-background/60 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Stethoscope className="h-4 w-4 text-primary" /> Professional information
              </h3>
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Specialty</dt>
                  <dd className="text-sm font-medium">{doctor.specialty || "Not provided"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">License number</dt>
                  <dd className="text-sm font-medium">{doctor.license_number || "Not provided"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Years of experience</dt>
                  <dd className="text-sm font-medium">
                    {doctor.years_experience == null ? "Not provided" : `${doctor.years_experience} years`}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Phone</dt>
                  <dd className="flex items-center gap-1.5 text-sm font-medium">
                    {doctor.phone ? <><Phone className="h-3.5 w-3.5 text-muted-foreground" />{doctor.phone}</> : "Not provided"}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">Professional bio</dt>
                  <dd className="whitespace-pre-wrap text-sm">{doctor.bio || "Not provided"}</dd>
                </div>
              </dl>
            </section>

            <section className="rounded-xl border border-border/60 bg-background/60 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <CalendarDays className="h-4 w-4 text-primary" /> Availability
              </h3>
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Available days</dt>
                  <dd className="text-sm font-medium">{availableDays.length ? availableDays.join(", ") : "Not provided"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Available hours</dt>
                  <dd className="flex items-center gap-1.5 text-sm font-medium">
                    {doctor.available_hours ? <><Clock className="h-3.5 w-3.5 text-muted-foreground" />{doctor.available_hours}</> : "Not provided"}
                  </dd>
                </div>
              </dl>
            </section>

            <section>
              <h3 className="sr-only">Activity summary</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "All appointments", value: profile.stats.totalAppointments },
                  { label: "Completed", value: profile.stats.completedAppointments },
                  { label: "All consultations", value: profile.stats.totalConsultations },
                  { label: "Live now", value: profile.stats.liveConsultations },
                ].map(stat => (
                  <div key={stat.label} className="rounded-xl border border-border/60 bg-background/60 p-3 text-center">
                    <div className="font-display text-2xl font-bold">{stat.value}</div>
                    <div className="text-xs text-muted-foreground">{stat.label}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-border/60 bg-background/60 p-4">
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" /> Recent appointments
              </h3>
              {profile.appointments.length > 0 ? (
                <ul className="divide-y divide-border/60">
                  {profile.appointments.map((a: any) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-xs">
                    <span className="font-medium">{(a.patient as any)?.full_name ?? "Patient"}</span>
                    <span className="shrink-0 text-muted-foreground">{format(new Date(a.scheduled_at), "MMM d, yyyy h:mm a")} · {a.mode} · {a.status}</span>
                  </li>
                  ))}
                </ul>
              ) : <p className="py-2 text-sm text-muted-foreground">No appointments recorded.</p>}
            </section>

            <section className="rounded-xl border border-border/60 bg-background/60 p-4">
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <MessagesSquare className="h-3.5 w-3.5" /> Recent consultations
              </h3>
              {profile.consultations.length > 0 ? (
                <ul className="divide-y divide-border/60">
                  {profile.consultations.map((c: any) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-xs">
                    <span className="font-medium">{(c.patient as any)?.full_name ?? "Patient"}</span>
                    <span className="shrink-0 text-muted-foreground">{c.started_at ? format(new Date(c.started_at), "MMM d, yyyy h:mm a") : "Not started"} · {c.status}</span>
                  </li>
                  ))}
                </ul>
              ) : <p className="py-2 text-sm text-muted-foreground">No consultations recorded.</p>}
            </section>

            <p className="text-right text-[11px] text-muted-foreground">
              Profile last updated {doctor.updated_at ? format(new Date(doctor.updated_at), "MMM d, yyyy h:mm a") : "unknown"}
            </p>
          </div>
        ) : (
          <p className="py-6 text-sm text-muted-foreground">Doctor information is unavailable.</p>
        )}
        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ── user row ── */
const UserRow = ({ u, onView, onToggle, onDelete, toggling, deleting }: { u: any; onView: () => void; onToggle: () => void; onDelete: () => void; toggling: boolean; deleting: boolean }) => (
  <tr className="hover:bg-accent/40">
    <td className="py-3 pr-4">
      <div className="flex items-center gap-2.5">
        <Avatar
          avatarUrl={u.avatar_url ?? null}
          name={u.full_name}
          size="sm"
        />
        <div className={`font-medium ${u.is_active === false ? "text-muted-foreground line-through" : ""}`}>{u.full_name}</div>
      </div>
    </td>
    <td className="py-3 pr-4 text-muted-foreground hidden sm:table-cell text-xs">{u.email}</td>
    <td className="py-3 pr-4 text-xs text-muted-foreground hidden md:table-cell">
      {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}
    </td>
    <td className="py-3 pr-4">
      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${statusBadge(u.is_active !== false)}`}>
        {u.is_active === false ? "Inactive" : "Active"}
      </span>
    </td>
    <td className="py-3">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" title="View profile" aria-label={`View ${u.full_name}`} onClick={onView}><Eye className="h-4 w-4" /></Button>
        <Button
          variant="ghost" size="icon" disabled={toggling || deleting} title={u.is_active === false ? "Activate" : "Deactivate"} aria-label={`${u.is_active === false ? "Activate" : "Deactivate"} ${u.full_name}`}
          onClick={onToggle}
          className={u.is_active === false ? "text-success hover:text-success hover:bg-success/10" : "text-destructive hover:text-destructive hover:bg-destructive/10"}
        >
          {toggling ? <Loader2 className="h-4 w-4 animate-spin" /> : u.is_active === false ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={toggling || deleting}
          title={`Permanently delete ${u.full_name}`}
          aria-label={`Delete ${u.full_name}`}
          onClick={onDelete}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      </div>
    </td>
  </tr>
);

/* ── main page ── */
const AdminUsers = () => {
  const adminSession = getSession();
  const [refetchKey, setRefetchKey] = useState(0);
  const { data: users,  loading: usersLoading } = useAllUsers(refetchKey);
  const { data: stats, loading: statsLoading, error: statsError } = useAdminStats(refetchKey);

  const [tab, setTab]             = useState<Tab>("patients");
  const [unlockedPatients, setUnlockedPatients] = useState(false);
  const [unlockedDoctors,  setUnlockedDoctors]  = useState(false);
  const [search, setSearch]       = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState<DeletableUser | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [patientProfileId, setPatientProfileId] = useState<string | null>(null);
  const [doctorProfileId,  setDoctorProfileId]  = useState<string | null>(null);

  const patients = (users ?? []).filter((u: any) => u.role === "patient");
  const doctors  = (users ?? []).filter((u: any) => u.role === "doctor");

  const filterList = (list: any[]) =>
    list.filter(u =>
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    );

  const handleToggleActive = async (u: any) => {
    setTogglingId(u.id);
    const newState = !u.is_active;
    try {
      await setUserActive(u.id, newState);
      let auditFailed = false;
      if (adminSession) {
        try {
          await writeAuditLog(adminSession.id, adminSession.email, newState ? "activated" : "deactivated", "user", u.id, { email: u.email });
        } catch (auditError) {
          auditFailed = true;
          console.error("User status updated but audit logging failed:", auditError);
        }
      }
      if (auditFailed || !adminSession) {
        toast.warning(`${u.full_name} ${newState ? "activated" : "deactivated"}, but the audit record could not be saved.`);
      } else {
        toast.success(`${u.full_name} ${newState ? "activated" : "deactivated"}`);
      }
      setRefetchKey(k => k + 1);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser || deleteConfirmation !== "DELETE") return;
    setDeletingId(deletingUser.id);
    try {
      const deletedData = await deleteUserAccount(deletingUser.id);
      toast.success(`${deletingUser.full_name} permanently deleted`, {
        description: `Removed ${deletedData.deleted_appointments} appointments, ${deletedData.deleted_consultations} consultations, ${deletedData.deleted_medical_records} medical records, and ${deletedData.deleted_vitals} vitals.`,
      });
      setPatientProfileId(null);
      setDoctorProfileId(null);
      setDeletingUser(null);
      setDeleteConfirmation("");
      setRefetchKey(key => key + 1);
    } catch (error) {
      console.error("Unable to delete user account:", error);
      toast.error(error instanceof Error ? error.message : "Account deletion failed.");
      setRefetchKey(key => key + 1);
    } finally {
      setDeletingId(null);
    }
  };

  const unlocked = tab === "patients" ? unlockedPatients : unlockedDoctors;
  const currentList = filterList(tab === "patients" ? patients : doctors);

  return (
    <DashboardLayout requiredRole="admin">
      <InviteUserModal open={inviteOpen} onClose={() => setInviteOpen(false)} onInvited={() => setRefetchKey(k => k + 1)} />
      <Dialog
        open={deletingUser !== null}
        onOpenChange={open => {
          if (!open && deletingId === null) {
            setDeletingUser(null);
            setDeleteConfirmation("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Permanently delete account?</DialogTitle>
          </DialogHeader>
          {deletingUser && (
            <div className="space-y-3 text-sm">
              <p>
                This permanently deletes <strong>{deletingUser.full_name}</strong> ({deletingUser.email}) and cannot be undone.
              </p>
              <p className="text-muted-foreground">
                The account, appointments, consultations, messages, medical records, vitals, invitation records, and files stored in this account&apos;s storage folder will be removed. Audit history is retained.
              </p>
              <label htmlFor="confirm-account-delete" className="block font-medium">
                Type DELETE to confirm
              </label>
              <Input
                id="confirm-account-delete"
                value={deleteConfirmation}
                onChange={event => setDeleteConfirmation(event.target.value)}
                autoComplete="off"
                disabled={deletingId !== null}
              />
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeletingUser(null);
                setDeleteConfirmation("");
              }}
              disabled={deletingId !== null}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDeleteUser()}
              disabled={deletingId !== null || deleteConfirmation !== "DELETE"}
            >
              {deletingId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {patientProfileId && <PatientProfileModal id={patientProfileId} onClose={() => setPatientProfileId(null)} />}
      {doctorProfileId  && <DoctorProfileModal  id={doctorProfileId}  onClose={() => setDoctorProfileId(null)} />}

      <div className="mb-7 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-muted-foreground">Identity & access</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Users</h1>
        </div>
        <Button onClick={() => setInviteOpen(true)} className="bg-gradient-primary text-primary-foreground gap-2">
          <Plus className="h-4 w-4" /> Invite user
        </Button>
      </div>

      <InvitationManager refreshKey={refetchKey} />

      {/* Stats */}
      {statsLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : statsError ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Could not load account counts: {statsError}
        </p>
      ) : (
        <div className="stagger grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard icon={Users}       label="Total users" value={stats?.totalUsers ?? 0} trend="on platform" accent="primary" />
          <StatCard icon={Stethoscope} label="Doctors"     value={stats?.doctors ?? 0}    trend="registered"  accent="secondary" />
          <StatCard icon={UserCog}     label="Patients"    value={stats?.patients ?? 0}   trend="registered"  accent="success" />
          <StatCard icon={Shield}      label="Admins"      value={stats?.admins ?? 0}     trend="staff"       accent="warning" />
        </div>
      )}

      {/* Tabs */}
      <div className="mt-6">
        <div className="mb-4 flex items-center gap-1 rounded-xl bg-muted p-1 w-fit">
          {(["patients", "doctors"] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setSearch(""); }}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold capitalize transition-all ${tab === t ? "bg-background shadow-soft text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t === "patients" ? <UserCog className="h-4 w-4" /> : <Stethoscope className="h-4 w-4" />}
              {t} <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{t === "patients" ? patients.length : doctors.length}</span>
            </button>
          ))}
        </div>

        {usersLoading ? <SectionCardSkeleton rows={5} /> : (
          <SectionCard
            title={`${currentList.length} ${tab}`}
            action={
              unlocked ? (
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder={`Search ${tab}...`} className="h-9 pl-9 w-56" value={search} onChange={e => setSearch(e.target.value)} autoComplete="off" />
                </div>
              ) : undefined
            }
          >
            {!unlocked ? (
              <PasswordGate onUnlock={() => tab === "patients" ? setUnlockedPatients(true) : setUnlockedDoctors(true)} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <th className="pb-3 pr-4">Name</th>
                      <th className="pb-3 pr-4 hidden sm:table-cell">Email</th>
                      <th className="pb-3 pr-4 hidden md:table-cell">Joined</th>
                      <th className="pb-3 pr-4">Status</th>
                      <th className="pb-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {currentList.map((u: any) => (
                      <UserRow
                        key={u.id}
                        u={u}
                        toggling={togglingId === u.id}
                        deleting={deletingId === u.id}
                        onView={() => tab === "patients" ? setPatientProfileId(u.id) : setDoctorProfileId(u.id)}
                        onToggle={() => handleToggleActive(u)}
                        onDelete={() => { setDeletingUser(u); setDeleteConfirmation(""); }}
                      />
                    ))}
                    {currentList.length === 0 && (
                      <tr><td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No {tab} found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        )}
      </div>
    </DashboardLayout>
  );
};
export default AdminUsers;
