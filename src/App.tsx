import { Suspense, lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LoadingScreen } from "@/components/LoadingScreen";
import Index from "./pages/Index.tsx";
import { StaffMfaRoute } from "@/components/StaffMfaRoute";

const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const PatientDashboard = lazy(() => import("./pages/PatientDashboard.tsx"));
const PatientChat = lazy(() => import("./pages/PatientChat.tsx"));
const PatientRecords = lazy(() => import("./pages/patient/Records.tsx"));
const PatientVitals = lazy(() => import("./pages/patient/Vitals.tsx"));
const PatientAppointments = lazy(() => import("./pages/patient/Appointments.tsx"));
const PatientIntegrations = lazy(() => import("./pages/patient/Integrations.tsx"));
const DoctorDashboard = lazy(() => import("./pages/DoctorDashboard.tsx"));
const DoctorConsultations = lazy(() => import("./pages/doctor/Consultations.tsx"));
const DoctorPatients = lazy(() => import("./pages/doctor/Patients.tsx"));
const DoctorSchedule = lazy(() => import("./pages/doctor/Schedule.tsx"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard.tsx"));
const AdminUsers = lazy(() => import("./pages/admin/Users.tsx"));
const AdminAppointments = lazy(() => import("./pages/admin/Appointments.tsx"));
const AdminAnalytics = lazy(() => import("./pages/admin/Analytics.tsx"));
const AdminSecurity = lazy(() => import("./pages/admin/Security.tsx"));
const AdminSettings = lazy(() => import("./pages/admin/Settings.tsx"));
const AdminKnowledgeBase = lazy(() => import("./pages/admin/KnowledgeBase.tsx"));
const AdminBroadcasts = lazy(() => import("./pages/admin/Broadcasts.tsx"));
const AdminAuditLog = lazy(() => import("./pages/admin/AuditLog.tsx"));
const Onboarding = lazy(() => import("./pages/Onboarding.tsx"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite.tsx"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-right" />
      <BrowserRouter>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/patient" element={<PatientDashboard />} />
            <Route path="/patient/chat" element={<PatientChat />} />
            <Route path="/patient/records" element={<PatientRecords />} />
            <Route path="/patient/vitals" element={<PatientVitals />} />
            <Route path="/patient/appointments" element={<PatientAppointments />} />
            <Route path="/patient/integrations" element={<PatientIntegrations />} />
            <Route element={<StaffMfaRoute requiredRole="doctor" />}>
              <Route path="/doctor" element={<DoctorDashboard />} />
              <Route path="/doctor/consultations" element={<DoctorConsultations />} />
              <Route path="/doctor/patients" element={<DoctorPatients />} />
              <Route path="/doctor/schedule" element={<DoctorSchedule />} />
            </Route>
            <Route element={<StaffMfaRoute requiredRole="admin" />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/appointments" element={<AdminAppointments />} />
              <Route path="/admin/analytics" element={<AdminAnalytics />} />
              <Route path="/admin/security" element={<AdminSecurity />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
              <Route path="/admin/knowledge-base" element={<AdminKnowledgeBase />} />
              <Route path="/admin/broadcasts" element={<AdminBroadcasts />} />
              <Route path="/admin/audit-log" element={<AdminAuditLog />} />
            </Route>
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/accept-invite" element={<AcceptInvite />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
