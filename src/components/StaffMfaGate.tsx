import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingScreen } from "@/components/LoadingScreen";
import { signOut } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

type GateState = "checking" | "enroll" | "challenge" | "ready" | "error";

export const StaffMfaGate = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const [state, setState] = useState<GateState>("checking");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadAssurance = useCallback(async () => {
    setState("checking");
    setErrorMessage(null);
    try {
      const [{ data: assurance, error: assuranceError }, { data: factors, error: factorsError }] =
        await Promise.all([
          supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
          supabase.auth.mfa.listFactors(),
        ]);

      if (assuranceError) throw assuranceError;
      if (factorsError) throw factorsError;

      if (assurance.currentLevel === "aal2") {
        setState("ready");
        return;
      }

      const verifiedFactor = factors.totp.find((factor) => factor.status === "verified");
      if (verifiedFactor) {
        setFactorId(verifiedFactor.id);
        setState("challenge");
      } else {
        setState("enroll");
      }
    } catch (error) {
      console.error("Unable to verify staff MFA status:", error);
      setErrorMessage("We couldn't verify your multi-factor authentication status.");
      setState("error");
    }
  }, []);

  useEffect(() => {
    void loadAssurance();
  }, [loadAssurance]);

  const beginEnrollment = async () => {
    setBusy(true);
    setErrorMessage(null);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Virtual Care Assistant staff access",
      });
      if (error) throw error;
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
    } catch (error) {
      console.error("Unable to enroll staff MFA:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to start MFA enrollment.",
      );
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    if (!factorId || !/^\d{6}$/.test(code)) {
      setErrorMessage("Enter the six-digit code from your authenticator app.");
      return;
    }

    setBusy(true);
    setErrorMessage(null);
    try {
      let activeChallengeId = challengeId;
      if (!activeChallengeId) {
        const { data, error } = await supabase.auth.mfa.challenge({ factorId });
        if (error) throw error;
        activeChallengeId = data.id;
        setChallengeId(data.id);
      }

      const { error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: activeChallengeId,
        code,
      });
      if (error) throw error;

      const { data: assurance, error: assuranceError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError) throw assuranceError;
      if (assurance.currentLevel !== "aal2") {
        throw new Error("MFA verification did not establish the required security level.");
      }

      setState("ready");
      toast.success("Multi-factor authentication verified.");
    } catch (error) {
      console.error("Unable to verify staff MFA code:", error);
      setChallengeId(null);
      setErrorMessage(
        error instanceof Error ? error.message : "The verification code could not be verified.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Unable to sign out from the MFA prompt:", error);
      toast.error("Unable to sign out. Please try again.");
    }
  };

  if (state === "checking") {
    return <LoadingScreen label="Verifying staff security..." />;
  }

  if (state === "ready") return <>{children}</>;

  return (
    <main className="grid min-h-[70vh] place-items-center px-4 py-10">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Staff security verification</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Multi-factor authentication is required to access doctor and administrator workspaces.
        </p>

        {state === "enroll" && (
          <div className="mt-6 space-y-4">
            <p className="text-sm">
              Set up an authenticator app to protect this staff account.
            </p>
            {qrCode ? (
              <>
                <img
                  src={qrCode}
                  alt="Authenticator app enrollment QR code"
                  className="mx-auto h-48 w-48 rounded-lg border bg-white p-2"
                />
                <p className="break-all rounded-lg bg-muted p-3 text-xs">
                  Manual setup key: <code>{secret}</code>
                </p>
                <label className="block space-y-2 text-sm font-medium" htmlFor="staff-mfa-code">
                  Enter the six-digit code from your authenticator app
                  <Input
                    id="staff-mfa-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    disabled={busy}
                  />
                </label>
                <Button className="w-full" onClick={verifyCode} disabled={busy}>
                  Verify and continue
                </Button>
              </>
            ) : (
              <Button className="w-full" onClick={beginEnrollment} disabled={busy}>
                {busy ? "Preparing setup..." : "Set up authenticator"}
              </Button>
            )}
          </div>
        )}

        {state === "challenge" && (
          <div className="mt-6 space-y-4">
            <label className="block space-y-2 text-sm font-medium" htmlFor="staff-mfa-code">
              Enter the six-digit code from your authenticator app
              <Input
                id="staff-mfa-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                disabled={busy}
              />
            </label>
            <Button className="w-full" onClick={verifyCode} disabled={busy}>
              {busy ? "Verifying..." : "Verify and continue"}
            </Button>
          </div>
        )}

        {errorMessage && (
          <p role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {errorMessage}
          </p>
        )}

        {state === "error" && (
          <Button variant="outline" className="mt-4 w-full" onClick={() => void loadAssurance()}>
            Retry verification
          </Button>
        )}
        <Button variant="ghost" className="mt-3 w-full" onClick={handleSignOut}>
          Sign out
        </Button>
      </section>
    </main>
  );
};
