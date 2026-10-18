# Supabase security deployment notes

## Browser configuration

Copy `.env.example` to `.env.local` and set the project's URL and publishable
key before running the application. Values prefixed with `VITE_` are embedded
in the browser bundle and are public; never put a service-role key or other
server secret in them. The application rejects missing configuration and
non-HTTPS Supabase URLs (except local development URLs).

## Admin invitations

The browser must never receive the Supabase service-role key. The `invite-user`
Edge Function verifies the caller's access token, checks that the caller is an
active admin with AAL2, sends the invitation, and assigns the role using the
service-role key. Deploy it before enabling staff invitations:

```powershell
supabase functions deploy invite-user
```

The hosted function needs `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` in its server environment. Set the server-only
`APP_SITE_URL` function secret to the HTTPS origin of the deployed application.
Configure Supabase Auth's Site URL and allowed redirect URLs to include
`https://<your-app-host>/accept-invite`, and ensure invitation emails are
configured with a confirmation link that returns to the supplied redirect URL.
The invitation record expires after seven days; configure Supabase Auth's email
link expiry to no more than seven days as well. Bootstrap the first admin
through a trusted Supabase administrative process; never grant the role through
client metadata or a public registration page.

The lifecycle migration `migrations/20261019000000_admin_invitation_lifecycle.sql`
creates the service-role-only invitation ledger and marks a pending invitation
accepted when its Auth user confirms the email link. Apply the reviewed RLS/MFA
migrations first, then this invitation migration, before deploying the updated
Edge Function and frontend. The function supports admin+AAL2 invite/list/resend/
revoke operations, expires pending records, and writes invitation events to
`audit_log`. Resend/revoke invalidates the previous unconfirmed Auth user; it
never deletes an account that has confirmed its email. Do not deploy the updated
function before the migration exists. Validate the complete email redirect,
password setup, expiry, resend, revoke, and audit behavior on staging first.

## Admin account deletion

The admin Users screen's delete action is permanent and limited to patient and
doctor accounts. It requires an active admin session at AAL2 and typing
`DELETE` in the confirmation dialog. The `delete-user` Edge Function records an
audit event, disables the target first, removes their avatar and linked medical
files from Storage, deletes the Auth identity, then calls
`admin_delete_patient_or_doctor` to remove linked profile, appointments,
consultations, messages, patient vitals/preferences, authored/owned medical
records, and invitation records. It removes files in the account's own
`avatars` and `medical-records` Storage folders. Audit history is intentionally
retained.

Apply `migrations/20261019010000_admin_delete_patient_doctor.sql` before
deploying `delete-user` or the updated frontend. The function is transactional
for relational cleanup; Storage and Auth operations are external services and
cannot share a PostgreSQL transaction. If an external step fails, the function
reports the partial state and keeps the account disabled so an administrator
can retry. Verify cleanup behavior on staging with both patient and doctor
accounts, including uploaded files and associated consultations, before
production use. Permanent deletion may conflict with healthcare retention
requirements; obtain the appropriate records/privacy approval first.

## RLS hardening migration

`migrations/20261017000000_harden_patient_data_rls.sql` replaces the existing
policies on the eleven application tables, hardens profile role assignment,
and scopes medical-record storage access. It has been prepared locally only;
it has **not** been applied to Supabase. It drops all existing policies on
those eleven tables before creating the replacement set, so review it against
the target project's current policies and schema before applying it, preferably
to a staging project first. Do not apply it to production without a backup and
explicit approval.

`migrations/20261018000000_enforce_staff_mfa_and_audit_actor.sql` reapplies the
staff AAL2 requirement and binds browser-written audit actor emails to the
authenticated user's profile. Apply it after the RLS hardening migration and
test both changes on staging.

The policies use active `profiles.role` values, never user-editable
`user_metadata`, for authorization. New Auth users are always patients.
When applied, the hardened role helper requires an `aal2` Supabase Auth token
for administrator and doctor access. The app prompts staff to enroll or verify
a TOTP factor before showing staff pages, but the database check is the
authorization boundary; test it with both `aal1` and `aal2` tokens on staging.
Doctors can see patient profile rows associated with pending, confirmed, or
completed appointments; access to vitals, medical records, and their files
requires a confirmed/completed appointment or an assigned live/completed
consultation. This relationship model follows the app's current appointment
and consultation data; confirm that it matches clinic policy before deployment.

The migration makes `medical-records` private. Patient uploads use a folder
named with the patient's auth user ID, and the patient records UI already uses
short-lived signed URLs. Avatar objects remain publicly readable because the
app renders their public URLs; do not store sensitive information in avatars.

Browser clients can now persist only patient-authored chat messages. AI replies
are not persisted until the triage service is updated to save them through a
trusted server-side path; do not restore client-side assistant inserts or
`NULL` sender exceptions.

Before using real patient data:

- Apply and test this migration on staging with patient, doctor, admin, and
  inactive accounts. Verify cross-patient reads/writes are denied and authorized
  appointment/consultation flows still work.
- Confirm the target schema has the columns referenced by the migration and
  compare the current policies to the supplied policy export. The migration
  replaces all policies on its eleven application tables.
- Verify the `medical-records` bucket is private and signed URL access is
  limited to authorized patients, care-team doctors, and active admins.
- Review database grants, Auth MFA requirements for staff sessions, audit
  logging, backups, and the edge-function deployment separately.

The app now gates doctor and administrator routes behind TOTP verification.
Database access is also intended to require AAL2 through the hardened role
helper, but that protection is not active until the migration is reviewed and
applied to the target Supabase project. Test both the app route and direct
database access on staging. The invitation Edge Function independently checks
MFA (AAL2). The admin audit screen shows app-recorded administrator actions;
it is not a Supabase Auth sign-in or failed-login event feed. Compliance labels
remain not assessed; a qualified review is still required before making
compliance claims.
