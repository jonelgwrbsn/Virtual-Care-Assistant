import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import {
  ArrowLeft,
  HeartPulse,
  Stethoscope,
  Building2,
  Compass,
  Sparkles,
  CalendarClock,
  Users,
  ClipboardList,
  Activity,
  ShieldCheck,
  BarChart3,
  FileText,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type RoleConfig = {
  badge: string;
  headline: string;
  highlight: string;
  intro: string;
  homeLink: string;
  homeLabel: string;
  cards: {
    icon: typeof HeartPulse;
    title: string;
    tagline: string;
    description: string;
    bullets: string[];
    accent: string;
    iconBg: string;
    to?: string;
  }[];
};

const PUBLIC_CONFIG: RoleConfig = {
  badge: "Who Virtual Care Assistant is for",
  headline: "That page doesn't exist —",
  highlight: "but here's who we serve.",
  intro:
    "Virtual Care Assistant is a chatbot-based consultation platform connecting three key groups across the care journey. Explore who benefits and how.",
  homeLink: "/",
  homeLabel: "Back to home",
  cards: [
    {
      icon: HeartPulse,
      title: "Patients",
      tagline: "Care that comes to you",
      description:
        "Individuals with non-severe symptoms seeking quick, convenient medical guidance — anytime, anywhere.",
      bullets: ["AI symptom triage", "Image-based assessment", "Care recommendations"],
      accent: "from-primary/20 to-primary/5",
      iconBg: "bg-primary/15 text-primary",
    },
    {
      icon: Stethoscope,
      title: "Doctors",
      tagline: "Focus on what matters",
      description:
        "Healthcare professionals delivering virtual consultations and monitoring patient progress with clinical-grade tools.",
      bullets: ["Live consultations", "Patient timelines", "Smart prioritization"],
      accent: "from-secondary/20 to-secondary/5",
      iconBg: "bg-secondary/15 text-secondary",
    },
    {
      icon: Building2,
      title: "Hospital Staff & Admins",
      tagline: "Operate with clarity",
      description:
        "Personnel managing appointments, patient information, and overall system operations from one unified dashboard.",
      bullets: ["Appointment management", "Records & analytics", "System governance"],
      accent: "from-warning/20 to-warning/5",
      iconBg: "bg-warning/15 text-warning",
    },
  ],
};

const DOCTOR_CONFIG: RoleConfig = {
  badge: "Doctor workspace",
  headline: "This clinical page isn't ready —",
  highlight: "here's what's available in your workspace.",
  intro:
    "Quickly jump back into your patient queue, ongoing consultations, or clinical records. Pick a destination below to continue your work.",
  homeLink: "/doctor",
  homeLabel: "Back to doctor dashboard",
  cards: [
    {
      icon: CalendarClock,
      title: "Today's Consultations",
      tagline: "Your scheduled queue",
      description:
        "Review upcoming and in-progress patient consultations with priority indicators and quick join links.",
      bullets: ["Live video consults", "Triage priority", "Patient pre-visit notes"],
      accent: "from-primary/20 to-primary/5",
      iconBg: "bg-primary/15 text-primary",
      to: "/doctor",
    },
    {
      icon: Users,
      title: "Patient Timelines",
      tagline: "Holistic clinical context",
      description:
        "Access longitudinal records, prior diagnoses, prescribed treatments, and AI-summarized symptom history.",
      bullets: ["Visit history", "Lab & imaging", "AI summaries"],
      accent: "from-secondary/20 to-secondary/5",
      iconBg: "bg-secondary/15 text-secondary",
      to: "/doctor",
    },
    {
      icon: ClipboardList,
      title: "Notes & Prescriptions",
      tagline: "Document with confidence",
      description:
        "Write SOAP notes, issue e-prescriptions, and send follow-up plans straight to the patient's chat.",
      bullets: ["SOAP templates", "E-prescriptions", "Follow-up scheduling"],
      accent: "from-warning/20 to-warning/5",
      iconBg: "bg-warning/15 text-warning",
      to: "/doctor",
    },
  ],
};

const ADMIN_CONFIG: RoleConfig = {
  badge: "Admin console",
  headline: "This admin page isn't ready —",
  highlight: "here's what you can manage today.",
  intro:
    "Oversee operations, monitor system health, and govern users and records from your unified administrative workspace.",
  homeLink: "/admin",
  homeLabel: "Back to admin dashboard",
  cards: [
    {
      icon: Activity,
      title: "Operations Overview",
      tagline: "Real-time system pulse",
      description:
        "Monitor active consultations, queue volume, doctor availability, and platform performance at a glance.",
      bullets: ["Live KPIs", "Queue health", "Uptime & alerts"],
      accent: "from-primary/20 to-primary/5",
      iconBg: "bg-primary/15 text-primary",
      to: "/admin",
    },
    {
      icon: ShieldCheck,
      title: "Users & Roles",
      tagline: "Govern with precision",
      description:
        "Provision doctor and staff accounts, manage role permissions, and audit access events across the platform.",
      bullets: ["Role assignment", "Access audit", "Account lifecycle"],
      accent: "from-secondary/20 to-secondary/5",
      iconBg: "bg-secondary/15 text-secondary",
      to: "/admin",
    },
    {
      icon: BarChart3,
      title: "Reports & Records",
      tagline: "Insight into outcomes",
      description:
        "Generate operational reports, review clinical record integrity, and export data for compliance reviews.",
      bullets: ["Clinical reports", "Compliance exports", "Records integrity"],
      accent: "from-warning/20 to-warning/5",
      iconBg: "bg-warning/15 text-warning",
      to: "/admin",
    },
  ],
};

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.warn("Route not found:", location.pathname);
  }, [location.pathname]);

  const config = location.pathname.startsWith("/doctor")
    ? DOCTOR_CONFIG
    : location.pathname.startsWith("/admin")
      ? ADMIN_CONFIG
      : PUBLIC_CONFIG;

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-32 h-[36rem] w-[36rem] rounded-full bg-primary/15 blur-[120px]" />
        <div className="absolute -bottom-40 -right-32 h-[36rem] w-[36rem] rounded-full bg-secondary/15 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-12 sm:py-16">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <Link
            to={config.homeLink}
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> {config.homeLabel}
          </Link>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground backdrop-blur">
            <Compass className="h-3 w-3 text-primary" />
            Page not found · {location.pathname}
          </span>
        </div>

        <div className="mb-12 max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
            <Sparkles className="h-3 w-3" />
            {config.badge}
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {config.headline}
            <br />
            <span className="gradient-text">{config.highlight}</span>
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            {config.intro}
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {config.cards.map((u) => {
            const CardInner = (
              <article
                className={`group relative h-full overflow-hidden rounded-2xl border border-border bg-gradient-to-br ${u.accent} p-6 shadow-card backdrop-blur transition-all hover:-translate-y-1 hover:shadow-float`}
              >
                <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ${u.iconBg}`}>
                  <u.icon className="h-6 w-6" />
                </div>
                <h3 className="font-display text-xl font-bold text-foreground">{u.title}</h3>
                <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {u.tagline}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-foreground/80">{u.description}</p>
                <ul className="mt-4 space-y-1.5 border-t border-border/60 pt-3">
                  {u.bullets.map((b) => (
                    <li key={b} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="h-1 w-1 rounded-full bg-primary" />
                      {b}
                    </li>
                  ))}
                </ul>
              </article>
            );
            return u.to ? (
              <Link key={u.title} to={u.to} className="block">
                {CardInner}
              </Link>
            ) : (
              <div key={u.title}>{CardInner}</div>
            );
          })}
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 rounded-2xl border border-border bg-card/60 p-5 backdrop-blur sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold text-foreground">Looking for something specific?</p>
            <p className="text-xs text-muted-foreground">
              Jump back to your workspace or return home.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/">
                <FileText className="h-4 w-4" /> Home
              </Link>
            </Button>
            <Button asChild size="sm" className="bg-gradient-primary text-white">
              <Link to={config.homeLink}>
                <Settings className="h-4 w-4" /> {config.homeLabel}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
