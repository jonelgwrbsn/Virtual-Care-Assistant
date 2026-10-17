import { DashboardLayout } from "@/components/DashboardLayout";
import { ChatbotInterface } from "@/components/ChatbotInterface";

const PatientChat = () => (
  <DashboardLayout requiredRole="patient">
    <div className="mb-5">
      <h1 className="font-display text-2xl font-bold tracking-tight">Care Chat</h1>
      <p className="text-sm text-muted-foreground">Private, end-to-end secure conversation with your AI care assistant.</p>
    </div>
    <ChatbotInterface />
  </DashboardLayout>
);
export default PatientChat;
