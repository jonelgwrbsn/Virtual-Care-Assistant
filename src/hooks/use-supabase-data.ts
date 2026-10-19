import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns";

// ── generic loader — stable fetcher ref prevents infinite loops ──
function useQuery<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetcherRef.current()
      .then((d) => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(e.message ?? "Unknown error"); setLoading(false); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error };
}

// ── Patient: latest vitals ──────────────────────────────────
export function useLatestVitals(refetchKey = 0) {
  const session = getSession();
  return useQuery(async () => {
    if (!session) return null;
    const { data, error } = await supabase
      .from("vitals")
      .select("*")
      .eq("patient_id", session.id)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  }, [session?.id, refetchKey]);
}

// ── Patient: 7-day vitals history ──────────────────────────
export function useVitalsHistory(refetchKey = 0) {
  const session = getSession();
  return useQuery(async () => {
    if (!session) return [];
    const { data, error } = await supabase
      .from("vitals")
      .select("recorded_at, heart_rate, systolic_bp, diastolic_bp, spo2, body_temp, steps")
      .eq("patient_id", session.id)
      .order("recorded_at", { ascending: true })
      .limit(7);
    if (error) throw error;
    return data ?? [];
  }, [session?.id, refetchKey]);
}

// ── Patient: upcoming + past appointments ──────────────────
export function usePatientAppointments(refetchKey = 0) {
  const session = getSession();
  return useQuery(async () => {
    if (!session) return { upcoming: [], past: [] };
    const { data, error } = await supabase
      .from("appointments")
      .select(`id, scheduled_at, mode, status, notes, doctor:doctor_id ( full_name, email )`)
      .eq("patient_id", session.id)
      .order("scheduled_at", { ascending: true });
    if (error) throw error;
    const now = new Date();
    const upcoming = (data ?? []).filter(
      (a) => new Date(a.scheduled_at) >= now && a.status !== "cancelled"
    );
    const past = (data ?? []).filter(
      (a) => new Date(a.scheduled_at) < now || a.status === "completed"
    );
    return { upcoming, past };
  }, [session?.id, refetchKey]);
}

