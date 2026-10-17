import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Bell, LogOut, Menu, Search, PanelLeftClose, PanelLeftOpen, Moon, Sun, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { signOut, getSessionAsync, setSession, type Role, type Session } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useEffect, useState, type ReactNode } from "react";
import { useMyBroadcasts } from "@/hooks/use-supabase-data";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Avatar } from "@/components/AvatarUpload";
import {
  MessagesSquare, LayoutDashboard, FileText, Heart, Calendar,
  Users, ClipboardList, BarChart3, Settings, ShieldCheck, UserCog, Plug,
  Brain, Megaphone, ScrollText,
} from "lucide-react";
import { toast } from "sonner";

interface NavItem { to: string; label: string; icon: any; }

const navByRole: Record<Role, NavItem[]> = {
  patient: [
    { to: "/patient",              label: "Overview",     icon: LayoutDashboard },
    { to: "/patient/chat",         label: "Care Chat",    icon: MessagesSquare },
    { to: "/patient/records",      label: "Records",      icon: FileText },
    { to: "/patient/vitals",       label: "Vitals",       icon: Heart },
    { to: "/patient/appointments", label: "Appointments", icon: Calendar },
    { to: "/patient/integrations", label: "Integrations", icon: Plug },
  ],
  doctor: [
    { to: "/doctor",               label: "Queue",         icon: LayoutDashboard },
    { to: "/doctor/consultations", label: "Consultations", icon: MessagesSquare },
    { to: "/doctor/patients",      label: "Patients",      icon: Users },
    { to: "/doctor/schedule",      label: "Schedule",      icon: Calendar },
  ],
  admin: [
    { to: "/admin",                  label: "Overview",      icon: LayoutDashboard },
    { to: "/admin/users",            label: "Users",         icon: UserCog },
    { to: "/admin/appointments",     label: "Appointments",  icon: ClipboardList },
    { to: "/admin/analytics",        label: "Analytics",     icon: BarChart3 },
    { to: "/admin/knowledge-base",   label: "Knowledge Base",icon: Brain },
    { to: "/admin/broadcasts",       label: "Broadcasts",    icon: Megaphone },
    { to: "/admin/audit-log",        label: "Audit Log",     icon: ScrollText },
    { to: "/admin/security",         label: "Security",      icon: ShieldCheck },
    { to: "/admin/settings",         label: "Settings",      icon: Settings },
  ],
};

// Page titles per route
const pageTitles: Record<string, string> = {
  "/patient":              "Overview · VCA",
  "/patient/chat":         "Care Chat · VCA",
  "/patient/records":      "Medical Records · VCA",
  "/patient/vitals":       "Vitals · VCA",
  "/patient/appointments": "Appointments · VCA",
  "/patient/integrations": "Integrations · VCA",
  "/doctor":               "Queue · VCA",
  "/doctor/consultations": "Consultations · VCA",
  "/doctor/patients":      "Patients · VCA",
  "/doctor/schedule":      "Schedule · VCA",
  "/admin":                "Admin Overview · VCA",
  "/admin/users":          "Users · VCA",
  "/admin/appointments":   "Appointments · VCA",
  "/admin/analytics":      "Analytics · VCA",
  "/admin/security":       "Security · VCA",
  "/admin/settings":       "Settings · VCA",
  "/admin/knowledge-base": "Knowledge Base · VCA",
  "/admin/broadcasts":     "Broadcasts · VCA",
  "/admin/audit-log":      "Audit Log · VCA",
};

const STORAGE_KEY = "vca:sidebar-collapsed";
const THEME_KEY   = "vca:theme";

