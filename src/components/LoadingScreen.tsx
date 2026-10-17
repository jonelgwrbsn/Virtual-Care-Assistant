import { Logo } from "@/components/Logo";

export const LoadingScreen = ({ label = "Preparing your care space" }: { label?: string }) => (
  <div className="hero-bg fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 animate-fade-in">
    {/* Decorative blobs */}
    <div className="pointer-events-none absolute -top-20 -left-20 h-72 w-72 rounded-full bg-primary/10 blur-3xl animate-float" />
    <div className="pointer-events-none absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-secondary/10 blur-3xl animate-float-slow" />

    <div className="relative">
      {/* Pulsing rings */}
      <div className="absolute inset-0 rounded-full bg-primary/20 animate-pulse-ring" />
      <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-primary shadow-glow">
        <svg viewBox="0 0 24 24" className="h-10 w-10 text-primary-foreground">
          <path
            fill="currentColor"
            d="M12 21s-7-4.35-7-10a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 5.65-7 10-7 10h-4z"
            opacity="0.25"
          />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 12h4l2-5 4 10 2-5h6"
          />
        </svg>
      </div>
    </div>

    <div className="flex flex-col items-center gap-3 text-center">
      <Logo />
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-primary animate-typing" style={{ animationDelay: "0ms" }} />
        <span className="h-2 w-2 rounded-full bg-primary animate-typing" style={{ animationDelay: "200ms" }} />
        <span className="h-2 w-2 rounded-full bg-primary animate-typing" style={{ animationDelay: "400ms" }} />
      </div>
    </div>
  </div>
);

export default LoadingScreen;
