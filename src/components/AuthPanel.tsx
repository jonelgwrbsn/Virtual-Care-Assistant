import { useEffect, useState } from "react";
import { Eye, EyeOff, Mail, Lock, User, Loader2, ArrowRight, HeartPulse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { resetPassword, signIn, signUp, roleHome } from "@/lib/auth";
import { toast } from "sonner";

/* ---------- password policy ---------- */
const PW_RULES = [
  { label: "Lowercase letter",   test: (v: string) => new RegExp('[a-z]').test(v) },
  { label: "Uppercase letter",   test: (v: string) => new RegExp('[A-Z]').test(v) },
  { label: "Number",             test: (v: string) => new RegExp('[0-9]').test(v) },
  { label: "Special character",  test: (v: string) => new RegExp('[^A-Za-z0-9]').test(v) },
  { label: "At least 8 characters", test: (v: string) => v.length >= 8 },
];

const getStrength = (v: string) => PW_RULES.filter(r => r.test(v)).length;

const STRENGTH_META = [
  { label: "Too weak",  color: "bg-destructive" },
  { label: "Weak",      color: "bg-destructive" },
  { label: "Fair",      color: "bg-warning" },
  { label: "Good",      color: "bg-warning" },
  { label: "Strong",    color: "bg-success" },
  { label: "Very strong", color: "bg-success" },
];

function validatePassword(pw: string): string | null {
  for (const rule of PW_RULES) {
    if (!rule.test(pw)) return `Password requires: ${rule.label.toLowerCase()}`;
  }
  return null;
}

type Mode = "login" | "register";

export const AuthPanel = () => {
  const [mode, setMode] = useState<Mode>("login");
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [remember, setRemember] = useState(true);
  const [forgotOpen, setForgotOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { setShowPw(false); setShowPw2(false); }, [mode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return toast.error("Email and password are required");
    if (mode === "register") {
      if (!name.trim()) return toast.error("Full name is required");
      const pwError = validatePassword(password);
      if (pwError) return toast.error(pwError);
      if (password !== confirm) return toast.error("Passwords do not match");
    }
    setLoading(true);
    try {
      if (mode === "register") {
        await signUp(email, password, name.trim());
        toast.success(`Welcome to Virtual Care, ${name.trim()}! Check your email to confirm your account.`);
      } else {
        const session = await signIn(email, password);
        toast.success(`Welcome back, ${session.name}`);
        if ((session.role === "patient" || session.role === "doctor") && !session.onboardingCompleted) {
          navigate("/onboarding");
        } else {
          navigate(roleHome[session.role]);
        }
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

    const handlePasswordReset = async () => {
      if (!forgotEmail.trim()) {
        toast.error("Please enter your email first.");
        return;
      }
      setResetLoading(true);
      try {
        await resetPassword(forgotEmail.trim());
        toast.success("Password reset email sent. Check your inbox.");
        setForgotOpen(false);
      } catch (err: any) {
        toast.error(err?.message ?? "Unable to send reset email.");
      } finally {
        setResetLoading(false);
      }
    };

    const isRegister = mode === "register";

    return (
    <div className="relative w-full max-w-sm">
      {/* Single card — fades between login and register, no height clipping */}
      <div className="relative">
        {/* FRONT — Sign in */}
        <div
          className={`transition-all duration-300 ${isRegister ? "pointer-events-none absolute inset-0 opacity-0 scale-95" : "opacity-100 scale-100"}`}
          aria-hidden={isRegister}
        >
          <Card>
            <Header title="Welcome back" subtitle="Sign in to your virtual care portal" />
            <ModeToggle mode={mode} setMode={setMode} />

            <form onSubmit={submit} autoComplete="off" className="space-y-3">
              <FieldEmail email={email} setEmail={setEmail} inputId="login-email" />
              <FieldPassword id="login-password" label="Password" value={password} setValue={setPassword} show={showPw} setShow={setShowPw} />

              <div className="flex items-center justify-between text-[11px]">
                <label className="flex cursor-pointer items-center gap-2 font-medium text-foreground/70 hover:text-foreground transition-colors">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-3.5 w-3.5 rounded border-border accent-primary" />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setForgotOpen(true);
                  }}
                  className="font-semibold text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>

              <Button type="submit" disabled={loading} className="group h-10 w-full bg-gradient-primary text-white shadow-soft hover:shadow-glow transition-all hover:scale-[1.01]">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  <> Sign in <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /> </>
                )}
              </Button>
            </form>
          </Card>
        </div>

        {/* BACK — Register */}
        <div
          className={`transition-all duration-300 ${isRegister ? "opacity-100 scale-100" : "pointer-events-none absolute inset-0 opacity-0 scale-95"}`}
          aria-hidden={!isRegister}
        >
          <Card>
            <Header title="Create your account" subtitle="Patient registration — staff accounts are provisioned by admin" />
            <ModeToggle mode={mode} setMode={setMode} />

            <form onSubmit={submit} autoComplete="off" className="space-y-2">
              <div className="space-y-1">
                <Label htmlFor="name" className="text-xs font-semibold text-foreground">Full name</Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="name" name="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" className="h-9 pl-10" autoComplete="name" />
                </div>
              </div>

              <FieldEmail email={email} setEmail={setEmail} compact inputId="reg-email" />
              <FieldPassword id="reg-password" label="Password" value={password} setValue={setPassword} show={showPw} setShow={setShowPw} compact showStrength />
              <FieldPassword id="reg-confirm" label="Confirm password" value={confirm} setValue={setConfirm} show={showPw2} setShow={setShowPw2} compact />

              <div className="flex items-start gap-2 rounded-md bg-primary/5 px-2 py-1.5 text-[10px] leading-snug text-foreground/70">
                <HeartPulse className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                <span>Registered as <strong className="text-primary">Patient</strong>. Staff accounts are provisioned by admin.</span>
              </div>

              <Button type="submit" disabled={loading} className="group h-9 w-full bg-gradient-primary text-white shadow-soft hover:shadow-glow transition-all hover:scale-[1.01]">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  <> Create account <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /> </>
                )}
              </Button>
            </form>
          </Card>
        </div>

        <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Reset password</DialogTitle>
              <DialogDescription>
                Enter the email you used to sign in, and we will send reset instructions.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Label htmlFor="reset-email" className="text-xs font-semibold text-foreground">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  spellCheck={false}
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="you@hospital.com"
                  className="h-10 pl-10"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setForgotOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handlePasswordReset}
                className="bg-gradient-primary text-white"
                disabled={resetLoading}
              >
                {resetLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset email"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

/* ---------- subcomponents ---------- */

const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="relative w-full rounded-xl bg-card p-4 text-card-foreground shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55)] ring-1 ring-border">
    <div className="absolute inset-x-0 -top-px mx-8 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
    {children}
  </div>
);

