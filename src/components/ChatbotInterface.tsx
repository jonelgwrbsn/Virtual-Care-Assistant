import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Send, X, Bot, Stethoscope, AlertCircle, CheckCircle2, RotateCcw, ShieldAlert, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { saveMessage, getOrCreateConsultation, useChatHistory } from "@/hooks/use-supabase-data";
import { BookAppointmentModal } from "@/components/BookAppointmentModal";

/* ── types ── */
interface Message {
  id: string;
  role: "user" | "ai";
  text: string;
  image?: string;
  outOfScope?: boolean;
  saveFailed?: boolean;
  followUp?: { question: string; quickOptions?: string[] };
  structured?: {
    condition: string;
    confidence: "low" | "moderate" | "high";
    advice: string[];
    recommendation: { level: "monitor" | "consult" | "urgent"; text: string };
    contextNotes?: string[];
    showBookButton?: boolean;
  };
}

interface SymptomContext {
  initial_message?: string;
  duration?: string;
  severity?: number;
}

interface PatientContext {
  allergies?: string | null;
  medical_conditions?: string | null;
  blood_type?: string | null;
  latest_vitals?: {
    heart_rate?: number;
    systolic_bp?: number;
    diastolic_bp?: number;
    spo2?: number;
    body_temp?: number;
  } | null;
}

const quickReplies = [
  "I have a mild headache",
  "Sore throat for 2 days",
  "Skin rash on arm",
  "Persistent cough",
];

