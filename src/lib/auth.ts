import { supabase } from "./supabase";

export type Role = "patient" | "doctor" | "admin";

export interface Session {
  id: string;
  email: string;
  role: Role;
  name: string;
  onboardingCompleted: boolean;
  avatarUrl: string | null;
}

export const roleHome: Record<Role, string> = {
  patient: "/patient",
  doctor:  "/doctor",
  admin:   "/admin",
};

// ── Fetch the current session from Supabase (source of truth) ──
// Returns null if not authenticated.
export async function getSessionAsync(): Promise<Session | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, onboarding_completed, avatar_url, is_active")
    .eq("id", user.id)
    .single();

  if (error || !profile || profile.is_active !== true) return null;

  return {
    id:                  profile.id,
    email:               profile.email,
    role:                profile.role as Role,
    name:                profile.full_name,
    onboardingCompleted: profile.onboarding_completed ?? false,
    avatarUrl:           profile.avatar_url ?? null,
  };
}

// ── Synchronous cache — only used for non-critical UI reads ──
// DashboardLayout and guards use getSessionAsync instead.
let _cache: Session | null = null;
export const getSession    = () => _cache;
export const setSession    = (s: Session) => { _cache = s; };
export const clearSession  = () => { _cache = null; };

// ── Auth helpers ──
export async function signUp(
  email: string,
  password: string,
  fullName: string
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  const user = data.user;
  if (!user) throw new Error("Sign in failed — no user returned");

  // Query profile directly using the user ID from the sign-in response
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, onboarding_completed, avatar_url, is_active")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    throw new Error("Failed to load profile. Please try again.");
  }
  if (profile.is_active !== true) {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      console.error("Unable to end inactive user's authenticated session:", signOutError);
    }
    throw new Error("This account is inactive. Contact your administrator.");
  }

  const session: Session = {
    id:                  profile.id,
    email:               profile.email,
    role:                profile.role as Role,
    name:                profile.full_name,
    onboardingCompleted: profile.onboarding_completed ?? false,
    avatarUrl:           profile.avatar_url ?? null,
  };

  setSession(session);
  return session;
}

export async function resetPassword(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
  clearSession();
}
