import { Stethoscope, MessagesSquare, ShieldCheck, Activity } from "lucide-react";
import { HealthIllustration } from "./HealthIllustration";

export const LandingHero = () => {
  return (
    <div className="relative flex h-full w-full flex-col justify-between overflow-hidden p-6 lg:p-8 xl:p-10">
      {/* ambient blobs (inside hero card) */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-secondary/25 blur-3xl" />

      <div className="relative z-10 animate-fade-in-left">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-white/80 backdrop-blur">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
          </span>
          AI triage · Clinician reviewed
        </div>

        <h1 className="mt-5 font-display text-[clamp(2rem,3.4vw,3.5rem)] font-bold leading-[1.02] tracking-tight text-white">
          <span className="gradient-text">Virtual Care</span>
          <br />
          <span className="text-white/90">that listens first.</span>
        </h1>

        <p className="mt-3 max-w-md text-sm leading-relaxed text-white/60 xl:text-base">
          A clinical-grade chatbot that assesses symptoms, offers care guidance, and connects patients to doctors when it matters.
        </p>
      </div>

      {/* Center illustration */}
      <div className="relative z-10 mx-auto my-2 w-full max-w-[26rem] xl:max-w-[30rem] flex-1 min-h-0 flex items-center justify-center">
        <div className="relative h-full w-full max-h-[55vh]">
          <HealthIllustration />

          {/* Floating preview cards */}
          <div className="absolute -left-2 top-6 hidden animate-float rounded-2xl border border-white/15 bg-white/10 px-3 py-2 shadow-card backdrop-blur-xl xl:block">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/30 text-primary-glow">
                <MessagesSquare className="h-3.5 w-3.5" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-white">Symptom check</div>
                <div className="text-[9px] text-white/60">Conversational triage</div>
              </div>
            </div>
          </div>

          <div className="absolute -right-2 top-24 hidden animate-float-slow rounded-2xl border border-white/15 bg-white/10 px-3 py-2 shadow-card backdrop-blur-xl xl:block">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/30 text-white">
                <Activity className="h-3.5 w-3.5" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-white">Vitals tracking</div>
                <div className="text-[9px] font-medium text-emerald-300">Stable · 72 bpm</div>
              </div>
            </div>
          </div>

          <div className="absolute bottom-2 left-4 hidden animate-float rounded-2xl border border-white/15 bg-white/10 px-3 py-2 shadow-card backdrop-blur-xl xl:block" style={{ animationDelay: "1.2s" }}>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400/25 text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-white">Doctor verified</div>
                <div className="text-[9px] text-white/60">Reviewed in 4 min</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 grid grid-cols-3 gap-2.5 animate-fade-in" style={{ animationDelay: "0.4s" }}>
        {[
          { icon: Stethoscope, label: "200+ doctors", sub: "On-call network" },
          { icon: MessagesSquare, label: "24/7 chatbot", sub: "Avg reply 1.2s" },
          { icon: ShieldCheck, label: "Encrypted", sub: "HIPAA aware" },
        ].map((s, i) => (
          <div key={i} className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 backdrop-blur">
            <s.icon className="h-4 w-4 text-primary-glow" />
            <div className="mt-1 text-[11px] font-semibold text-white/90">{s.label}</div>
            <div className="text-[9px] text-white/50">{s.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
