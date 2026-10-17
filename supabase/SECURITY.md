# Supabase security deployment notes

## Admin invitations

The browser must never receive the Supabase service-role key. The `invite-user`
Edge Function verifies the caller's access token, checks that the caller is an
active admin with AAL2, sends the invitation, and assigns the role using the
service-role key. Deploy it before enabling staff invitations:

```powershell
supabase functions deploy invite-user
```

The hosted function needs `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` in its server environment. Configure Supabase Auth's
Site URL and allowed redirect URLs for the deployed application, and ensure
invitation emails are configured. Bootstrap the first admin through a trusted
Supabase administrative process; never grant the role through client metadata
or a public registration page.

## RLS hardening migration

`migrations/20261017000000_harden_patient_data_rls.sql` replaces the existing
policies on the eleven application tables, hardens profile role assignment,
and scopes medical-record storage access. It has been prepared locally only;
it has **not** been applied to Supabase. It drops all existing policies on
those eleven tables before creating the replacement set, so review it against
the target project's current policies and schema before applying it, preferably
to a staging project first. Do not apply it to production without a backup and
explicit approval.

The policies use active `profiles.role` values, never user-editable
`user_metadata`, for authorization. New Auth users are always patients.
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

The admin invitation function checks MFA (AAL2) for invitations only. This app
does not currently enforce MFA for every staff login. Compliance labels in the
admin security screen are intentionally marked as not assessed; a qualified
review is still required before making compliance claims.
