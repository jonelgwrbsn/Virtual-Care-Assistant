import { Activity } from "lucide-react";

export const Logo = ({ className = "" }: { className?: string }) => (
  <div className={`flex items-center gap-3 ${className}`}>
    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow">
      <Activity className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
    </div>
    <div className="leading-tight">
      <div className="font-display text-base font-semibold tracking-tight text-slate-50">Virtual Care</div>
      <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">Assistant</div>
    </div>
  </div>
);
