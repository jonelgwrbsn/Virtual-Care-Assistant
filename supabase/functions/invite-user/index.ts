import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const invitationLifetimeMs = 7 * 24 * 60 * 60 * 1000;

interface InvitationRecord {
  id: string;
  auth_user_id: string | null;
  email: string;
  full_name: string;
  role: "patient" | "doctor" | "admin";
  status: "pending" | "accepted" | "revoked" | "expired";
  invited_at: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
}

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function getSiteUrl(): string | null {
  const value = Deno.env.get("APP_SITE_URL")?.trim();
  if (!value) return null;

  try {
    const url = new URL(value);
    const isLocalUrl = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol !== "https:" && !(isLocalUrl && url.protocol === "http:")) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function normalizeRole(value: unknown): InvitationRecord["role"] | null {
  return value === "patient" || value === "doctor" || value === "admin" ? value : null;
}

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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const authorization = request.headers.get("Authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    return jsonResponse(401, { error: "Sign in as an administrator to manage invitations." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const siteUrl = getSiteUrl();
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !siteUrl) {
    console.error("Invite function is missing required server configuration.");
    return jsonResponse(500, {
      error: "Invitations are not configured. Ask your system administrator to check the function settings.",
    });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) {
    return jsonResponse(401, { error: "Your session is invalid or expired. Sign in again." });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: "Request body must be valid JSON." });
  }
  if (!body || typeof body !== "object") {
    return jsonResponse(400, { error: "Invalid invitation request." });
  }

  const requestBody = body as Record<string, unknown>;
  const action = requestBody.action ?? "invite";
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (action === "validate") {
    const { data: invitation, error } = await adminClient
      .from("admin_invitations")
      .select("id, email, full_name, role, status, expires_at")
      .eq("auth_user_id", authData.user.id)
      .in("status", ["pending", "accepted"])
      .maybeSingle();
    if (error) {
      console.error("Unable to validate invitation:", error.message);
      return jsonResponse(500, { error: "Unable to validate this invitation." });
    }
    if (!invitation) return jsonResponse(404, { error: "No pending invitation was found for this account." });
    if (invitation.status === "pending" && new Date(invitation.expires_at).getTime() <= Date.now()) {
      const { error: expireError } = await adminClient
        .from("admin_invitations")
        .update({ status: "expired" })
        .eq("id", invitation.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();
      if (expireError) {
        console.error("Unable to expire invitation:", expireError.message);
        return jsonResponse(500, { error: "Unable to update this expired invitation." });
      }
      return jsonResponse(410, { error: "This invitation has expired. Ask an administrator for a new one." });
    }
    return jsonResponse(200, {
      invitation: { email: invitation.email, full_name: invitation.full_name, role: invitation.role },
    });
  }

  if (getVerifiedAssuranceLevel(token) !== "aal2") {
    return jsonResponse(403, { error: "Complete multi-factor authentication before managing invitations." });
  }

  const { data: profile, error: profileError } = await userClient
    .from("profiles")
    .select("role, is_active, email")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (profileError) {
    console.error("Unable to verify inviter profile:", profileError.message);
    return jsonResponse(403, { error: "Unable to verify administrator permissions." });
  }
  if (profile?.role !== "admin" || profile.is_active !== true) {
    return jsonResponse(403, { error: "Only active administrators can manage invitations." });
  }

  const audit = async (actionName: string, invitationId: string, email: string) => {
    const { error } = await adminClient.from("audit_log").insert({
      actor_id: authData.user.id,
      actor_email: authData.user.email ?? profile.email,
      action: actionName,
      entity: "admin_invitation",
      entity_id: invitationId,
      details: { email },
    });
    if (error) {
      console.error("Invitation changed but its audit entry could not be recorded:", error.message);
      return false;
    }
    return true;
  };

  if (action === "list") {
    const { error: expiryError } = await adminClient
      .from("admin_invitations")
      .update({ status: "expired" })
      .eq("status", "pending")
      .lte("expires_at", new Date().toISOString());
    if (expiryError) {
      console.error("Unable to expire stale invitations:", expiryError.message);
      return jsonResponse(500, { error: "Unable to load invitation status." });
    }

    const { data, error } = await adminClient
      .from("admin_invitations")
      .select("id, email, full_name, role, status, invited_at, expires_at, accepted_at, revoked_at")
      .order("invited_at", { ascending: false })
      .limit(100);
    if (error) {
      console.error("Unable to list invitations:", error.message);
      return jsonResponse(500, { error: "Unable to load invitation status." });
    }
    return jsonResponse(200, { invitations: data ?? [] });
  }

  const issueInvitation = async (input: {
    email: string;
    fullName: string;
    role: InvitationRecord["role"];
    auditAction?: string;
  }): Promise<{ userId: string } | { response: Response }> => {
    const { data: invitation, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      input.email,
      {
        data: { full_name: input.fullName },
        redirectTo: `${siteUrl}/accept-invite`,
      },
    );
    if (inviteError || !invitation.user) {
      console.error("Unable to send user invitation:", inviteError?.message ?? "No invited user returned.");
      return {
        response: jsonResponse(400, {
          error: "Unable to send invitation. The address may already have an account, or email delivery may be unavailable.",
        }),
      };
    }

    const userId = invitation.user.id;
    const { error: metadataError } = await adminClient.auth.admin.updateUserById(userId, {
      app_metadata: { ...invitation.user.app_metadata, role: input.role },
    });
    const { data: profileUpdate, error: roleError } = await adminClient
      .from("profiles")
      .update({ full_name: input.fullName, role: input.role })
      .eq("id", userId)
      .select("id")
      .maybeSingle();

    if (metadataError || roleError || !profileUpdate) {
      console.error(
        "Unable to assign invited user role:",
        metadataError?.message ?? roleError?.message ?? "Profile was not created.",
      );
      const { error: cleanupError } = await adminClient.auth.admin.deleteUser(userId);
      if (cleanupError) console.error("Unable to remove partially provisioned account:", cleanupError.message);
      return {
        response: jsonResponse(500, {
          error: "The account could not be provisioned. Ask an administrator to review the invitation.",
        }),
      };
    }

    const now = new Date();
    const { data: savedInvitation, error: recordError } = await adminClient.from("admin_invitations").insert({
      auth_user_id: userId,
      email: input.email,
      full_name: input.fullName,
      role: input.role,
      status: "pending",
      invited_by: authData.user.id,
      invited_at: now.toISOString(),
      expires_at: new Date(now.getTime() + invitationLifetimeMs).toISOString(),
    }).select("id").single();

    if (recordError) {
      console.error("Unable to persist invitation record:", recordError.message);
      const { error: cleanupError } = await adminClient.auth.admin.deleteUser(userId);
      if (cleanupError) console.error("Unable to remove untracked invited account:", cleanupError.message);
      return {
        response: jsonResponse(500, {
          error: "The invitation could not be recorded. Ask an administrator to review the invitation.",
        }),
      };
    }

    if (!await audit(input.auditAction ?? "invited", savedInvitation.id, input.email)) {
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
      if (deleteError) console.error("Unable to roll back unaudited invited account:", deleteError.message);
      const { error: revokeError } = await adminClient
        .from("admin_invitations")
        .update({ status: "revoked", revoked_at: new Date().toISOString() })
        .eq("auth_user_id", userId)
        .eq("status", "pending");
      if (revokeError) console.error("Unable to revoke unaudited invitation:", revokeError.message);
      return {
        response: jsonResponse(500, {
          error: "The invitation was sent but could not be audited, so it was invalidated. Review the audit service before retrying.",
        }),
      };
    }

    return { userId };
  };

  if (action === "invite") {
    const { email, full_name: fullName } = requestBody;
    const role = normalizeRole(requestBody.role);
    if (typeof email !== "string" || email.trim().length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return jsonResponse(400, { error: "Enter a valid email address." });
    }
    if (typeof fullName !== "string" || !fullName.trim() || fullName.trim().length > 120) {
      return jsonResponse(400, { error: "Enter a name up to 120 characters." });
    }
    if (!role) {
      return jsonResponse(400, { error: "Choose a valid account role." });
    }

    const result = await issueInvitation({
      email: email.trim().toLowerCase(),
      fullName: fullName.trim(),
      role,
    });
    if ("response" in result) return result.response;
    return jsonResponse(200, { invited: true });
  }

  if (action !== "resend" && action !== "revoke") {
    return jsonResponse(400, { error: "Choose a valid invitation action." });
  }

  const invitationId = requestBody.invitation_id;
  if (typeof invitationId !== "string" || !/^[0-9a-f-]{36}$/i.test(invitationId)) {
    return jsonResponse(400, { error: "A valid invitation ID is required." });
  }

  const { data: existing, error: existingError } = await adminClient
    .from("admin_invitations")
    .select("id, auth_user_id, email, full_name, role, status, expires_at")
    .eq("id", invitationId)
    .maybeSingle();
  if (existingError) {
    console.error("Unable to load invitation:", existingError.message);
    return jsonResponse(500, { error: "Unable to load this invitation." });
  }
  if (!existing) return jsonResponse(404, { error: "Invitation not found." });
  if (existing.status !== "pending" && !(action === "resend" && existing.status === "expired")) {
    return jsonResponse(409, { error: `This invitation is already ${existing.status}.` });
  }
  let wasExpired = existing.status === "expired";
  if (existing.status === "pending" && new Date(existing.expires_at).getTime() <= Date.now()) {
    const { data: expiredInvitation, error } = await adminClient
      .from("admin_invitations")
      .update({ status: "expired" })
      .eq("id", existing.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (error) console.error("Unable to mark invitation expired:", error.message);
    if (error) return jsonResponse(500, { error: "Unable to update this expired invitation." });
    if (!expiredInvitation) {
      return jsonResponse(409, { error: "This invitation has already been accepted or changed." });
    }
    wasExpired = true;
    if (action === "revoke") {
      return jsonResponse(410, { error: "This invitation has expired. It cannot be revoked again." });
    }
  }
  if (!existing.auth_user_id) {
    if (action === "resend" && wasExpired) {
      const replacement = await issueInvitation({
        email: existing.email,
        fullName: existing.full_name,
        role: existing.role,
        auditAction: "invitation_resent",
      });
      if ("response" in replacement) return replacement.response;
      return jsonResponse(200, { resent: true });
    }
    return jsonResponse(409, { error: "This invitation no longer has an active account. Create a new invitation." });
  }

  const { data: invitedUser, error: invitedUserError } =
    await adminClient.auth.admin.getUserById(existing.auth_user_id);
  if (invitedUserError || !invitedUser.user) {
    console.error("Unable to verify invitee status:", invitedUserError?.message ?? "User not found.");
    return jsonResponse(409, { error: "The invitee account could not be verified. Contact an administrator." });
  }
  if (invitedUser.user.confirmed_at) {
    const { error } = await adminClient
      .from("admin_invitations")
      .update({ status: "accepted", accepted_at: invitedUser.user.confirmed_at })
      .eq("id", existing.id)
      .in("status", ["pending", "expired"]);
    if (error) console.error("Unable to sync accepted invitation:", error.message);
    return jsonResponse(409, { error: "This invitation has already been accepted." });
  }

  if (action === "revoke") {
    const { data: updatedInvitation, error: updateError } = await adminClient
      .from("admin_invitations")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", existing.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (updateError) {
      console.error("Unable to mark invitation revoked:", updateError.message);
      return jsonResponse(500, { error: "Unable to revoke this invitation." });
    }
    if (!updatedInvitation) {
      return jsonResponse(409, { error: "This invitation was accepted or changed before it could be revoked." });
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(existing.auth_user_id);
    if (deleteError) {
      console.error("Unable to remove revoked invitee account:", deleteError.message);
      const { error: restoreError } = await adminClient
        .from("admin_invitations")
        .update({ status: "pending", revoked_at: null })
        .eq("id", existing.id)
        .eq("status", "revoked");
      if (restoreError) console.error("Unable to restore invitation state:", restoreError.message);
      return jsonResponse(500, { error: "The invitation could not be revoked. Contact an administrator." });
    }

    if (!await audit("invitation_revoked", existing.id, existing.email)) {
      return jsonResponse(500, { error: "The invitation was revoked, but the audit record could not be saved." });
    }
    return jsonResponse(200, { revoked: true });
  }

  const { data: revokedInvitation, error: revokeError } = await adminClient
    .from("admin_invitations")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", existing.id)
    .eq("status", wasExpired ? "expired" : "pending")
    .select("id")
    .maybeSingle();
  if (revokeError) {
    console.error("Unable to rotate invitation:", revokeError.message);
    return jsonResponse(500, { error: "Unable to rotate this invitation." });
  }
  if (!revokedInvitation) {
    return jsonResponse(409, { error: "This invitation was accepted or changed before it could be resent." });
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(existing.auth_user_id);
  if (deleteError) {
    console.error("Unable to invalidate previous invitation:", deleteError.message);
    const { error: restoreError } = await adminClient
      .from("admin_invitations")
      .update({ status: "pending", revoked_at: null })
      .eq("id", existing.id)
      .eq("status", "revoked");
    if (restoreError) console.error("Unable to restore invitation state:", restoreError.message);
    return jsonResponse(500, { error: "The previous invitation could not be invalidated." });
  }

  const result = await issueInvitation({
    email: existing.email,
    fullName: existing.full_name,
    role: existing.role,
    auditAction: "invitation_resent",
  });
  if ("response" in result) {
    return jsonResponse(500, {
      error: "The previous invitation was invalidated, but a replacement could not be issued. Check invitation service status before retrying.",
    });
  }
  return jsonResponse(200, { resent: true });
});