/* ── fetch patient profile context ── */
async function fetchPatientContext(patientId: string): Promise<PatientContext> {
  const [profileRes, vitalsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("allergies, medical_conditions, blood_type")
      .eq("id", patientId)
      .single(),
    supabase
      .from("vitals")
      .select("heart_rate, systolic_bp, diastolic_bp, spo2, body_temp")
      .eq("patient_id", patientId)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (profileRes.error) throw profileRes.error;
  if (vitalsRes.error) throw vitalsRes.error;
  return {
    allergies:          profileRes.data?.allergies ?? null,
    medical_conditions: profileRes.data?.medical_conditions ?? null,
    blood_type:         profileRes.data?.blood_type ?? null,
    latest_vitals:      vitalsRes.data ?? null,
  };
}

/* ── call edge function ── */
async function callTriage(
  message: string,
  stage: string,
  symptomContext: SymptomContext,
  patientContext: PatientContext
) {
  const { data, error } = await supabase.functions.invoke("chat-triage", {
    body: { message, stage, symptom_context: symptomContext, patient_context: patientContext },
  });
  if (error) {
    console.error("Triage function error:", error);
    throw new Error(error.message ?? "Triage service unavailable");
  }
  return data;
}

/* ── main component ── */
export const ChatbotInterface = () => {
  const session = getSession();
  const sessionId = session?.id;
  const [consultationId, setConsultationId] = useState<string | null>(null);
  const [messages,    setMessages]    = useState<Message[]>([]);
  const [input,       setInput]       = useState("");
  const [image,       setImage]       = useState<string | null>(null);
  const [thinking,    setThinking]    = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [bookOpen,    setBookOpen]    = useState(false);
  const [patientContextError, setPatientContextError] = useState<string | null>(null);
  const [consultationError, setConsultationError] = useState<string | null>(null);

  // Conversation state
  const [stage,          setStage]          = useState<string>("initial");
  const [symptomContext, setSymptomContext]  = useState<SymptomContext>({});
  const [patientContext, setPatientContext]  = useState<PatientContext>({});

  const fileRef   = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load patient context on mount
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    fetchPatientContext(sessionId)
      .then(context => {
        if (cancelled) return;
        setPatientContext(context);
        setPatientContextError(null);
      })
      .catch((error: unknown) => {
        console.error("Unable to load patient context:", error);
        if (!cancelled) setPatientContextError("Saved health details could not be loaded. Include relevant medical history in your message.");
      });
    return () => { cancelled = true; };
  }, [sessionId]);

  // Load or create today's consultation
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    getOrCreateConsultation(sessionId)
      .then(id => {
        if (cancelled) return;
        setConsultationId(id);
        setConsultationError(null);
      })
      .catch((error: unknown) => {
        console.error("Unable to load consultation history:", error);
        if (!cancelled) {
          setConsultationId(null);
          setConsultationError("Conversation history is unavailable. New messages will retry saving.");
        }
      });
    return () => { cancelled = true; };
  }, [sessionId]);

  const { data: history, error: historyError } = useChatHistory(consultationId);

  const saveChatMessage = async (
    messageId: string,
    senderId: string,
    content: string,
  ) => {
    try {
      let activeConsultationId = consultationId;
      if (!activeConsultationId && session) {
        activeConsultationId = await getOrCreateConsultation(session.id);
        setConsultationId(activeConsultationId);
      }
      if (!activeConsultationId) throw new Error("Conversation is not ready to save.");
      await saveMessage(activeConsultationId, senderId, content);
      setConsultationError(null);
      setMessages(current => current.map(message =>
        message.id === messageId ? { ...message, saveFailed: false } : message
      ));
    } catch (error) {
      console.error("Unable to save chat message:", error);
      setMessages(current => current.map(message =>
        message.id === messageId ? { ...message, saveFailed: true } : message
      ));
    }
  };

  // Seed from DB history
  useEffect(() => {
    if (!history || initialized) return;
    if (history.length > 0) {
      setMessages(history.map((m: any) => ({
        id: m.id,
        role: m.role === "user" ? "user" : "ai",
        text: m.content,
      })));
    } else {
      const greeting = patientContext.medical_conditions
        ? `Hello! I'm your virtual care assistant. I can see you have existing conditions on file — I'll take those into account. What are you feeling today?`
        : "Hello, I'm your virtual care assistant. Tell me what you're feeling today, or upload a photo of any visible symptom.";
      setMessages([{ id: "welcome", role: "ai", text: greeting }]);
    }
    setInitialized(true);
  }, [history, initialized, patientContext.medical_conditions]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(f);
  };

  const send = async (text?: string) => {
    if (thinking) return;
    const content = (text ?? input).trim();
    if (!content && !image) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      text: content || "(image attached)",
      image: image ?? undefined,
    };
    setMessages(m => [...m, userMsg]);
    setInput("");
    setImage(null);
    setThinking(true);

    if (session) void saveChatMessage(userMsg.id, session.id, userMsg.text);

    // Build updated symptom context based on current stage
    let updatedContext = { ...symptomContext };
    if (stage === "initial") {
      updatedContext = { initial_message: content };
    } else if (stage === "followup_duration") {
      updatedContext = { ...symptomContext, duration: content };
    } else if (stage === "followup_severity") {
      const num = parseInt(content.match(/\d+/)?.[0] ?? "5");
      updatedContext = { ...symptomContext, severity: num };
    }
    setSymptomContext(updatedContext);

    try {
      const result = await callTriage(content, stage, updatedContext, patientContext);

      if (result.out_of_scope) {
        const aiMsg: Message = {
          id: crypto.randomUUID(),
          role: "ai",
          text: result.message ?? "I can only help with health and symptom-related questions.",
          outOfScope: true,
        };
        setMessages(m => [...m, aiMsg]);
        setStage("initial");
        setSymptomContext({});
        return;
      }

      // Follow-up question
      if (result.follow_up) {
        const aiMsg: Message = {
          id: crypto.randomUUID(),
          role: "ai",
          text: result.question,
          followUp: { question: result.question, quickOptions: result.quick_options },
        };
        setMessages(m => [...m, aiMsg]);
        setStage(result.stage);
        return;
      }

      // Final assessment
      const showBook = result.recommendation_level === "consult" || result.recommendation_level === "urgent";
      const structured: Message["structured"] = {
        condition:      result.condition,
        confidence:     result.confidence as "low" | "moderate" | "high",
        advice:         result.advice,
        recommendation: { level: result.recommendation_level, text: result.recommendation_text },
        contextNotes:   result.context_notes ?? [],
        showBookButton: showBook,
      };

      const aiText = "Based on everything you've shared, here's my assessment:";
      const aiMsg: Message = { id: crypto.randomUUID(), role: "ai", text: aiText, structured };
      setMessages(m => [...m, aiMsg]);
      setStage("initial");
      setSymptomContext({});

    } catch (err: any) {
      console.error("Triage error:", err);
      setMessages(m => [...m, {
        id: crypto.randomUUID(),
        role: "ai",
        text: "Sorry, I'm having trouble connecting right now. Please try again in a moment.",
      }]);
      setStage("initial");
    } finally {
      setThinking(false);
    }
  };

  const startNew = () => {
    setMessages([{ id: "welcome-new", role: "ai", text: "Starting a new conversation. Tell me what you're feeling today." }]);
    setConsultationId(null);
    setInitialized(false);
    setStage("initial");
    setSymptomContext({});
    if (session) getOrCreateConsultation(session.id).then(setConsultationId).catch(() => {});
  };

  // Get quick options from the last AI follow-up message
  const lastAiMsg = [...messages].reverse().find(m => m.role === "ai");
  const currentQuickOptions = lastAiMsg?.followUp?.quickOptions;
  const showInitialReplies = messages.length <= 2 && stage === "initial";

  return (
    <>
      <BookAppointmentModal open={bookOpen} onClose={() => setBookOpen(false)} />

      <div className="flex h-[calc(100dvh-9rem)] flex-col rounded-2xl border border-border/60 bg-card/70 shadow-card backdrop-blur">
        {/* header */}
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground animate-pulse-ring">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 font-semibold">
                Care Assistant
                <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-success">Online</span>
              </div>
              <div className="text-xs text-muted-foreground">AI triage · Your messages are saved; replies stay in this session</div>
              {(patientContextError || consultationError || historyError) && (
                <p role="alert" className="mt-1 max-w-md text-xs text-warning">
                  {patientContextError ?? consultationError ?? `Couldn’t load conversation history: ${historyError}`}
                </p>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" className="hidden gap-1.5 text-xs sm:flex" onClick={startNew}>
            <RotateCcw className="h-3.5 w-3.5 text-primary" /> New conversation
          </Button>
        </div>

        {/* messages */}
        <div ref={scrollRef} className="scrollbar-thin flex-1 space-y-5 overflow-y-auto px-4 py-6 sm:px-8">
          <div aria-live="polite" aria-relevant="additions text" aria-busy={thinking}>
            {messages.map(m => (
              <MessageBubble
                key={m.id}
                message={m}
                onBook={() => setBookOpen(true)}
                onRetry={() => {
                  if (session && m.role === "user") void saveChatMessage(m.id, session.id, m.text);
                }}
              />
            ))}
            {thinking && <TypingBubble />}
          </div>
        </div>

        {/* quick replies — initial or follow-up options */}
        {(showInitialReplies || currentQuickOptions) && !thinking && (
          <div className="flex flex-wrap gap-2 px-4 pb-3 sm:px-8">
            {(currentQuickOptions ?? quickReplies).map(q => (
              <button
                key={q}
                onClick={() => send(q)}
                className="rounded-full border border-border bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground/80 transition-all hover:border-primary/40 hover:bg-accent hover:text-primary hover:scale-[1.02]"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* image preview */}
        {image && (
          <div className="px-4 pb-2 sm:px-8 animate-fade-in">
            <div className="relative inline-block">
              <img src={image} alt="upload preview" className="h-20 w-20 rounded-lg object-cover ring-2 ring-primary/30" />
              <button type="button" aria-label="Remove attached image" onClick={() => setImage(null)} className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground shadow-soft hover:scale-110 transition-transform">
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}

        {/* composer */}
        <div className="border-t border-border/60 p-3 sm:p-4">
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-background p-2 shadow-soft transition-all focus-within:border-primary/50 focus-within:shadow-glow">
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPick} />
            <Button type="button" variant="ghost" size="icon" aria-label="Attach an image" disabled={thinking} onClick={() => fileRef.current?.click()} className="text-muted-foreground hover:text-primary">
              <ImageIcon className="h-5 w-5" />
            </Button>
            <textarea
              value={input}
              aria-label="Describe your symptoms"
              disabled={thinking}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              rows={1}
              placeholder={stage === "followup_duration" ? "e.g. Just started today, 3 days..." : stage === "followup_severity" ? "e.g. 6, or type a number 1-10..." : "Describe your symptoms..."}
              className="flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
            />
            <Button onClick={() => send()} disabled={thinking || (!input.trim() && !image)} className="h-10 gap-1.5 bg-gradient-primary text-primary-foreground hover:shadow-glow disabled:opacity-50">
              <Send className="h-4 w-4" /> <span className="hidden sm:inline">Send</span>
            </Button>
          </div>
          <p className="mt-2 px-2 text-[10px] text-muted-foreground">
            For emergencies, call your local emergency number. This assistant does not replace professional care.
          </p>
        </div>
      </div>
    </>
  );
};

/* ── message bubble ── */
const MessageBubble = ({ message, onBook, onRetry }: { message: Message; onBook: () => void; onRetry: () => void }) => {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex items-end gap-2.5 animate-fade-in", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow-soft">
          <Bot className="h-4 w-4" />
        </div>
      )}
      <div className="max-w-[80%] sm:max-w-[70%] space-y-2">
        {message.outOfScope ? (
          <div className="flex items-start gap-2.5 rounded-2xl rounded-bl-sm border border-warning/30 bg-warning/5 px-4 py-3 text-sm shadow-soft">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p className="text-foreground/80">{message.text}</p>
          </div>
        ) : (
          <div className={cn(
            "rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-soft",
            isUser
              ? "bg-gradient-primary text-primary-foreground rounded-br-sm"
              : "bg-card border border-border/60 rounded-bl-sm"
          )}>
            {message.image && <img src={message.image} alt="upload" className="mb-2 max-h-48 rounded-lg object-cover" />}
            <p>{message.text}</p>
          </div>
        )}
        {message.structured && <StructuredCard data={message.structured} onBook={onBook} />}
        {message.saveFailed && (
          <div className="flex items-center gap-2 text-xs text-destructive" role="alert">
            <span>Couldn’t save this message to your history.</span>
            <button type="button" onClick={onRetry} className="font-semibold underline underline-offset-2">
              Retry
            </button>
          </div>
        )}
      </div>
      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground text-xs font-bold">
          You
        </div>
      )}
    </div>
  );
};

