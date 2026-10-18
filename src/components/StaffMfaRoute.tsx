import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { LoadingScreen } from "@/components/LoadingScreen";
import { StaffMfaGate } from "@/components/StaffMfaGate";
import { getSessionAsync, roleHome, setSession, type Role, type Session } from "@/lib/auth";

type RouteSession = Session | null | "loading";

export const StaffMfaRoute = ({ requiredRole }: { requiredRole: Extract<Role, "doctor" | "admin"> }) => {
  const [session, setLocalSession] = useState<RouteSession>("loading");

  useEffect(() => {
    let cancelled = false;
    getSessionAsync()
      .then((currentSession) => {
        if (cancelled) return;
        if (currentSession) setSession(currentSession);
        setLocalSession(currentSession);
      })
      .catch((error: unknown) => {
        console.error("Unable to verify staff session:", error);
        if (!cancelled) setLocalSession(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (session === "loading") return <LoadingScreen label="Verifying staff access..." />;
  if (!session) return <Navigate to="/" replace />;
  if (session.role !== requiredRole) return <Navigate to={roleHome[session.role]} replace />;

  return (
    <StaffMfaGate>
      <Outlet />
    </StaffMfaGate>
  );
};