// ── Patient: medical records ────────────────────────────────
export function usePatientRecords(refetchKey = 0) {
  const session = getSession();
  return useQuery(async () => {
    if (!session) return [];
    const { data, error } = await supabase
      .from("medical_records")
      .select(`id, title, record_type, recorded_date, notes, file_url, uploader:uploaded_by ( full_name )`)
      .eq("patient_id", session.id)
      .order("recorded_date", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }, [session?.id, refetchKey]);
}

// ── Patient: recent consultations (AI assessments) ─────────
export function usePatientConsultations() {
  const session = getSession();
  return useQuery(async () => {
    if (!session) return [];
    const { data, error } = await supabase
      .from("consultations")
      .select("id, status, started_at, summary")
      .eq("patient_id", session.id)
      .order("started_at", { ascending: false })
      .limit(5);
    if (error) throw error;
    return data ?? [];
  }, [session?.id]);
}

// ── Doctor: patient queue — full day window ─────────────────
export function useDoctorQueue(refetchKey = 0) {
  const session = getSession();
  return useQuery(async () => {
    if (!session) return { appointments: [], pendingCount: 0, confirmedTodayCount: 0 };
    const [requestsRes, todayRes] = await Promise.all([
      supabase
        .from("appointments")
        .select(`id, scheduled_at, mode, status, notes, patient:patient_id ( id, full_name, created_at )`, { count: "exact" })
        .eq("doctor_id", session.id)
        .eq("status", "pending")
        .order("scheduled_at", { ascending: true })
        .limit(20),
      supabase
        .from("appointments")
        .select(`id, scheduled_at, mode, status, notes, patient:patient_id ( id, full_name, created_at )`, { count: "exact" })
        .eq("doctor_id", session.id)
        .eq("status", "confirmed")
        .gte("scheduled_at", startOfDay(new Date()).toISOString())
        .lte("scheduled_at", endOfDay(new Date()).toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(20),
    ]);
    if (requestsRes.error) throw requestsRes.error;
    if (todayRes.error) throw todayRes.error;
    return {
      appointments: [...(requestsRes.data ?? []), ...(todayRes.data ?? [])]
        .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()),
      pendingCount: requestsRes.count ?? 0,
      confirmedTodayCount: todayRes.count ?? 0,
    };
  }, [session?.id, refetchKey]);
}

// ── Doctor: live consultations ──────────────────────────────
export function useLiveConsultations(refetchKey = 0) {
  const session = getSession();
  return useQuery(async () => {
    if (!session) return [];
    const { data, error } = await supabase
      .from("consultations")
      .select(`id, status, started_at, patient:patient_id ( id, full_name ), appointment:appointment_id ( id, mode, notes )`)
      .eq("doctor_id", session.id)
      .eq("status", "live")
      .order("started_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }, [session?.id, refetchKey]);
}

// ── Doctor: completed consultations today ──────────────────
export function useCompletedConsultations(refetchKey = 0) {
  const session = getSession();
  return useQuery(async () => {
    if (!session) return [];
    const { data, error } = await supabase
      .from("consultations")
      .select(`id, started_at, ended_at, summary, patient:patient_id ( id, full_name ), appointment:appointment_id ( notes )`)
      .eq("doctor_id", session.id)
      .eq("status", "completed")
      .gte("ended_at", startOfDay(new Date()).toISOString())
      .lte("ended_at", endOfDay(new Date()).toISOString())
      .order("ended_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }, [session?.id, refetchKey]);
}

// ── Doctor: patient AI triage sessions ──────────────────────
export function useDoctorAiConsultations(refetchKey = 0) {
  const session = getSession();
  return useQuery(async () => {
    if (!session) return [];
    const { data, error } = await supabase
      .from("consultations")
      .select("id, started_at, summary, patient:patient_id ( id, full_name )")
      .eq("status", "ai")
      .gte("started_at", startOfDay(new Date()).toISOString())
      .lte("started_at", endOfDay(new Date()).toISOString())
      .order("started_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }, [session?.id, refetchKey]);
}

export function useDoctorDataRefresh() {
  const [refetchKey, setRefetchKey] = useState(0);

  useEffect(() => {
    const refresh = () => setRefetchKey(key => key + 1);
    const channel = supabase
      .channel("doctor-consultation-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "consultations" }, refresh)
      .subscribe();
    const interval = window.setInterval(refresh, 30_000);

    return () => {
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, []);

  return { refetchKey, refresh: () => setRefetchKey(key => key + 1) };
}

// ── Doctor: all patients (deduplicated from appointments) ───
export function useDoctorPatients() {
  const session = getSession();
  return useQuery(async () => {
    if (!session) return [];
    const { data, error } = await supabase
      .from("appointments")
      .select(`patient:patient_id ( id, full_name, created_at, avatar_url ), scheduled_at, status`)
      .eq("doctor_id", session.id)
      .order("scheduled_at", { ascending: false });
    if (error) throw error;
    const seen = new Set<string>();
    const patients: Array<{ id: string; full_name: string; lastVisit: string; lastStatus: string; avatar_url: string | null }> = [];
    for (const row of data ?? []) {
      const p = row.patient?.[0];
      if (!p || seen.has(p.id)) continue;
      seen.add(p.id);
      patients.push({ id: p.id, full_name: p.full_name, lastVisit: row.scheduled_at, lastStatus: row.status, avatar_url: p.avatar_url ?? null });
    }
    return patients;
  }, [session?.id]);
}

// ── Doctor: full-week schedule ──────────────────────────────
export function useDoctorSchedule() {
  const session = getSession();
  return useQuery(async () => {
    if (!session) return [];
    const { data, error } = await supabase
      .from("appointments")
      .select(`id, scheduled_at, mode, status, notes, patient:patient_id ( full_name )`)
      .eq("doctor_id", session.id)
      .gte("scheduled_at", startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString())
      .lte("scheduled_at", endOfWeek(new Date(), { weekStartsOn: 1 }).toISOString())
      .order("scheduled_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  }, [session?.id]);
}

// ── Admin: all users ────────────────────────────────────────
export function useAllUsers(refetchKey = 0) {
  return useQuery(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, created_at, is_active, avatar_url")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }, [refetchKey]);
}

// ── Admin: all appointments ─────────────────────────────────
export function useAllAppointments(refetchKey = 0) {
  return useQuery(async () => {
    const { data, error } = await supabase
      .from("appointments")
      .select(`id, scheduled_at, mode, status, notes, patient:patient_id ( full_name ), doctor:doctor_id ( full_name )`)
      .order("scheduled_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return data ?? [];
  }, [refetchKey]);
}

// ── Admin: platform stats — efficient count-only queries ────
export function useAdminStats(refetchKey = 0) {
  return useQuery(async () => {
    const [patientsRes, doctorsRes, adminsRes, apptsRes, pendingRes, cancelledRes, consultsRes, liveRes] =
      await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "patient"),
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "doctor"),
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "admin"),
        supabase.from("appointments").select("*", { count: "exact", head: true }),
        supabase.from("appointments").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("appointments").select("*", { count: "exact", head: true }).eq("status", "cancelled"),
        supabase.from("consultations").select("*", { count: "exact", head: true }),
        supabase.from("consultations").select("*", { count: "exact", head: true }).eq("status", "live"),
      ]);
    const statsError = [
      patientsRes.error,
      doctorsRes.error,
      adminsRes.error,
      apptsRes.error,
      pendingRes.error,
      cancelledRes.error,
      consultsRes.error,
      liveRes.error,
    ].find(Boolean);
    if (statsError) throw statsError;

    const patients = patientsRes.count ?? 0;
    const doctors  = doctorsRes.count ?? 0;
    const admins   = adminsRes.count ?? 0;
    return {
      totalUsers:       patients + doctors + admins,
      patients, doctors, admins,
      totalAppointments: apptsRes.count ?? 0,
      confirmedAppts:    (apptsRes.count ?? 0) - (pendingRes.count ?? 0) - (cancelledRes.count ?? 0),
      pendingAppts:      pendingRes.count ?? 0,
      cancelledAppts:    cancelledRes.count ?? 0,
      totalConsults:     consultsRes.count ?? 0,
      liveConsults:      liveRes.count ?? 0,
    };
  }, [refetchKey]);
}

// ── Admin: analytics — per-day consultation counts ─────────
export function useAnalyticsData() {
  return useQuery(async () => {
    const { data, error } = await supabase
      .from("consultations")
      .select("started_at, status")
      .gte("started_at", startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString())
      .order("started_at", { ascending: true });
    if (error) throw error;

    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const counts = days.map((day, i) => {
      const dayDate = new Date(startOfWeek(new Date(), { weekStartsOn: 1 }));
      dayDate.setDate(dayDate.getDate() + i);
      const dayStr = dayDate.toDateString();
      const consults = (data ?? []).filter(
        (c) => new Date(c.started_at).toDateString() === dayStr
      ).length;
      return { day, consults };
    });

    // Condition breakdown from medical records
    const { data: records } = await supabase
      .from("medical_records")
      .select("notes, record_type");

    const conditionMap: Record<string, number> = {
      Respiratory: 0, Dermatology: 0, Cardiology: 0, Neurology: 0, Other: 0,
    };
    for (const r of records ?? []) {
      const n = (r.notes ?? "").toLowerCase();
      if (n.includes("respiratory") || n.includes("cough") || n.includes("throat")) conditionMap.Respiratory++;
      else if (n.includes("rash") || n.includes("skin") || n.includes("derm")) conditionMap.Dermatology++;
      else if (n.includes("cardio") || n.includes("bp") || n.includes("hypertension")) conditionMap.Cardiology++;
      else if (n.includes("neuro") || n.includes("headache") || n.includes("nausea")) conditionMap.Neurology++;
      else conditionMap.Other++;
    }
    const conditions = Object.entries(conditionMap)
      .map(([name, value]) => ({ name, value }))
      .filter((c) => c.value > 0);

    return { trend: counts, conditions, totalConsults: data?.length ?? 0 };
  }, []);
}

// ── Admin: update appointment status ───────────────────────
export async function updateAppointmentStatus(id: string, status: string) {
  const { error } = await supabase
    .from("appointments")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function updateDoctorAppointmentStatus(
  id: string,
  status: "confirmed" | "cancelled" | "completed"
) {
  const session = getSession();
  if (!session || session.role !== "doctor") throw new Error("A doctor session is required.");

  const { data, error } = await supabase
    .from("appointments")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("doctor_id", session.id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Appointment not found or no longer assigned to you.");
}

// ── Admin: toggle user active status ───────────────────────
export async function setUserActive(id: string, is_active: boolean) {
  const { data, error } = await supabase.functions.invoke("toggle-user-active", {
    body: { user_id: id, is_active },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

// ── Admin: permanently delete a patient or doctor and linked data ──
export async function deleteUserAccount(id: string) {
  const { data, error } = await supabase.functions.invoke("delete-user", {
    body: { user_id: id },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  if (data?.deleted !== true) throw new Error("The account deletion could not be confirmed.");
  return data.cleanup as {
    deleted_messages: number;
    deleted_medical_records: number;
    deleted_consultations: number;
    deleted_appointments: number;
    deleted_vitals: number;
    deleted_preferences: number;
  };
}

// ── Admin: reassign appointment doctor ─────────────────────
export async function reassignAppointmentDoctor(appointmentId: string, doctorId: string) {
  const { error } = await supabase
    .from("appointments")
    .update({ doctor_id: doctorId, updated_at: new Date().toISOString() })
    .eq("id", appointmentId);
  if (error) throw error;
}

// ── Admin: all doctors (for reassign dropdown) ─────────────
export function useAllDoctors(refetchKey = 0) {
  return useQuery(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "doctor")
      .eq("is_active", true)
      .order("full_name");
    if (error) throw error;
    return data ?? [];
  }, [refetchKey]);
}

// ── Admin: knowledge base ──────────────────────────────────
export function useSymptomKnowledge(refetchKey = 0) {
  return useQuery(async () => {
    const { data, error } = await supabase
      .from("symptom_knowledge")
      .select("id, keywords, condition, confidence, advice, recommendation_level, recommendation_text")
      .order("condition");
    if (error) throw error;
    return data ?? [];
  }, [refetchKey]);
}

export async function upsertSymptomKnowledge(entry: {
  id?: string;
  keywords: string[];
  condition: string;
  confidence: string;
  advice: string[];
  recommendation_level: string;
  recommendation_text: string;
}) {
  const { id, ...fields } = entry;
  if (id) {
    const { error } = await supabase.from("symptom_knowledge").update(fields).eq("id", id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("symptom_knowledge").insert(fields);
    if (error) throw error;
  }
}

export async function deleteSymptomKnowledge(id: string) {
  const { error } = await supabase.from("symptom_knowledge").delete().eq("id", id);
  if (error) throw error;
}

// ── User: broadcasts for current role ─────────────────────
export function useMyBroadcasts() {
  const session = getSession();
  return useQuery(async () => {
    if (!session) return [];
    const { data, error } = await supabase
      .from("broadcast_notifications")
      .select("id, title, message, target_role, created_at")
      .or(`target_role.eq.all,target_role.eq.${session.role}`)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return data ?? [];
  }, [session?.id]);
}
export function useBroadcastNotifications(refetchKey = 0) {
  return useQuery(async () => {
    const { data, error } = await supabase
      .from("broadcast_notifications")
      .select("id, title, message, target_role, created_at, created_by")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return data ?? [];
  }, [refetchKey]);
}

export async function sendBroadcast(createdBy: string, title: string, message: string, target_role: string) {
  const { error } = await supabase.from("broadcast_notifications").insert({
    created_by: createdBy, title, message, target_role,
  });
  if (error) throw error;
}

// ── Admin: full audit log ──────────────────────────────────
export function useAuditLog(refetchKey = 0) {
  return useQuery(async () => {
    const { data, error } = await supabase
      .from("audit_log")
      .select("id, actor_email, action, entity, entity_id, details, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return data ?? [];
  }, [refetchKey]);
}

export async function writeAuditLog(actorId: string, actorEmail: string, action: string, entity: string, entityId?: string, details?: object) {
  const { error } = await supabase.from("audit_log").insert({
    actor_id: actorId,
    actor_email: actorEmail,
    action,
    entity,
    entity_id: entityId,
    details,
  });
  if (error) throw error;
}

// ── Admin: patient full profile ────────────────────────────
export function usePatientProfile(patientId: string | null) {
  return useQuery(async () => {
    if (!patientId) return null;
    const [profileRes, vitalsRes, recordsRes, apptsRes, consultationsRes] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email, role, created_at, is_active, avatar_url, allergies, medical_conditions, blood_type").eq("id", patientId).single(),
      supabase.from("vitals").select("*").eq("patient_id", patientId).order("recorded_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("medical_records").select("id, title, record_type, recorded_date").eq("patient_id", patientId).order("recorded_date", { ascending: false }).limit(5),
      supabase.from("appointments").select("id, scheduled_at, mode, status, doctor:doctor_id(full_name)").eq("patient_id", patientId).order("scheduled_at", { ascending: false }).limit(5),
      supabase.from("consultations").select("id, status, started_at, summary").eq("patient_id", patientId).eq("status", "ai").order("started_at", { ascending: false }).limit(5),
    ]);
    const queryError = [profileRes.error, vitalsRes.error, recordsRes.error, apptsRes.error, consultationsRes.error].find(Boolean);
    if (queryError) throw queryError;
    const consultationIds = (consultationsRes.data ?? []).map(consultation => consultation.id);
    const messagesRes = consultationIds.length > 0
      ? await supabase
        .from("messages")
        .select("id, consultation_id, content, created_at")
        .in("consultation_id", consultationIds)
        .eq("role", "user")
        .order("created_at", { ascending: false })
        .limit(10)
      : { data: [], error: null };
    if (messagesRes.error) throw messagesRes.error;
    return {
      profile: profileRes.data,
      latestVitals: vitalsRes.data,
      records: recordsRes.data ?? [],
      appointments: apptsRes.data ?? [],
      consultations: consultationsRes.data ?? [],
      recentMessages: messagesRes.data ?? [],
    };
  }, [patientId]);
}

// ── Admin: doctor full profile ─────────────────────────────
export function useDoctorProfile(doctorId: string | null) {
  return useQuery(async () => {
    if (!doctorId) return null;
    const [profileRes, apptsRes, consultsRes] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email, role, created_at, is_active, avatar_url").eq("id", doctorId).single(),
      supabase.from("appointments")
        .select("id, scheduled_at, mode, status, patient:patient_id(full_name)")
        .eq("doctor_id", doctorId)
        .order("scheduled_at", { ascending: false })
        .limit(5),
      supabase.from("consultations")
        .select("id, status, started_at, ended_at, summary, patient:patient_id(full_name)")
        .eq("doctor_id", doctorId)
        .order("started_at", { ascending: false })
        .limit(5),
    ]);
    const total   = apptsRes.data?.length ?? 0;
    const completed = apptsRes.data?.filter(a => a.status === "completed").length ?? 0;
    return {
      profile:      profileRes.data,
      appointments: apptsRes.data ?? [],
      consultations: consultsRes.data ?? [],
      stats: { total, completed },
    };
  }, [doctorId]);
}

// ── Patient: integration preferences ───────────────────────
export function useIntegrationPreferences() {
  const session = getSession();
  return useQuery(async () => {
    if (!session) return null;
    const { data, error } = await supabase
      .from("integration_preferences")
      .select("preferred_provider, notify_when_available")
      .eq("patient_id", session.id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }, [session?.id]);
}

export async function upsertIntegrationPreferences(
  patientId: string,
  preferred_provider: string | null,
  notify_when_available: boolean
) {
  const { error } = await supabase
    .from("integration_preferences")
    .upsert(
      { patient_id: patientId, preferred_provider, notify_when_available },
      { onConflict: "patient_id" }
    );
  if (error) throw error;
}

// ── Chat: save message to Supabase ─────────────────────────
export async function saveMessage(consultationId: string, senderId: string, content: string) {
  const { error } = await supabase
    .from("messages")
    .insert({ consultation_id: consultationId, sender_id: senderId, role: "user", content });
  if (error) throw error;
}

// ── Chat: get or create consultation for patient ───────────
export async function getOrCreateConsultation(patientId: string): Promise<string> {
  // Look for an open AI consultation today
  const { data } = await supabase
    .from("consultations")
    .select("id")
    .eq("patient_id", patientId)
    .eq("status", "ai")
    .gte("started_at", startOfDay(new Date()).toISOString())
    .maybeSingle();
  if (data) return data.id;

  // Create a new one
  const { data: created, error } = await supabase
    .from("consultations")
    .insert({ patient_id: patientId, status: "ai" })
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}

// ── Chat: load today's messages for a consultation ─────────
export function useChatHistory(consultationId: string | null) {
  return useQuery(async () => {
    if (!consultationId) return [];
    const { data, error } = await supabase
      .from("messages")
      .select("id, role, content, created_at")
      .eq("consultation_id", consultationId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  }, [consultationId]);
}
