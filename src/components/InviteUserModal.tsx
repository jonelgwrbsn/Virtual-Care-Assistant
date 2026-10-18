import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Role } from "@/lib/auth";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onInvited?: () => void;
}

async function getInviteErrorMessage(error: unknown): Promise<{ message: string; description?: string }> {
  if (error instanceof Error && "context" in error && error.context instanceof Response) {
    const response = error.context;
    if (response.status === 404) {
      return {
        message: "The invitation service is not available.",
        description: "Deploy the invite-user Edge Function to the Supabase project configured for this app.",
      };
    }

    try {
      const body: unknown = await response.clone().json();
      if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
        return { message: body.error };
      }
    } catch {
      // Use the SDK's error message when the Edge Function response isn't JSON.
    }
  }

  if (error instanceof Error && error.name === "FunctionsFetchError") {
    return {
      message: "Could not reach the invitation service.",
      description: "Check the network connection and confirm invite-user is deployed to this Supabase project.",
    };
  }

  return {
    message: error instanceof Error ? error.message : "Failed to invite user.",
  };
}

export const InviteUserModal = ({ open, onClose, onInvited }: Props) => {
  const [loading, setLoading] = useState(false);
  const [name,    setName]    = useState("");
  const [email,   setEmail]   = useState("");
  const [role,    setRole]    = useState<Role>("patient");

  const reset = () => { setName(""); setEmail(""); setRole("patient"); };

  const handleInvite = async () => {
    if (!name.trim() || !email.trim()) return toast.error("Name and email are required");

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: { email: email.trim(), full_name: name.trim(), role },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`${name.trim()} invited as ${role}`, {
        description: "They’ll receive an email with instructions to set up their account.",
      });
      onInvited?.();
      onClose();
      reset();
    } catch (error) {
      console.error("Unable to invite user:", error);
      const details = await getInviteErrorMessage(error);
      toast.error(details.message, { description: details.description });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); reset(); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" /> Invite user
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="inv-name">Full name</Label>
            <Input id="inv-name" placeholder="Jane Doe" value={name} onChange={e => setName(e.target.value)} autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-email">Email address</Label>
            <Input id="inv-email" type="email" placeholder="jane@hospital.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" spellCheck={false} />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={v => setRole(v as Role)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="patient">Patient</SelectItem>
                <SelectItem value="doctor">Doctor</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            The invitee sets their own password using a link sent to their email.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onClose(); reset(); }} disabled={loading}>Cancel</Button>
          <Button onClick={handleInvite} disabled={loading} className="bg-gradient-primary text-primary-foreground">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
