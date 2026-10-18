import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function getVerifiedAssuranceLevel(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
    const claims = JSON.parse(decoded) as { aal?: unknown };
    return typeof claims.aal === "string" ? claims.aal : null;
  } catch {
    return null;
  }
}

function storagePathFromUrl(value: string, bucket: string): string | null {
  if (!value.startsWith("http")) return value;
  try {
    const pathname = new URL(value).pathname;
    const marker = `/${bucket}/`;
    const markerIndex = pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    return decodeURIComponent(pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." });
  }

  const token = request.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return jsonResponse(401, { error: "Sign in as an administrator to delete an account." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("Delete-user function is missing required server configuration.");
    return jsonResponse(500, { error: "Account deletion is not configured. Contact your system administrator." });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) {
    return jsonResponse(401, { error: "Your session is invalid or expired. Sign in again." });
  }
  if (getVerifiedAssuranceLevel(token) !== "aal2") {
    return jsonResponse(403, { error: "Complete multi-factor authentication before deleting accounts." });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: "Request body must be valid JSON." });
  }
  if (!body || typeof body !== "object" || !("user_id" in body) ||
      typeof body.user_id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.user_id)) {
    return jsonResponse(400, { error: "A valid account ID is required." });
  }
  const targetId = body.user_id;
  if (targetId === authData.user.id) {
    return jsonResponse(400, { error: "You cannot delete your own administrator account here." });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: adminProfile, error: adminProfileError } = await userClient
    .from("profiles")
    .select("role, is_active, email")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (adminProfileError) {
    console.error("Unable to verify deleting administrator:", adminProfileError.message);
    return jsonResponse(403, { error: "Unable to verify administrator permissions." });
  }
  if (adminProfile?.role !== "admin" || adminProfile.is_active !== true) {
    return jsonResponse(403, { error: "Only active administrators can delete accounts." });
  }

  const { data: target, error: targetError } = await adminClient
    .from("profiles")
    .select("id, email, full_name, role, is_active")
    .eq("id", targetId)
    .maybeSingle();
  if (targetError) {
    console.error("Unable to load account for deletion:", targetError.message);
    return jsonResponse(500, { error: "Unable to load the selected account." });
  }
  if (!target) return jsonResponse(404, { error: "The selected account no longer exists." });
  if (target.role !== "patient" && target.role !== "doctor") {
    return jsonResponse(403, { error: "Only patient and doctor accounts can be deleted." });
  }

  const { error: auditError } = await adminClient.from("audit_log").insert({
    actor_id: authData.user.id,
    actor_email: authData.user.email ?? adminProfile.email,
    action: "account_deletion_started",
    entity: "user",
    entity_id: target.id,
    details: { email: target.email, role: target.role },
  });
  if (auditError) {
    console.error("Unable to record account deletion audit event:", auditError.message);
    return jsonResponse(500, { error: "Deletion was stopped because the audit event could not be saved." });
  }

  if (target.is_active) {
    const { data: deactivatedProfile, error: deactivateError } = await adminClient
      .from("profiles")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", target.id)
      .eq("role", target.role)
      .select("id")
      .maybeSingle();
    if (deactivateError) {
      console.error("Unable to disable account before deletion:", deactivateError.message);
      return jsonResponse(500, { error: "Unable to disable the account before deletion." });
    }
    if (!deactivatedProfile) {
      return jsonResponse(409, { error: "The account changed before it could be disabled. Refresh and try again." });
    }
  }

  const pathsByBucket = new Map<string, Set<string>>([
    ["avatars", new Set<string>()],
    ["medical-records", new Set<string>()],
  ]);
  pathsByBucket.get("avatars")?.add(`${target.id}/avatar.jpg`);
  pathsByBucket.get("avatars")?.add(`${target.id}/avatar.png`);
  pathsByBucket.get("avatars")?.add(`${target.id}/avatar.webp`);

  const { data: medicalRecords, error: recordsError } = await adminClient
    .from("medical_records")
    .select("file_url")
    .or(`patient_id.eq.${target.id},uploaded_by.eq.${target.id}`);
  if (recordsError) {
    console.error("Unable to inspect attached medical files:", recordsError.message);
    return jsonResponse(500, {
      error: "The account has been disabled, but linked files could not be inspected. Retry deletion or contact support.",
    });
  }
  for (const record of medicalRecords ?? []) {
    if (typeof record.file_url !== "string" || !record.file_url) continue;
    const path = storagePathFromUrl(record.file_url, "medical-records");
    if (path?.startsWith(`${target.id}/`)) pathsByBucket.get("medical-records")?.add(path);
  }

  const listUserFiles = async (bucket: string): Promise<string[]> => {
    const result: string[] = [];
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await adminClient.storage.from(bucket).list(target.id, {
        limit: pageSize,
        offset,
      });
      if (error) throw error;
      const files = (data ?? []).filter((item) => item.id !== null);
      result.push(...files.map((file) => `${target.id}/${file.name}`));
      if ((data?.length ?? 0) < pageSize) return result;
    }
  };

  try {
    for (const bucket of ["avatars", "medical-records"]) {
      for (const path of await listUserFiles(bucket)) pathsByBucket.get(bucket)?.add(path);
    }
  } catch (error) {
    console.error("Unable to inspect account storage files:", error);
    return jsonResponse(500, {
      error: "The account has been disabled, but storage could not be inspected. Retry deletion or contact support.",
    });
  }

  for (const [bucket, paths] of pathsByBucket) {
    if (paths.size === 0) continue;
    const { error } = await adminClient.storage.from(bucket).remove([...paths]);
    if (error) {
      console.error(`Unable to remove account files from ${bucket}:`, error.message);
      return jsonResponse(500, {
        error: `The account has been disabled, but files in ${bucket} could not all be removed. Retry deletion or contact support.`,
      });
    }
  }

  const { data: authUser, error: authUserError } =
    await adminClient.auth.admin.getUserById(target.id);
  if (authUserError && authUserError.status !== 404) {
    console.error("Unable to verify Auth account before deletion:", authUserError.message);
    return jsonResponse(500, {
      error: "Linked files were removed and the account is disabled, but Auth status could not be verified. Retry deletion.",
    });
  }
  if (authUser?.user) {
    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(target.id);
    if (deleteAuthError) {
      console.error("Unable to delete Auth account:", deleteAuthError.message);
      return jsonResponse(500, {
        error: "Linked files were removed, but the account could not be deleted. It remains disabled; retry deletion or contact support.",
      });
    }
  }

  const { data: deletedData, error: cleanupError } = await adminClient.rpc(
    "admin_delete_patient_or_doctor",
    { _user_id: target.id },
  );
  if (cleanupError) {
    console.error("Auth account was removed but linked database cleanup failed:", cleanupError.message);
    return jsonResponse(500, {
      error: "The sign-in account was deleted, but linked database records could not all be removed. The profile is disabled; retry deletion or contact support.",
    });
  }

  const { error: completionAuditError } = await adminClient.from("audit_log").insert({
    actor_id: authData.user.id,
    actor_email: authData.user.email ?? adminProfile.email,
    action: "account_deleted",
    entity: "user",
    entity_id: target.id,
    details: {
      email: target.email,
      role: target.role,
      cleanup: deletedData,
    },
  });
  if (completionAuditError) {
    console.error("Account was deleted but completion audit could not be recorded:", completionAuditError.message);
    return jsonResponse(500, {
      error: "The account and linked data were deleted, but the completion audit record could not be saved. Contact support.",
    });
  }

  return jsonResponse(200, { deleted: true, cleanup: deletedData });
});