const Header = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <div className="mb-2">
    <h2 className="font-display text-lg font-bold tracking-tight text-foreground">{title}</h2>
    <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
  </div>
);

const ModeToggle = ({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) => (
  <div className="relative mb-3 grid grid-cols-2 rounded-full bg-muted p-0.5 text-xs font-semibold">
    <button
      type="button"
      onClick={() => setMode("login")}
      className={`relative z-10 rounded-full py-1.5 transition-colors ${mode === "login" ? "text-white" : "text-muted-foreground hover:text-foreground"}`}
    >Sign in</button>
    <button
      type="button"
      onClick={() => setMode("register")}
      className={`relative z-10 rounded-full py-1.5 transition-colors ${mode === "register" ? "text-white" : "text-muted-foreground hover:text-foreground"}`}
    >Register</button>
    <span
      className="absolute top-0.5 bottom-0.5 w-[calc(50%-0.125rem)] rounded-full bg-gradient-primary shadow-soft transition-transform duration-500 ease-out"
      style={{ transform: mode === "login" ? "translateX(0.125rem)" : "translateX(calc(100% + 0.125rem))" }}
    />
  </div>
);

const FieldEmail = ({ email, setEmail, compact, inputId = "email" }: { email: string; setEmail: (v: string) => void; compact?: boolean; inputId?: string }) => (
  <div className="space-y-1">
    <Label htmlFor={inputId} className="text-xs font-semibold text-foreground">Email</Label>
    <div className="relative">
      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id={inputId}
        name={inputId}
        type="email"
        autoComplete={inputId === "login-email" ? "username" : "email"}
        spellCheck={false}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@hospital.com"
        className={`${compact ? "h-9" : "h-10"} pl-10`}
      />
    </div>
  </div>
);

const FieldPassword = ({ id, label, value, setValue, show, setShow, compact, showStrength }: {
  id: string; label: string; value: string; setValue: (v: string) => void; show: boolean; setShow: (v: boolean) => void; compact?: boolean; showStrength?: boolean;
}) => {
  const strength = showStrength ? getStrength(value) : 0;
  const meta = STRENGTH_META[strength];

  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-semibold text-foreground">{label}</Label>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          name={id}
          type={show ? "text" : "password"}
          autoComplete={id.startsWith("reg-") ? "new-password" : "current-password"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="••••••••"
          className={`${compact ? "h-9" : "h-10"} pl-10 pr-10`}
        />
        <button type="button" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      {showStrength && value.length > 0 && (
        <div className="space-y-1.5 pt-0.5">
          <div className="flex gap-1">
            {STRENGTH_META.map((s, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-all duration-300 ${i < strength ? meta.color : "bg-muted"}`}
              />
            ))}
          </div>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-semibold ${meta.color.replace("bg-", "text-")}`}>{meta.label}</span>
          </div>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            {PW_RULES.map((rule) => {
              const passed = rule.test(value);
              return (
                <li key={rule.label} className={`flex items-center gap-1 text-[10px] transition-colors ${passed ? "text-success" : "text-muted-foreground"}`}>
                  <span className={`inline-block h-1.5 w-1.5 rounded-full flex-shrink-0 ${passed ? "bg-success" : "bg-muted-foreground/40"}`} />
                  {rule.label}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};
