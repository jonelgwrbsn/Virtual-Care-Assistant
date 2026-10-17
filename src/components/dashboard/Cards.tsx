import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export const StatCard = ({ icon: Icon, label, value, trend, accent = "primary" }: {
  icon: any; label: string; value: string | number; trend?: string; accent?: "primary" | "secondary" | "success" | "warning";
}) => {
  const accents = {
    primary: { glow: "from-primary/20 to-primary/5", text: "text-primary", ring: "ring-primary/20" },
    secondary: { glow: "from-secondary/20 to-secondary/5", text: "text-secondary", ring: "ring-secondary/20" },
    success: { glow: "from-success/20 to-success/5", text: "text-success", ring: "ring-success/20" },
    warning: { glow: "from-warning/20 to-warning/5", text: "text-warning", ring: "ring-warning/20" },
  } as const;
  const a = accents[accent];
  return (
    <div className="card-modern group relative overflow-hidden p-5">
      <div className={cn("absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br opacity-80 blur-2xl transition-opacity group-hover:opacity-100", a.glow)} />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
          <div className="mt-1.5 font-display text-3xl font-bold tracking-tight tabular-nums">{value}</div>
          {trend && <div className="mt-1 text-xs text-muted-foreground">{trend}</div>}
        </div>
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl bg-background/90 ring-1 shadow-soft transition-all duration-300 group-hover:scale-110 group-hover:rotate-3", a.ring, a.text)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
};

export const SectionCard = ({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) => (
  <div className={cn("card-modern p-5 sm:p-6", className)}>
    <div className="mb-5 flex items-center justify-between gap-3">
      <h3 className="font-display text-base font-semibold tracking-tight">{title}</h3>
      {action}
    </div>
    {children}
  </div>
);

export const StatCardSkeleton = () => (
  <div className="card-modern relative overflow-hidden p-5">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="h-2.5 w-20 rounded-full shimmer-bg" />
        <div className="h-7 w-24 rounded-md shimmer-bg" />
        <div className="h-2.5 w-16 rounded-full shimmer-bg" />
      </div>
      <div className="h-11 w-11 rounded-xl shimmer-bg" />
    </div>
  </div>
);

export const SectionCardSkeleton = ({ rows = 3, className }: { rows?: number; className?: string }) => (
  <div className={cn("card-modern p-5 sm:p-6", className)}>
    <div className="mb-5 flex items-center justify-between gap-3">
      <div className="h-4 w-32 rounded-full shimmer-bg" />
      <div className="h-7 w-20 rounded-lg shimmer-bg" />
    </div>
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 rounded-xl shimmer-bg" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-3/4 rounded-full shimmer-bg" />
            <div className="h-2.5 w-1/2 rounded-full shimmer-bg" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const ChartSkeleton = ({ className }: { className?: string }) => (
  <div className={cn("card-modern p-5 sm:p-6", className)}>
    <div className="mb-5 flex items-center justify-between gap-3">
      <div className="h-4 w-40 rounded-full shimmer-bg" />
    </div>
    <div className="relative h-72 w-full overflow-hidden rounded-xl shimmer-bg">
      <div className="absolute inset-x-4 bottom-4 flex items-end gap-2">
        {[60, 40, 75, 50, 85, 65, 90].map((h, i) => (
          <div key={i} className="flex-1 rounded-t-md bg-background/40" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  </div>
);