export const DashboardLayout = ({ requiredRole, children }: { requiredRole: Role; children?: ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [session, setLocalSession] = useState<Session | null | "loading">("loading");
  const [open,      setOpen]      = useState(false);
  const [collapsed, setCollapsed] = useState(() =>
    typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY) === "1"
  );
  const [dark, setDark] = useState(() =>
    typeof window !== "undefined" && localStorage.getItem(THEME_KEY) === "dark"
  );
  const [search,     setSearch]     = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [notifOpen,  setNotifOpen]  = useState(false);
  const [notifRead,  setNotifRead]  = useState(false);

  // ── Broadcasts (must be before early returns — rules of hooks) ──
  const { data: broadcasts } = useMyBroadcasts();

  // ── Load session from Supabase on mount ──
  useEffect(() => {
    getSessionAsync().then(s => {
      setSession(s);
      setLocalSession(s);
    });
  }, [location.pathname]);

  // ── Sync Supabase auth state ──
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setLocalSession(null);
        navigate("/", { replace: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  // ── #11 Dark mode ──
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  }, [dark]);

  // ── #15 Page title ──
  useEffect(() => {
    document.title = pageTitles[location.pathname] ?? "Virtual Care Assistant";
  }, [location.pathname]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  if (session === "loading") return <LoadingScreen label="Loading your workspace..." />;
  if (!session) return <Navigate to="/" replace />;
  if (session.role !== requiredRole) return <Navigate to={`/${session.role}`} replace />;
  if ((session.role === "patient" || session.role === "doctor") && !session.onboardingCompleted) {
    return <Navigate to="/onboarding" replace />;
  }
  const s        = session as import("@/lib/auth").Session;
  const nav      = navByRole[requiredRole];
  const searchResults = nav.filter((item) => item.label.toLowerCase().includes(search.toLowerCase()));

  const logout = async () => {
    await signOut();
    toast.success("Signed out");
    navigate("/");
  };

  const desktopWidth = collapsed ? "lg:w-[88px]" : "lg:w-64";
  const hasUnread = (broadcasts ?? []).length > 0 && !notifRead;

  return (
    <TooltipProvider delayDuration={0}>
      <div className="hero-bg flex min-h-[100dvh] w-full">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-background p-3 text-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to main content
      </a>
      {/* Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col p-4 transition-[transform,width] duration-300 ease-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${desktopWidth} ${open ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex h-full flex-col rounded-2xl border border-sidebar-border/60 bg-sidebar/75 shadow-soft backdrop-blur-xl">
            <div className={`flex h-14 items-center border-b border-sidebar-border/60 ${collapsed ? "justify-center px-2" : "justify-between px-4"}`}>
              {!collapsed && <Logo />}
              <button
                onClick={() => setCollapsed((c) => !c)}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                className="hidden lg:inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
              >
                {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </button>
            </div>

            <nav className={`flex-1 space-y-1 py-4 overflow-y-auto scrollbar-thin ${collapsed ? "px-2" : "px-2.5"}`}>
              {!collapsed && (
                <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {requiredRole} workspace
                </div>
              )}
              {nav.map((item) => {
                const active = location.pathname === item.to;
                const link = (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className={`group flex items-center rounded-xl text-sm font-medium transition-all ${
                      collapsed ? "h-11 w-11 justify-center mx-auto" : "gap-3 px-3 py-2.5"
                    } ${
                      active
                        ? "bg-gradient-primary text-primary-foreground shadow-soft"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    }`}
                  >
                    <item.icon className={`h-4 w-4 shrink-0 ${active ? "" : "text-muted-foreground group-hover:text-primary"}`} />
                    {!collapsed && <span>{item.label}</span>}
                  </NavLink>
                );
                return collapsed ? (
                  <Tooltip key={item.to}>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                ) : link;
              })}
            </nav>

            <div className="border-t border-sidebar-border/60 p-2.5">
              {collapsed ? (
                <div className="flex flex-col items-center gap-2">
                  <Avatar avatarUrl={s.avatarUrl} name={s.name} size="sm" editable />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label="Sign out" onClick={logout} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                        <LogOut className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Sign out</TooltipContent>
                  </Tooltip>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-xl px-2.5 py-2">
                  <Avatar avatarUrl={s.avatarUrl} name={s.name} size="sm" editable />
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-semibold">{s.name}</div>
                    <div className="truncate text-xs text-muted-foreground capitalize">{s.role}</div>
                  </div>
                  <button type="button" aria-label="Sign out" onClick={logout} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>

        {open && <div className="fixed inset-0 z-30 bg-foreground/30 lg:hidden" onClick={() => setOpen(false)} />}

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="sticky top-0 z-20 px-4 pt-4 sm:px-6 sm:pt-5">
            <header className="flex h-14 items-center gap-3 rounded-2xl border border-border/60 bg-background/75 px-3 shadow-soft backdrop-blur-xl sm:px-4">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label={open ? "Close navigation menu" : "Open navigation menu"}
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
              >
                <Menu className="h-5 w-5" />
              </Button>

              {/* ── #13 Working search ── */}
              <div className="relative hidden flex-1 max-w-md sm:block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  name="page-search"
                  aria-label="Search pages"
                  placeholder="Search pages…"
                  className="h-9 pl-9 bg-muted/50 border-transparent focus-visible:bg-background"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onFocus={() => setShowSearch(true)}
                  onBlur={() => setTimeout(() => setShowSearch(false), 150)}
                />
                {showSearch && search.trim().length > 0 && (
                  <div className="absolute top-full mt-1 w-full rounded-xl border border-border bg-popover p-2 shadow-card z-50">
                    {searchResults.length > 0 ? (
                      <ul>
                        {searchResults.map((item) => (
                          <li key={item.to}>
                            <Link
                              to={item.to}
                              onClick={() => setSearch("")}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent"
                            >
                              <item.icon className="h-4 w-4 text-muted-foreground" />
                              {item.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="px-3 py-2 text-xs text-muted-foreground">No results for "{search}"</p>
                    )}
                  </div>
                )}
              </div>

              <div className="ml-auto flex items-center gap-1">
                {/* ── #11 Dark mode toggle ── */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
                      onClick={() => setDark((d) => !d)}
                    >
                      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{dark ? "Light mode" : "Dark mode"}</TooltipContent>
                </Tooltip>

                {/* Notifications */}
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative"
                    aria-label={notifOpen ? "Close notifications" : "Open notifications"}
                    aria-expanded={notifOpen}
                    onClick={() => { setNotifOpen((v) => !v); setNotifRead(true); }}
                  >
                    <Bell className="h-5 w-5" />
                    {hasUnread && (
                      <span className="absolute right-1.5 top-1.5 flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                      </span>
                    )}
                  </Button>

                  {notifOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                      <div className="absolute right-0 top-full z-50 mt-2 w-[calc(100vw-2rem)] max-w-96 rounded-2xl border border-border bg-popover shadow-[0_20px_60px_-10px_rgba(0,0,0,0.25)] animate-scale-in overflow-hidden sm:w-96">

                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <Bell className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="text-sm font-semibold">Notifications</div>
                              <div className="text-[10px] text-muted-foreground">
                                {(broadcasts ?? []).length > 0
                                  ? `${(broadcasts ?? []).length} message${(broadcasts ?? []).length !== 1 ? "s" : ""}`
                                  : "No new messages"}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            aria-label="Close notifications"
                            onClick={() => setNotifOpen(false)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        {/* List */}
                        {(broadcasts ?? []).length > 0 ? (
                          <ul className="max-h-[360px] divide-y divide-border/40 overflow-y-auto scrollbar-thin">
                            {(broadcasts ?? []).map((b: any, i: number) => {
                              const roleColor: Record<string, string> = {
                                all:     "bg-primary/10 text-primary",
                                patient: "bg-secondary/10 text-secondary",
                                doctor:  "bg-success/10 text-success",
                              };
                              const roleLabel: Record<string, string> = {
                                all: "Everyone", patient: "Patients", doctor: "Doctors",
                              };
                              return (
                                <li key={b.id} className={`group px-5 py-4 transition-colors hover:bg-accent/40 ${i === 0 ? "bg-primary/[0.03]" : ""}`}>
                                  <div className="flex items-start gap-3">
                                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground text-[10px] font-bold">
                                      VCA
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-semibold leading-tight">{b.title}</p>
                                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${roleColor[b.target_role] ?? "bg-muted text-muted-foreground"}`}>
                                          {roleLabel[b.target_role] ?? b.target_role}
                                        </span>
                                      </div>
                                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{b.message}</p>
                                      <p className="mt-1.5 text-[10px] text-muted-foreground/50">
                                        {new Date(b.created_at).toLocaleDateString("en-PH", {
                                          month: "short", day: "numeric", year: "numeric",
                                          hour: "2-digit", minute: "2-digit",
                                        })}
                                      </p>
                                    </div>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                              <Bell className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">All caught up</p>
                              <p className="text-xs text-muted-foreground mt-0.5">No notifications from your admin yet.</p>
                            </div>
                          </div>
                        )}

                        {/* Footer */}
                        {(broadcasts ?? []).length > 0 && (
                          <div className="border-t border-border/60 px-5 py-3 bg-muted/30">
                            <p className="text-[10px] text-muted-foreground text-center">
                              Showing {(broadcasts ?? []).length} broadcast{(broadcasts ?? []).length !== 1 ? "s" : ""} from your administrator
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <div className="hidden h-8 items-center gap-2 rounded-full bg-accent px-3 text-xs font-medium text-accent-foreground sm:flex">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" /> All systems normal
                </div>
              </div>
            </header>
          </div>

          <main id="main-content" tabIndex={-1} className="flex-1 overflow-x-hidden px-4 pb-8 pt-6 sm:px-6 lg:px-8 animate-fade-in">
            {children ?? <Outlet />}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
};
