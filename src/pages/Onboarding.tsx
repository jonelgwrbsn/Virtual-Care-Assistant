import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Camera, ChevronLeft, ChevronRight, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { LoadingScreen } from "@/components/LoadingScreen";
import { getSessionAsync, roleHome, setSession, type Session } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const GENDERS = [
  ["male", "Male"],
  ["female", "Female"],
  ["other", "Other"],
  ["prefer_not_to_say", "Prefer not to say"],
];
const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const SPECIALTIES = [
  "General Practice", "Internal Medicine", "Pediatrics", "Cardiology", "Dermatology",
  "Neurology", "Orthopedics", "Psychiatry", "Obstetrics & Gynecology", "Ophthalmology",
  "ENT", "Radiology", "Surgery", "Emergency Medicine", "Other",
];

interface PersonalDetails {
  phone: string;
  dateOfBirth: string;
  gender: string;
  address: string;
}

interface PatientDetails {
  bloodType: string;
  allergies: string;
  medicalConditions: string;
  emergencyName: string;
  emergencyPhone: string;
  emergencyRelation: string;
}

interface DoctorDetails {
  specialty: string;
  licenseNumber: string;
  yearsExperience: string;
  bio: string;
  availableDays: string[];
  availableHours: string;
}

const Field = ({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label htmlFor={htmlFor}>{label}</Label>
    {children}
  </div>
);

const Onboarding = () => {
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [session, setLocalSession] = useState<Session | null | "loading">("loading");
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [personal, setPersonal] = useState<PersonalDetails>({
    phone: "",
    dateOfBirth: "",
    gender: "",
    address: "",
  });
  const [patient, setPatient] = useState<PatientDetails>({
    bloodType: "",
    allergies: "",
    medicalConditions: "",
    emergencyName: "",
    emergencyPhone: "",
    emergencyRelation: "",
  });
  const [doctor, setDoctor] = useState<DoctorDetails>({
    specialty: "",
    licenseNumber: "",
    yearsExperience: "",
    bio: "",
    availableDays: [],
    availableHours: "",
  });

  useEffect(() => {
    let cancelled = false;
    getSessionAsync()
      .then(current => {
        if (!cancelled) {
          if (current) setSession(current);
          setLocalSession(current);
        }
      })
      .catch((error: unknown) => {
        console.error("Unable to load onboarding session:", error);
        if (!cancelled) {
          toast.error("Unable to load your account. Please sign in again.");
          setLocalSession(null);
        }
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!photo) {
      setPhotoPreview(null);
      return;
    }
    const previewUrl = URL.createObjectURL(photo);
    setPhotoPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [photo]);

  if (session === "loading") return <LoadingScreen label="Loading your profile…" />;
  if (!session) return <Navigate to="/" replace />;
  if (session.role === "admin" || session.onboardingCompleted) {
    return <Navigate to={roleHome[session.role]} replace />;
  }

  const isDoctor = session.role === "doctor";

  const validateStep = () => {
    if (step === 0) {
      if (personal.phone.replace(/\D/g, "").length !== 10) {
        toast.error("Enter a valid 10-digit Philippine phone number.");
        return false;
      }
      if (!personal.dateOfBirth) {
        toast.error("Enter your date of birth.");
        return false;
      }
      if (!personal.gender) {
        toast.error("Select your gender.");
        return false;
      }
    }
    if (step === 1 && isDoctor) {
      if (!doctor.specialty) {
        toast.error("Select your specialty.");
        return false;
      }
      if (!doctor.licenseNumber.trim()) {
        toast.error("Enter your professional license number.");
        return false;
      }
      if (doctor.availableDays.length === 0 || !doctor.availableHours.trim()) {
        toast.error("Add your available days and hours.");
        return false;
      }
    }
    return true;
  };

  const updatePhone = (event: ChangeEvent<HTMLInputElement>, emergency = false) => {
    const value = event.target.value.replace(/\D/g, "").slice(0, 10);
    if (emergency) {
      setPatient(current => ({ ...current, emergencyPhone: value }));
    } else {
      setPersonal(current => ({ ...current, phone: value }));
    }
  };

  const toggleDay = (day: string) => {
    setDoctor(current => ({
      ...current,
      availableDays: current.availableDays.includes(day)
        ? current.availableDays.filter(value => value !== day)
        : DAYS.filter(value => current.availableDays.includes(value) || value === day),
    }));
  };

  const finish = async () => {
    if (!validateStep()) return;
    setSaving(true);
    try {
      let avatarUrl = session.avatarUrl;
      if (photo) {
        const extension = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
        const path = `${session.id}/avatar.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, photo, { upsert: true, contentType: photo.type });
        if (uploadError) throw uploadError;
        avatarUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      }

      const profileUpdates = {
        phone: `+63${personal.phone}`,
        date_of_birth: personal.dateOfBirth,
        gender: personal.gender,
        address: personal.address.trim() || null,
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
        ...(isDoctor
          ? {
              specialty: doctor.specialty,
              license_number: doctor.licenseNumber.trim(),
              years_experience: doctor.yearsExperience ? Number(doctor.yearsExperience) : null,
              bio: doctor.bio.trim() || null,
              available_days: doctor.availableDays,
              available_hours: doctor.availableHours.trim(),
            }
          : {
              blood_type: patient.bloodType || null,
              allergies: patient.allergies.trim() || null,
              medical_conditions: patient.medicalConditions.trim() || null,
              emergency_contact_name: patient.emergencyName.trim() || null,
              emergency_contact_phone: patient.emergencyPhone ? `+63${patient.emergencyPhone}` : null,
              emergency_contact_relation: patient.emergencyRelation || null,
            }),
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("profiles").update(profileUpdates).eq("id", session.id);
      if (error) throw error;

      const updatedSession = { ...session, onboardingCompleted: true, avatarUrl };
      setSession(updatedSession);
      toast.success("Profile completed. Welcome to Virtual Care!");
      navigate(roleHome[session.role], { replace: true });
    } catch (error) {
      console.error("Unable to complete onboarding:", error);
      toast.error(error instanceof Error ? error.message : "Unable to save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type)) {
      toast.error("Choose a JPG, PNG, or WEBP image.");
      event.target.value = "";
      return;
    }
    if (selected.size > 5 * 1024 * 1024) {
      toast.error("Photo must be under 5 MB.");
      event.target.value = "";
      return;
    }
    setPhoto(selected);
  };

  return (
    <div className="hero-bg flex min-h-screen items-center justify-center px-4 py-10">
      <main className="w-full max-w-2xl rounded-2xl border border-border/60 bg-card p-6 shadow-card sm:p-8">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo />
          <div>
            <p className="text-sm text-muted-foreground">{isDoctor ? "Doctor profile" : "Patient profile"}</p>
            <h1 className="font-display text-2xl font-bold">Complete your profile</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Add the details that help us provide safer, more relevant care.
            </p>
          </div>
        </div>

        <ol aria-label="Profile completion progress" className="mb-8 flex items-center justify-center gap-3">
          {["Personal details", isDoctor ? "Professional details" : "Health details", "Photo"].map((label, index) => (
            <li key={label} aria-current={step === index ? "step" : undefined} className="flex items-center gap-2 text-xs">
              <span className={`flex h-7 w-7 items-center justify-center rounded-full ${step === index ? "bg-primary text-primary-foreground" : index < step ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                {index + 1}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </li>
          ))}
        </ol>

        <form onSubmit={event => {
          event.preventDefault();
          if (step < 2) {
            if (validateStep()) setStep(current => current + 1);
            return;
          }
          void finish();
        }} className="space-y-5">
          {step === 0 && (
            <section aria-labelledby="personal-heading" className="space-y-4">
              <h2 id="personal-heading" className="font-semibold">Personal details</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" htmlFor="profile-name">
                  <Input id="profile-name" value={session.name} readOnly />
                </Field>
                <Field label="Email" htmlFor="profile-email">
                  <Input id="profile-email" type="email" value={session.email} readOnly />
                </Field>
                <Field label="Phone number" htmlFor="profile-phone">
                  <div className="flex">
                    <span className="flex items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">+63</span>
                    <Input id="profile-phone" type="tel" inputMode="numeric" autoComplete="tel-national" value={personal.phone} onChange={updatePhone} placeholder="9XX XXX XXXX" maxLength={10} />
                  </div>
                </Field>
                <Field label="Date of birth" htmlFor="profile-birth">
                  <Input id="profile-birth" type="date" autoComplete="bday" value={personal.dateOfBirth} onChange={event => setPersonal(current => ({ ...current, dateOfBirth: event.target.value }))} />
                </Field>
                <Field label="Gender" htmlFor="profile-gender">
                  <select id="profile-gender" value={personal.gender} onChange={event => setPersonal(current => ({ ...current, gender: event.target.value }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <option value="">Select one…</option>
                    {GENDERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </Field>
                <Field label="Address (optional)" htmlFor="profile-address">
                  <Input id="profile-address" autoComplete="street-address" value={personal.address} onChange={event => setPersonal(current => ({ ...current, address: event.target.value }))} placeholder="City or address…" />
                </Field>
              </div>
            </section>
          )}

          {step === 1 && !isDoctor && (
            <section aria-labelledby="health-heading" className="space-y-4">
              <h2 id="health-heading" className="font-semibold">Health & emergency details</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Blood type (optional)" htmlFor="blood-type">
                  <select id="blood-type" value={patient.bloodType} onChange={event => setPatient(current => ({ ...current, bloodType: event.target.value }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <option value="">Select blood type…</option>
                    {BLOOD_TYPES.map(type => <option key={type}>{type}</option>)}
                  </select>
                </Field>
                <Field label="Allergies (optional)" htmlFor="allergies">
                  <Input id="allergies" value={patient.allergies} onChange={event => setPatient(current => ({ ...current, allergies: event.target.value }))} placeholder="List known allergies…" />
                </Field>
                <Field label="Medical conditions (optional)" htmlFor="medical-conditions">
                  <Input id="medical-conditions" value={patient.medicalConditions} onChange={event => setPatient(current => ({ ...current, medicalConditions: event.target.value }))} placeholder="List relevant conditions…" />
                </Field>
                <Field label="Emergency contact name (optional)" htmlFor="emergency-name">
                  <Input id="emergency-name" autoComplete="name" value={patient.emergencyName} onChange={event => setPatient(current => ({ ...current, emergencyName: event.target.value }))} placeholder="Contact’s full name…" />
                </Field>
                <Field label="Emergency contact phone (optional)" htmlFor="emergency-phone">
                  <div className="flex">
                    <span className="flex items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">+63</span>
                    <Input id="emergency-phone" type="tel" inputMode="numeric" autoComplete="tel" value={patient.emergencyPhone} onChange={event => updatePhone(event, true)} placeholder="9XX XXX XXXX" maxLength={10} />
                  </div>
                </Field>
                <Field label="Relationship (optional)" htmlFor="emergency-relation">
                  <Input id="emergency-relation" value={patient.emergencyRelation} onChange={event => setPatient(current => ({ ...current, emergencyRelation: event.target.value }))} placeholder="e.g. Parent, spouse…" />
                </Field>
              </div>
            </section>
          )}

          {step === 1 && isDoctor && (
            <section aria-labelledby="professional-heading" className="space-y-4">
              <h2 id="professional-heading" className="font-semibold">Professional details & availability</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Specialty" htmlFor="specialty">
                  <select id="specialty" value={doctor.specialty} onChange={event => setDoctor(current => ({ ...current, specialty: event.target.value }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <option value="">Select specialty…</option>
                    {SPECIALTIES.map(specialty => <option key={specialty}>{specialty}</option>)}
                  </select>
                </Field>
                <Field label="Professional license number" htmlFor="license-number">
                  <Input id="license-number" autoComplete="off" value={doctor.licenseNumber} onChange={event => setDoctor(current => ({ ...current, licenseNumber: event.target.value }))} placeholder="License number…" />
                </Field>
                <Field label="Years of experience (optional)" htmlFor="years-experience">
                  <Input id="years-experience" type="number" min="0" max="60" inputMode="numeric" value={doctor.yearsExperience} onChange={event => setDoctor(current => ({ ...current, yearsExperience: event.target.value }))} placeholder="e.g. 5" />
                </Field>
                <Field label="Available hours" htmlFor="available-hours">
                  <Input id="available-hours" value={doctor.availableHours} onChange={event => setDoctor(current => ({ ...current, availableHours: event.target.value }))} placeholder="e.g. 9:00 AM – 5:00 PM" />
                </Field>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Available days</Label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map(day => (
                      <button key={day} type="button" aria-pressed={doctor.availableDays.includes(day)} onClick={() => toggleDay(day)} className={`rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${doctor.availableDays.includes(day) ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-accent"}`}>
                        {day.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
                <Field label="Short professional bio (optional)" htmlFor="doctor-bio">
                  <textarea id="doctor-bio" rows={3} value={doctor.bio} onChange={event => setDoctor(current => ({ ...current, bio: event.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:col-span-2" placeholder="Describe your practice…" />
                </Field>
              </div>
            </section>
          )}

          {step === 2 && (
            <section aria-labelledby="photo-heading" className="space-y-4 text-center">
              <h2 id="photo-heading" className="font-semibold">Profile photo (optional)</h2>
              <p className="text-sm text-muted-foreground">You can add or change a photo later.</p>
              <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhotoChange} className="sr-only" aria-label="Choose a profile photo" />
              {photoPreview ? (
                <img src={photoPreview} alt="Selected profile preview" width={128} height={128} className="mx-auto h-32 w-32 rounded-full object-cover" />
              ) : (
                <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Camera className="h-10 w-10" aria-hidden="true" />
                </div>
              )}
              <div className="flex justify-center gap-2">
                <Button type="button" variant="outline" onClick={() => fileInput.current?.click()}>
                  {photo ? "Change photo" : "Choose photo"}
                </Button>
                {photo && <Button type="button" variant="ghost" onClick={() => setPhoto(null)}>Remove</Button>}
              </div>
              <p className="text-xs text-muted-foreground">JPG, PNG, or WEBP · Max 5 MB</p>
            </section>
          )}

          <div className="flex items-center justify-between border-t border-border/60 pt-4">
            {step > 0 ? (
              <Button type="button" variant="outline" disabled={saving} onClick={() => setStep(current => current - 1)}>
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
            ) : <span />}
            {step < 2 ? (
              <Button type="button" onClick={() => { if (validateStep()) setStep(current => current + 1); }}>
                Continue <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="submit" disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><ShieldCheck className="h-4 w-4" /> Complete profile</>}
              </Button>
            )}
          </div>
        </form>
      </main>
    </div>
  );
};

export default Onboarding;
