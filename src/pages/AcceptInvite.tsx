import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { LoadingScreen } from "@/components/LoadingScreen";
import { roleHome, setSession, type Role } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface Invitation {
  email: string;
  full_name: string;
  role: Role;
}

const AcceptInvite = () => {
  const navigate = useNavigate();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [checking, setChecking] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const validateCurrentSession = useCallback(async () => {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session) {
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      const authError = fragment.get("error_description") ?? fragment.get("error");
      throw new Error(authError
        ? authError
        : "Open the invitation link from your email to continue.");
    }

    const { data, error } = await supabase.functions.invoke("invite-user", {
      body: { action: "validate" },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    if (!data?.invitation || typeof data.invitation.email !== "string" ||
        typeof data.invitation.full_name !== "string" ||
        !["patient", "doctor", "admin"].includes(data.invitation.role)) {
      throw new Error("The invitation response was invalid. Ask your administrator for a new link.");
    }
    setInvitation(data.invitation as Invitation);
  }, []);

  useEffect(() => {
    let active = true;
    const validate = () => {
      void validateCurrentSession()
        .then(() => {
          if (active) setPageError(null);
        })
        .catch((error: unknown) => {
          console.error("Unable to validate invitation:", error);
          if (active) setPageError(error instanceof Error ? error.message : "Unable to validate this invitation.");
        })
        .finally(() => {
          if (active) setChecking(false);
        });
    };

    validate();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) queueMicrotask(validate);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [validateCurrentSession]);

  const acceptInvitation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < 12) {
      setPageError("Use a password with at least 12 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setPageError("The passwords do not match.");
      return;
    }

    setSaving(true);
    setPageError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw userError ?? new Error("Unable to load the accepted account.");
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, full_name, role, onboarding_completed, avatar_url, is_active")
        .eq("id", user.id)
        .single();
      if (profileError || !profile) throw profileError ?? new Error("Unable to load the accepted account profile.");
      if (profile.is_active !== true || profile.role !== invitation?.role) {
        throw new Error("The account role could not be verified. Contact your administrator.");
      }

      setSession({
        id: profile.id,
        email: profile.email,
        role: profile.role as Role,
        name: profile.full_name,
        onboardingCompleted: profile.onboarding_completed ?? false,
        avatarUrl: profile.avatar_url ?? null,
      });
      toast.success("Your invitation has been accepted.");
      navigate(profile.role === "doctor" && !profile.onboarding_completed
        ? "/onboarding"
        : roleHome[profile.role as Role], { replace: true });
    } catch (error) {
      console.error("Unable to complete invitation:", error);
      setPageError(error instanceof Error ? error.message : "Unable to complete the invitation.");
    } finally {
      setSaving(false);
    }
  };

  if (checking) return <LoadingScreen label="Validating your invitation…" />;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <section className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-6 shadow-soft sm:p-8">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="font-display text-2xl font-bold">Complete your invitation</h1>
          {invitation && (
            <p className="mt-2 text-sm text-muted-foreground">
              Welcome, {invitation.full_name}. Set a password for your {invitation.role} account.
            </p>
          )}
        </div>

        {pageError ? (
          <div role="alert" className="space-y-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <p>{pageError}</p>
            <p className="text-muted-foreground">
              If the link expired or was already used, contact your administrator for a replacement.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/">Return to sign in</Link>
            </Button>
          </div>
        ) : invitation ? (
          <form onSubmit={acceptInvitation} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Invited email</Label>
              <Input id="invite-email" value={invitation.email} readOnly autoComplete="username" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-password">Create password</Label>
              <Input
                id="invite-password"
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                autoComplete="new-password"
                minLength={12}
                required
              />
              <p className="text-xs text-muted-foreground">Use at least 12 characters.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-password-confirm">Confirm password</Label>
              <Input
                id="invite-password-confirm"
                type="password"
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                minLength={12}
                required
              />
            </div>
            <Button type="submit" disabled={saving} className="w-full bg-gradient-primary text-primary-foreground">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create account
            </Button>
          </form>
        ) : null}
      </section>
    </main>
  );
};

export default AcceptInvite;
