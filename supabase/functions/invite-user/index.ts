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

Deno.serve(async request => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const authorization = request.headers.get("Authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    return jsonResponse(401, { error: "Sign in as an administrator to send invitations." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("Invite function is missing required Supabase environment configuration.");
    return jsonResponse(500, { error: "Invitations are not configured. Contact your system administrator." });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) {
    return jsonResponse(401, { error: "Your session is invalid or expired. Sign in again." });
  }

  const { data: assurance, error: assuranceError } =
    await userClient.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError) {
    console.error("Unable to verify administrator MFA assurance:", assuranceError.message);
    return jsonResponse(403, { error: "Could not verify administrator MFA. Contact your system administrator." });
  }
  if (assurance.currentLevel !== "aal2") {
    return jsonResponse(403, { error: "Complete multi-factor authentication before inviting users." });
  }

  const { data: profile, error: profileError } = await userClient
    .from("profiles")
    .select("role, is_active")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (profileError) {
    console.error("Unable to verify inviter profile:", profileError.message);
    return jsonResponse(403, { error: "Unable to verify administrator permissions." });
  }
  if (profile?.role !== "admin" || profile.is_active !== true) {
    return jsonResponse(403, { error: "Only active administrators can invite users." });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: "Request body must be valid JSON." });
  }
  if (!body || typeof body !== "object") {
    return jsonResponse(400, { error: "Invalid invitation details." });
  }

  const { email, full_name, role } = body as Record<string, unknown>;
  if (typeof email !== "string" || email.trim().length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return jsonResponse(400, { error: "Enter a valid email address." });
  }
  if (typeof full_name !== "string" || !full_name.trim() || full_name.trim().length > 120) {
    return jsonResponse(400, { error: "Enter a name up to 120 characters." });
  }
  if (role !== "patient" && role !== "doctor" && role !== "admin") {
    return jsonResponse(400, { error: "Choose a valid account role." });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: invitation, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    email.trim(),
    { data: { full_name: full_name.trim() } },
  );
  if (inviteError || !invitation.user) {
    console.error("Unable to send user invitation:", inviteError?.message ?? "No invited user returned.");
    return jsonResponse(400, { error: "Unable to send invitation. Check the address or try again." });
  }

  const userId = invitation.user.id;
  const { error: metadataError } = await adminClient.auth.admin.updateUserById(userId, {
    app_metadata: { ...invitation.user.app_metadata, role },
  });
  const { data: profileUpdate, error: roleError } = await adminClient
    .from("profiles")
    .update({ full_name: full_name.trim(), role })
    .eq("id", userId)
    .select("id")
    .maybeSingle();

  if (metadataError || roleError || !profileUpdate) {
    console.error("Unable to assign invited user role:", metadataError?.message ?? roleError?.message ?? "Profile was not created.");
    const { error: cleanupError } = await adminClient.auth.admin.deleteUser(userId);
    if (cleanupError) console.error("Unable to remove partially provisioned account:", cleanupError.message);
    return jsonResponse(500, { error: "The account could not be provisioned. Ask an administrator to review the invitation." });
  }

  return jsonResponse(200, { invited: true });
});
