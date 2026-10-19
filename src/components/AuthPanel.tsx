import { useEffect, useState } from "react";
import { Eye, EyeOff, Mail, Lock, User, Loader2, ArrowRight, HeartPulse, ShieldCheck } from "lucide-react";
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
    <div className="relative w-full max-w-[26rem]">
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

            <form onSubmit={submit} autoComplete="off" className="space-y-4">
              <FieldEmail email={email} setEmail={setEmail} inputId="login-email" />
              <FieldPassword id="login-password" label="Password" value={password} setValue={setPassword} show={showPw} setShow={setShowPw} />

              <div className="flex items-center justify-between text-[13px]">
                <label className="flex cursor-pointer items-center gap-2 font-medium text-slate-600 transition-colors hover:text-slate-900">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2" />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setForgotOpen(true);
                  }}
                  className="font-semibold text-primary transition-colors hover:text-primary/80 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  Forgot password?
                </button>
              </div>

              <Button type="submit" disabled={loading} className="group h-12 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-[0_8px_18px_-8px_hsl(var(--primary)/0.7)] transition-all hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-[0_12px_24px_-10px_hsl(var(--primary)/0.8)]">
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
            <Header title="Create your account" subtitle="Create your patient account." />
            <ModeToggle mode={mode} setMode={setMode} />

            <form onSubmit={submit} autoComplete="off" className="space-y-1">
              <div className="space-y-0.5">
                <Label htmlFor="name" className="text-xs font-medium text-slate-700">Full name</Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input id="name" name="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" className="h-10 rounded-lg border-slate-200 bg-white pl-11 text-sm shadow-sm transition-colors placeholder:text-slate-400 hover:border-slate-300 focus-visible:border-primary focus-visible:ring-primary/20" autoComplete="name" />
                </div>
              </div>

              <FieldEmail email={email} setEmail={setEmail} compact inputId="reg-email" />
              <FieldPassword id="reg-password" label="Password" value={password} setValue={setPassword} show={showPw} setShow={setShowPw} compact showStrength />
              <FieldPassword id="reg-confirm" label="Confirm password" value={confirm} setValue={setConfirm} show={showPw2} setShow={setShowPw2} compact />

              <div className="flex items-start gap-2 rounded-lg border border-primary/15 bg-primary/[0.06] px-2.5 py-1 text-[11px] leading-relaxed text-slate-600">
                <HeartPulse className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span><strong className="font-semibold text-slate-800">Patient</strong> account. Staff access is provisioned by an administrator.</span>
              </div>

              <Button type="submit" disabled={loading} className="group h-11 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-[0_8px_18px_-8px_hsl(var(--primary)/0.7)] transition-all hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-[0_12px_24px_-10px_hsl(var(--primary)/0.8)] [@media(max-height:720px)]:h-10">
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
  <div className="relative w-full overflow-hidden rounded-2xl border border-white/70 bg-white p-4 text-slate-900 shadow-[0_32px_90px_-30px_rgba(2,20,34,0.72)] [@media(max-height:720px)]:p-3">
    <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
    {children}
    <div className="mt-2 flex items-center justify-center gap-2 border-t border-slate-100 pt-2 text-[11px] font-medium text-slate-500 [@media(max-height:720px)]:hidden">
      <ShieldCheck className="h-4 w-4 text-primary" />
      <span>Secure access to your care account</span>
    </div>
  </div>
);

const Header = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <div className="mb-3 [@media(max-height:720px)]:mb-2">
    <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Virtual Care Portal</p>
    <h2 className="font-display text-xl font-bold tracking-tight text-slate-900">{title}</h2>
    <p className="mt-0.5 text-xs leading-relaxed text-slate-500 [@media(max-height:720px)]:hidden">{subtitle}</p>
  </div>
);

const ModeToggle = ({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) => (
  <div className="relative mb-2 grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm font-semibold" role="group" aria-label="Choose sign-in or registration">
    <button
      type="button"
      onClick={() => setMode("login")}
      aria-pressed={mode === "login"}
      className={`relative z-10 rounded-md py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${mode === "login" ? "text-slate-900" : "text-slate-500 hover:text-slate-800"}`}
    >Sign in</button>
    <button
      type="button"
      onClick={() => setMode("register")}
      aria-pressed={mode === "register"}
      className={`relative z-10 rounded-md py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${mode === "register" ? "text-slate-900" : "text-slate-500 hover:text-slate-800"}`}
    >Register</button>
    <span
      aria-hidden="true"
      className="absolute bottom-1 left-1 top-1 w-[calc(50%-0.25rem)] rounded-md bg-white shadow-sm ring-1 ring-slate-200/70 transition-transform duration-300 ease-out"
      style={{ transform: mode === "login" ? "translateX(0)" : "translateX(100%)" }}
    />
  </div>
);

const FieldEmail = ({ email, setEmail, compact, inputId = "email" }: { email: string; setEmail: (v: string) => void; compact?: boolean; inputId?: string }) => (
  <div className="space-y-0.5">
    <Label htmlFor={inputId} className="text-xs font-medium text-slate-700">Email address</Label>
    <div className="relative">
      <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <Input
        id={inputId}
        name={inputId}
        type="email"
        autoComplete={inputId === "login-email" ? "username" : "email"}
        spellCheck={false}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@hospital.com"
        className={`${compact ? "h-10" : "h-11"} rounded-lg border-slate-200 bg-white pl-11 text-sm shadow-sm transition-colors placeholder:text-slate-400 hover:border-slate-300 focus-visible:border-primary focus-visible:ring-primary/20 [@media(max-height:720px)]:h-9`}
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
    <div className="space-y-0.5">
      <Label htmlFor={id} className="text-xs font-medium text-slate-700">{label}</Label>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          id={id}
          name={id}
          type={show ? "text" : "password"}
          autoComplete={id.startsWith("reg-") ? "new-password" : "current-password"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="••••••••"
          className={`${compact ? "h-10" : "h-11"} rounded-lg border-slate-200 bg-white pl-11 pr-11 text-sm shadow-sm transition-colors placeholder:text-slate-400 hover:border-slate-300 focus-visible:border-primary focus-visible:ring-primary/20 [@media(max-height:720px)]:h-9`}
        />
        <button type="button" aria-label={show ? "Hide password" : "Show password"} aria-pressed={show} onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm text-slate-400 transition-colors hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      {showStrength && value.length > 0 && (
        <div className="space-y-1 pt-0.5">
          <div className="flex items-center gap-2">
            <div className="flex flex-1 gap-1">
              {STRENGTH_META.map((s, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-all duration-300 ${i < strength ? meta.color : "bg-muted"}`}
                />
              ))}
            </div>
            <span className={`shrink-0 text-[10px] font-semibold ${meta.color.replace("bg-", "text-")}`}>{meta.label}</span>
          </div>
          <p className="text-[10px] leading-tight text-slate-500">8+ characters with uppercase, lowercase, number &amp; symbol.</p>
        </div>
      )}
    </div>
  );
};
