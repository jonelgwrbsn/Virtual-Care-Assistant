import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, Loader2, MessageCircle, Send } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SectionCard, SectionCardSkeleton } from "@/components/dashboard/Cards";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getSession, Role } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface AppointmentChatMessage {
  id: string;
  appointment_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

interface AppointmentChatDetails {
  id: string;
  scheduled_at: string;
  mode: string;
  status: string;
  patient: { full_name: string } | null;
  doctor: { full_name: string } | null;
}

function firstRelated<T>(relation: T | T[] | null | undefined): T | null {
  return Array.isArray(relation) ? relation[0] ?? null : relation ?? null;
}

export default function AppointmentChat({ requiredRole }: { requiredRole: Extract<Role, "patient" | "doctor"> }) {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const session = getSession();
  const [appointment, setAppointment] = useState<AppointmentChatDetails | null>(null);
  const [messages, setMessages] = useState<AppointmentChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadConversation = useCallback(async () => {
    if (!appointmentId) {
      setError("This appointment chat link is invalid.");
      setLoading(false);
      return;
    }

    try {
      const { data: appointmentRow, error: appointmentError } = await supabase
        .from("appointments")
        .select("id, scheduled_at, mode, status, patient:patient_id(full_name), doctor:doctor_id(full_name)")
        .eq("id", appointmentId)
        .maybeSingle();
      if (appointmentError) throw appointmentError;
      if (!appointmentRow) throw new Error("You don't have access to this appointment.");

      const details: AppointmentChatDetails = {
        ...appointmentRow,
        patient: firstRelated(appointmentRow.patient),
        doctor: firstRelated(appointmentRow.doctor),
      };
      setAppointment(details);
      if (details.mode !== "chat") throw new Error("This appointment is not a chat appointment.");
      if (details.status !== "confirmed") throw new Error("The doctor must approve this appointment before chat is available.");

      const { data, error: messagesError } = await supabase
        .from("appointment_messages")
        .select("id, appointment_id, sender_id, content, created_at")
        .eq("appointment_id", appointmentId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (messagesError) throw messagesError;
      setMessages((data ?? []).reverse());
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load this appointment chat.");
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  useEffect(() => {
    void loadConversation();
    const interval = window.setInterval(() => void loadConversation(), 3000);
    return () => window.clearInterval(interval);
  }, [loadConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !appointmentId || !session || sending) return;
    setSending(true);
    try {
      const { error: sendError } = await supabase.from("appointment_messages").insert({
        appointment_id: appointmentId,
        sender_id: session.id,
        content,
      });
      if (sendError) throw sendError;
      setDraft("");
      await loadConversation();
    } catch (sendError) {
      toast.error(sendError instanceof Error ? sendError.message : "Unable to send your message.");
    } finally {
      setSending(false);
    }
  };

  const otherParticipant = requiredRole === "patient" ? appointment?.doctor : appointment?.patient;
  const backPath = requiredRole === "patient" ? "/patient/appointments" : "/doctor";

  return (
    <DashboardLayout requiredRole={requiredRole}>
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="mb-3 gap-2 px-0">
          <Link to={backPath}><ArrowLeft className="h-4 w-4" /> Back to {requiredRole === "patient" ? "appointments" : "queue"}</Link>
        </Button>
        <p className="text-sm text-muted-foreground">Private appointment conversation</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {otherParticipant?.full_name ?? "Appointment chat"}
        </h1>
        {appointment && (
          <p className="mt-1 text-sm text-muted-foreground">
            {format(new Date(appointment.scheduled_at), "MMMM d, yyyy 'at' h:mm a")} · Only you and the assigned {requiredRole === "patient" ? "doctor" : "patient"} can access this chat.
          </p>
        )}
      </div>

      {loading ? <SectionCardSkeleton rows={5} /> : (
        <SectionCard title="Appointment chat">
          {error ? (
            <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : (
            <>
              <div className="mb-4 flex min-h-72 max-h-[55vh] flex-col gap-3 overflow-y-auto rounded-xl bg-muted/30 p-4">
                {messages.length === 0 ? (
                  <div className="m-auto max-w-sm text-center">
                    <MessageCircle className="mx-auto mb-2 h-8 w-8 text-primary/60" />
                    <p className="text-sm font-medium">Your private chat is ready</p>
                    <p className="mt-1 text-xs text-muted-foreground">Send a message to start the conversation with {otherParticipant?.full_name ?? "the other participant"}.</p>
                  </div>
                ) : messages.map(message => {
                  const ownMessage = message.sender_id === session?.id;
                  return (
                    <div key={message.id} className={`flex ${ownMessage ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 sm:max-w-[70%] ${ownMessage ? "bg-primary text-primary-foreground" : "border border-border/60 bg-background"}`}>
                        <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
                        <time className={`mt-1 block text-right text-[10px] ${ownMessage ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                          {format(new Date(message.created_at), "MMM d, h:mm a")}
                        </time>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
              <form onSubmit={sendMessage} className="flex items-end gap-2">
                <Textarea
                  value={draft}
                  onChange={event => setDraft(event.target.value)}
                  placeholder={`Message ${otherParticipant?.full_name ?? "the other participant"}...`}
                  aria-label="Message"
                  maxLength={5000}
                  rows={2}
                  disabled={sending || Boolean(error)}
                  className="min-h-11 resize-y"
                />
                <Button type="submit" disabled={sending || !draft.trim() || Boolean(error)} className="shrink-0 gap-2 bg-gradient-primary text-primary-foreground">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  <span className="sr-only sm:not-sr-only">Send</span>
                </Button>
              </form>
              <p className="mt-2 text-xs text-muted-foreground">Please don’t use this chat for emergencies. For urgent help, contact local emergency services.</p>
            </>
          )}
        </SectionCard>
      )}
    </DashboardLayout>
  );
}
