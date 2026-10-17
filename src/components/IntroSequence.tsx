import { useEffect, useState } from "react";
import { Activity } from "lucide-react";

const TAGLINE = "Virtual care that listens first.";
const KEY = "vca_intro_played";

export const IntroSequence = ({ onDone }: { onDone?: () => void }) => {
  const [phase, setPhase] = useState<"logo" | "type" | "out" | "gone">("logo");
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem(KEY)) {
      setPhase("gone");
      onDone?.();
      return;
    }
    const t1 = setTimeout(() => setPhase("type"), 900);
    return () => clearTimeout(t1);
  }, [onDone]);

  useEffect(() => {
    if (phase !== "type") return;
    let i = 0;
    const id = setInterval(() => {
      i++;
      setTyped(TAGLINE.slice(0, i));
      if (i >= TAGLINE.length) {
        clearInterval(id);
        setTimeout(() => setPhase("out"), 700);
      }
    }, 45);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== "out") return;
    const t = setTimeout(() => {
      setPhase("gone");
      sessionStorage.setItem(KEY, "1");
      onDone?.();
    }, 800);
    return () => clearTimeout(t);
  }, [phase, onDone]);

  if (phase === "gone") return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[hsl(210_45%_6%)] transition-opacity duration-700 ${
        phase === "out" ? "opacity-0" : "opacity-100"
      }`}
      aria-hidden={phase === "out"}
    >
      {/* Ambient layers */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_30%,hsl(178_70%_30%/0.5),transparent_55%),radial-gradient(ellipse_at_70%_75%,hsl(212_80%_32%/0.5),transparent_55%)]" />
      <div className="absolute -top-40 -left-32 h-[34rem] w-[34rem] rounded-full bg-primary/30 blur-[110px] animate-float-slow" />
      <div className="absolute -bottom-40 -right-32 h-[34rem] w-[34rem] rounded-full bg-secondary/25 blur-[110px] animate-float" />
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(0_0%_100%/0.5) 1px, transparent 1px), linear-gradient(90deg, hsl(0_0%_100%/0.5) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,hsl(210_50%_3%/0.85)_100%)]" />

      {/* Sweep highlight */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="intro-sweep absolute -inset-y-32 -left-1/3 w-1/2 rotate-12 bg-gradient-to-r from-transparent via-white/10 to-transparent blur-2xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center px-6 text-center">
        {/* Logo */}
        <div className="relative">
          <span className="absolute inset-0 -z-10 rounded-3xl bg-primary/30 blur-2xl animate-pulse-ring" />
          <div className="intro-logo flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-primary shadow-[0_0_60px_hsl(178_72%_56%/0.55)]">
            <Activity className="h-10 w-10 text-primary-foreground" strokeWidth={2.4} />
          </div>
          {/* Orbit ring */}
          <div className="pointer-events-none absolute inset-1/2 -z-10 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute inset-1/2 -z-10 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/5" />
        </div>

        {/* Wordmark */}
        <div className="intro-word mt-7 overflow-hidden">
          <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            <span className="gradient-text">Virtual Care</span>{" "}
            <span className="text-white/90">Assistant</span>
          </h1>
        </div>

        {/* Typewriter tagline */}
        <div className="mt-4 h-6 text-sm font-medium uppercase tracking-[0.28em] text-white/55 sm:text-[13px]">
          {phase === "logo" ? (
            <span className="opacity-0">.</span>
          ) : (
            <span>
              {typed}
              <span className="ml-0.5 inline-block h-3.5 w-[2px] -translate-y-[1px] animate-pulse bg-primary-glow" />
            </span>
          )}
        </div>

        {/* Loader bar */}
        <div className="mt-10 h-[2px] w-48 overflow-hidden rounded-full bg-white/10">
          <div className="intro-bar h-full bg-gradient-to-r from-primary via-primary-glow to-secondary" />
        </div>
      </div>

      <style>{`
        .intro-logo {
          animation: introLogoIn 0.9s cubic-bezier(0.22,1,0.36,1) both;
        }
        .intro-word {
          animation: introWordIn 0.7s cubic-bezier(0.22,1,0.36,1) 0.5s both;
        }
        .intro-bar {
          width: 0%;
          animation: introBar 2.2s cubic-bezier(0.65,0,0.35,1) 0.4s forwards;
        }
        .intro-sweep {
          animation: introSweep 1.6s cubic-bezier(0.65,0,0.35,1) 0.3s both;
        }
        @keyframes introLogoIn {
          0% { opacity: 0; transform: scale(0.6) rotate(-12deg); filter: blur(8px); }
          100% { opacity: 1; transform: scale(1) rotate(0); filter: blur(0); }
        }
        @keyframes introWordIn {
          0% { opacity: 0; transform: translateY(14px); letter-spacing: 0.08em; }
          100% { opacity: 1; transform: translateY(0); letter-spacing: -0.02em; }
        }
        @keyframes introBar { to { width: 100%; } }
        @keyframes introSweep {
          0% { transform: translateX(-30%) rotate(12deg); opacity: 0; }
          40% { opacity: 1; }
          100% { transform: translateX(280%) rotate(12deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
};
