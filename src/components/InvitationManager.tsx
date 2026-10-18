import { useCallback, useEffect, useState } from "react";
import { Ban, CheckCircle2, Clock3, Loader2, Mail, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface Invitation {
  id: string;
  email: string;
  full_name: string;
  role: "patient" | "doctor" | "admin";
  status: "pending" | "accepted" | "revoked" | "expired";
  invited_at: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
}

const statusStyles: Record<Invitation["status"], string> = {
  pending: "bg-warning/15 text-warning",
  accepted: "bg-success/15 text-success",
  revoked: "bg-muted text-muted-foreground",
  expired: "bg-destructive/10 text-destructive",
};

async function getFunctionError(error: unknown): Promise<string> {
  if (error instanceof Error && "context" in error && error.context instanceof Response) {
    try {
      const body: unknown = await error.context.clone().json();
      if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
        return body.error;
      }
    } catch {
      // Fall back to the SDK message when the server response is not JSON.
    }
  }
  return error instanceof Error ? error.message : "Invitation service request failed.";
}

export const InvitationManager = ({ refreshKey = 0 }: { refreshKey?: number }) => {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadInvitations = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: { action: "list" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setInvitations(Array.isArray(data?.invitations) ? data.invitations as Invitation[] : []);
    } catch (error) {
      console.error("Unable to load invitations:", error);
      setErrorMessage(await getFunctionError(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInvitations();
  }, [loadInvitations, refreshKey]);

  const runAction = async (invitation: Invitation, action: "resend" | "revoke") => {
    if (action === "revoke" &&
        !window.confirm(`Revoke the pending invitation for ${invitation.email}?`)) return;
    setBusyId(invitation.id);
    try {
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: { action, invitation_id: invitation.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(action === "resend" ? "Replacement invitation sent." : "Invitation revoked.");
      await loadInvitations();
    } catch (error) {
      console.error(`Unable to ${action} invitation:`, error);
      toast.error(await getFunctionError(error));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" /> Invitations
          </CardTitle>
          <CardDescription className="mt-1">
            Track delivery state. Pending links expire after seven days.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadInvitations()} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading invitation history…
          </div>
        ) : errorMessage ? (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : invitations.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">No invitations have been sent yet.</p>
        ) : (
          <div className="divide-y divide-border/60">
            {invitations.map(invitation => (
              <div key={invitation.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{invitation.full_name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusStyles[invitation.status]}`}>
                      {invitation.status}
                    </span>
                    <span className="text-xs capitalize text-muted-foreground">{invitation.role}</span>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">{invitation.email}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                    <span>Sent {format(new Date(invitation.invited_at), "MMM d, yyyy")}</span>
                    {invitation.status === "pending" ? (
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="h-3 w-3" /> Expires {format(new Date(invitation.expires_at), "MMM d, yyyy")}
                      </span>
                    ) : invitation.accepted_at ? (
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Accepted {format(new Date(invitation.accepted_at), "MMM d, yyyy")}
                      </span>
                    ) : invitation.revoked_at ? (
                      <span>Revoked {format(new Date(invitation.revoked_at), "MMM d, yyyy")}</span>
                    ) : null}
                  </p>
                </div>
                {(invitation.status === "pending" || invitation.status === "expired") && (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyId !== null}
                      onClick={() => void runAction(invitation, "resend")}
                    >
                      {busyId === invitation.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                      {invitation.status === "expired" ? "Send replacement" : "Resend"}
                    </Button>
                    {invitation.status === "pending" && <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={busyId !== null}
                      onClick={() => void runAction(invitation, "revoke")}
                    >
                      {busyId === invitation.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ban className="mr-2 h-4 w-4" />}
                      Revoke
                    </Button>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