/* ── structured assessment card ── */
const StructuredCard = ({ data, onBook }: { data: NonNullable<Message["structured"]>; onBook: () => void }) => {
  const recColor = {
    monitor: "bg-success/10 text-success border-success/30",
    consult: "bg-warning/10 text-warning border-warning/40",
    urgent:  "bg-destructive/10 text-destructive border-destructive/30",
  }[data.recommendation.level];

  const RecIcon = { monitor: CheckCircle2, consult: Stethoscope, urgent: AlertCircle }[data.recommendation.level];

  return (
    <div className="space-y-2.5 rounded-2xl border border-border/60 bg-card p-4 shadow-soft animate-scale-in">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Possible condition</div>
          <div className="mt-0.5 font-display font-semibold">{data.condition}</div>
        </div>
        <span className="rounded-full bg-accent px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent-foreground">
          {data.confidence} confidence
        </span>
      </div>

      {/* Patient context notes */}
      {data.contextNotes && data.contextNotes.length > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
          {data.contextNotes.map((note, i) => (
            <p key={i} className="text-xs text-primary/80">{note}</p>
          ))}
        </div>
      )}

      <div>
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Care advice</div>
        <ul className="space-y-1.5 text-sm">
          {data.advice.map((a, i) => (
            <li key={i} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span>{a}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className={cn("flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm", recColor)}>
        <RecIcon className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
            Recommendation · {data.recommendation.level}
          </div>
          <div>{data.recommendation.text}</div>
        </div>
      </div>

      {/* Book appointment button */}
      {data.showBookButton && (
        <Button
          onClick={onBook}
          className="w-full bg-gradient-primary text-primary-foreground gap-2 mt-1"
        >
          <Calendar className="h-4 w-4" /> Book appointment with a doctor
        </Button>
      )}
    </div>
  );
};

/* ── typing bubble ── */
const TypingBubble = () => (
  <div className="flex items-end gap-2.5 animate-fade-in">
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground">
      <Bot className="h-4 w-4" />
    </div>
    <div className="rounded-2xl rounded-bl-sm border border-border/60 bg-card px-4 py-3 shadow-soft">
      <div className="flex items-center gap-1.5">
        {[0, 0.15, 0.3].map((d, i) => (
          <span key={i} className="h-2 w-2 rounded-full bg-primary animate-typing" style={{ animationDelay: `${d}s` }} />
        ))}
      </div>
    </div>
  </div>
);
