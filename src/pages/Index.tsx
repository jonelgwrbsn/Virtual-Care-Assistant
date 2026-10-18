import { LandingHero } from "@/components/LandingHero";
import { AuthPanel } from "@/components/AuthPanel";
import { Logo } from "@/components/Logo";
import { IntroSequence } from "@/components/IntroSequence";

const Index = () => {
  return (
    <div className="relative min-h-screen w-screen overflow-x-hidden bg-[hsl(210_40%_8%)] text-foreground">
      <IntroSequence />
      {/* Cinematic background layers */}
      <div className="pointer-events-none absolute inset-0">
        {/* Deep gradient base */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_20%,hsl(178_70%_28%/0.55),transparent_55%),radial-gradient(ellipse_at_80%_80%,hsl(212_80%_30%/0.55),transparent_55%),linear-gradient(180deg,hsl(210_45%_7%),hsl(212_55%_11%))]" />
        {/* Animated aurora blobs */}
        <div className="absolute -top-40 -left-32 h-[42rem] w-[42rem] rounded-full bg-primary/25 blur-[120px] animate-float-slow" />
        <div className="absolute -bottom-40 -right-32 h-[40rem] w-[40rem] rounded-full bg-secondary/30 blur-[120px] animate-float" />
        <div className="absolute left-1/3 top-1/3 h-72 w-72 rounded-full bg-primary-glow/20 blur-3xl animate-float" style={{ animationDelay: "1s" }} />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(0_0%_100%/0.5) 1px, transparent 1px), linear-gradient(90deg, hsl(0_0%_100%/0.5) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          }}
        />
        {/* Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,hsl(210_50%_4%/0.85)_100%)]" />
        {/* Grain */}
        <div className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
          style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")" }} />
      </div>

      {/* Top bar */}
      <header className="relative z-30 flex items-center justify-between px-6 py-4 sm:px-10 sm:py-5">
        <div className="[&_*]:text-white">
          <Logo />
        </div>
      </header>

      {/* Stage */}
      <main className="relative z-10 mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-4 px-4 pb-6 sm:px-6 md:grid-cols-[1.1fr_minmax(340px,0.9fr)] md:h-[calc(100vh-7rem)] lg:grid-cols-[1.2fr_minmax(380px,0.75fr)] lg:px-10">
        {/* Left cinematic hero */}
        <section className="relative hidden h-full overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-sm md:block">
          <div className="dark h-full">
            <LandingHero />
          </div>
        </section>

        {/* Mobile compact hero */}
        <section className="pt-2 pb-4 md:hidden">
          <h1 className="font-display text-2xl font-bold leading-tight text-white">
            <span className="gradient-text">Virtual Care</span>
            <br />that listens first.
          </h1>
          <p className="mt-2 text-sm text-white/60">AI triage chatbot for non-severe symptoms with seamless doctor escalation.</p>
        </section>

        {/* Right auth — centered, no scroll */}
        <section className="relative flex h-full items-center justify-center py-4 md:items-center">
          <div className="w-full max-w-sm">
            <AuthPanel />
          </div>
        </section>
      </main>

      {/* Bottom marquee */}
      <footer className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between border-t border-white/5 px-6 py-2.5 text-[10px] uppercase tracking-[0.2em] text-white/40 sm:px-10">
        <span>© {new Date().getFullYear()} Virtual Care Assistant</span>
        <span className="hidden sm:block">Non-emergency symptom guidance · Clinician escalation</span>
        <span>EN · US</span>
      </footer>
    </div>
  );
};

export default Index;
