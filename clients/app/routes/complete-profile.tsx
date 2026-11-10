/**
 * Mandatory first-login profile completion.
 *
 * A verified patient or invited staff member cannot open any dashboard until
 * this form is submitted. Patients get the same five-step wizard used during
 * registration, prepopulated with what they already supplied and without a
 * second password. The server re-checks the gate on every request, so skipping
 * this page by URL does not work.
 */
import { useEffect, useMemo, useState } from "react";
import type { Route } from "./+types/complete-profile";
import { Link, Navigate, useNavigate } from "react-router";
import { ArrowLeft, CheckCircle2, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import PatientProfileWizard, {
  PatientBrandPanel,
} from "@/components/auth/patient-profile-wizard";
import type {
  PatientWizardInitial,
  PatientWizardSubmit,
} from "@/components/auth/patient-profile-wizard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useCompleteOnboarding,
  useDeleteOnboardingDocument,
  useOnboarding,
  useSavePatientDraft,
  useUploadOnboardingAvatar,
  useUploadOnboardingDocument,
} from "@/hooks/auth/use-session";
import { errorMessage } from "@/services/api/api-error";
import { getRoleHomeRoute } from "@/data";
import { label as toLabel } from "@/lib/format";
import type { roles } from "@/types";
import type { OnboardingStatus, PatientDocument } from "@/types/api.types";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Complete your profile — MGH Hospital" },
    { name: "description", content: "Finish setting up your hospital account." },
  ];
}

const GENDER_LABEL: Record<string, string> = {
  MALE: "Male",
  FEMALE: "Female",
  NON_BINARY: "Non-binary",
  PREFER_NOT_TO_SAY: "Prefer not to say",
};
const RELATION_LABEL: Record<string, string> = {
  SPOUSE: "Spouse",
  PARENT: "Parent",
  CHILD: "Child",
  SIBLING: "Sibling",
  GUARDIAN: "Guardian",
  OTHER: "Other",
};
const BLOOD_LABEL: Record<string, string> = {
  A_POS: "A+",
  A_NEG: "A-",
  B_POS: "B+",
  B_NEG: "B-",
  AB_POS: "AB+",
  AB_NEG: "AB-",
  O_POS: "O+",
  O_NEG: "O-",
};

const inputClass = "h-10";

export default function CompleteProfile() {
  const onboarding = useOnboarding();

  if (onboarding.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Loading your profile" />
      </div>
    );
  }

  if (onboarding.isError || !onboarding.data) {
    return <Navigate to="/login" replace />;
  }

  if (onboarding.data.completed) {
    return (
      <Navigate
        to={getRoleHomeRoute(onboarding.data.role as roles)}
        replace
      />
    );
  }

  if (onboarding.data.role === "PATIENT") {
    return <PatientCompletion data={onboarding.data} />;
  }

  return <StaffCompletion data={onboarding.data} />;
}

function PatientCompletion({ data }: { data: OnboardingStatus }) {
  const navigate = useNavigate();
  const complete = useCompleteOnboarding();
  const upload = useUploadOnboardingDocument();
  const remove = useDeleteOnboardingDocument();
  const saveDraft = useSavePatientDraft();
  const [error, setError] = useState<string | null>(null);

  // A saved draft from any device takes precedence over the registration data.
  const initial = useMemo<PatientWizardInitial>(() => {
    const patient = data.patient;
    const draft = data.draft?.data;
    const emergency = draft?.emergencyContact ?? patient?.emergencyContact;
    const insurance = draft?.insurance ?? patient?.insurance;
    return {
      email: data.email,
      firstName: draft?.firstName ?? patient?.firstName ?? data.name.split(" ")[0] ?? "",
      lastName: draft?.lastName ?? patient?.lastName ?? data.name.split(" ").slice(1).join(" "),
      middleName: draft?.middleName ?? patient?.middleName ?? "",
      dateOfBirth: draft?.dateOfBirth ?? patient?.dateOfBirth ?? "",
      gender: draft?.gender
        ? (GENDER_LABEL[draft.gender] ?? "")
        : patient?.gender
          ? (GENDER_LABEL[patient.gender] ?? "")
          : "",
      bloodGroup: draft?.bloodType
        ? (BLOOD_LABEL[draft.bloodType] ?? "")
        : patient?.bloodType
          ? (BLOOD_LABEL[patient.bloodType] ?? "")
          : "",
      phone: draft?.phone ?? patient?.phone ?? data.phone ?? "",
      address: draft?.addressLine1 ?? patient?.addressLine1 ?? "",
      city: draft?.city ?? patient?.city ?? "",
      state: draft?.state ?? patient?.state ?? "",
      zip: draft?.postalCode ?? patient?.postalCode ?? "",
      emergencyName: emergency?.name ?? "",
      emergencyPhone: emergency?.phone ?? "",
      emergencyRelation: emergency?.relationship
        ? (RELATION_LABEL[emergency.relationship] ?? "")
        : "",
      allergies: (draft?.allergies ?? patient?.allergies ?? []).join(", "),
      conditions: (draft?.conditions ?? patient?.conditions ?? []).join(", "),
      insurance: insurance?.providerName ?? "",
      insurancePlan: insurance?.planName ?? "",
      insuranceId: insurance?.policyNumber ?? "",
      insuranceMember: insurance?.memberId ?? "",
      terms: draft?.consents?.terms ?? patient?.consents.terms ?? false,
      privacy: draft?.consents?.privacy ?? patient?.consents.privacy ?? false,
      hipaa: draft?.consents?.hipaa ?? patient?.consents.hipaa ?? false,
    } satisfies PatientWizardInitial;
  }, [data]);

  const documents: PatientDocument[] = data.patient?.documents ?? [];

  const submit = async ({ patient, email }: PatientWizardSubmit) => {
    setError(null);
    try {
      await complete.mutateAsync({
        name: `${patient.firstName} ${patient.lastName}`.trim(),
        phone: patient.phone,
        patient,
      });
      toast.success("Your profile has been completed successfully. Welcome to MGH Hospital.", {
        description: email ? `Signed in as ${email}` : undefined,
      });
      navigate(getRoleHomeRoute("PATIENT"), { replace: true });
    } catch (caught) {
      setError(errorMessage(caught, "Could not complete your profile."));
    }
  };

  return (
    <div className="min-h-screen bg-muted text-foreground lg:grid lg:grid-cols-[380px_1fr]">
      <PatientBrandPanel
        title="Almost there — finish your patient profile."
        description="We saved your registration details. Review them, fill any gaps, and your dashboard will open."
      />
      <main className="flex min-h-screen flex-col px-4 py-6 sm:px-8">
        <header className="mx-auto flex w-full max-w-2xl items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted"
          >
            <ArrowLeft size={16} /> Back to home
          </Link>
          <span className="text-xs font-semibold text-muted-foreground">
            {data.email}
          </span>
        </header>

        <div className="mx-auto w-full max-w-2xl flex-1 py-8">
          <PatientProfileWizard
            mode="complete"
            initial={initial}
            documents={documents}
            uploadingDocument={upload.isPending}
            onUploadDocument={(file) =>
              upload.mutate(file, {
                onError: (caught) => toast.error(errorMessage(caught, "Could not upload the document.")),
              })
            }
            onDeleteDocument={(fileId) =>
              remove.mutate(fileId, {
                onError: (caught) => toast.error(errorMessage(caught, "Could not remove the document.")),
              })
            }
            submitting={complete.isPending}
            error={error}
            onSubmit={(values) => void submit(values)}
            submitLabel="Complete profile and open dashboard"
            initialStep={data.draft?.data.step}
            draftSavedAt={data.draft?.updatedAt ?? null}
            savingDraft={saveDraft.isPending}
            onSaveDraft={(draft) =>
              saveDraft.mutate(draft, {
                onError: (caught) =>
                  toast.error(errorMessage(caught, "Could not save your progress. Continue to retry.")),
              })
            }
          />
        </div>
      </main>
    </div>
  );
}

function StaffCompletion({ data }: { data: OnboardingStatus }) {
  const navigate = useNavigate();
  const complete = useCompleteOnboarding();
  const uploadAvatar = useUploadOnboardingAvatar();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [staff, setStaff] = useState({
    title: "",
    licenseNumber: "",
    employeeId: "",
    ward: "",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(data.name);
    setPhone(data.phone ?? "");
    setImage(data.image);
    if (data.staff) {
      setStaff({
        title: data.staff.title ?? "",
        licenseNumber: data.staff.licenseNumber ?? "",
        employeeId: data.staff.employeeId ?? "",
        ward: data.staff.ward ?? "",
      });
    }
  }, [data]);

  const licenseRequired = data.required.license;
  const role = data.role as roles;

  const initials = useMemo(
    () =>
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join(""),
    [name],
  );

  const upload = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    uploadAvatar.mutate(file, {
      onSuccess: (result) => setImage(result.image),
      onError: (caught) => setError(errorMessage(caught, "Could not upload the profile image.")),
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (name.trim().length < 2) return setError("Enter your full name.");
    if (phone.replace(/\D/g, "").length < 7) return setError("Enter a valid phone number.");
    if (!staff.title.trim()) return setError("Enter your job title.");
    if (licenseRequired && !staff.licenseNumber.trim()) {
      return setError("Enter your professional license number.");
    }

    try {
      await complete.mutateAsync({
        name: name.trim(),
        phone: phone.trim(),
        image,
        staff: {
          title: staff.title.trim(),
          licenseNumber: staff.licenseNumber.trim() || null,
          employeeId: staff.employeeId.trim() || null,
          ward: staff.ward.trim() || null,
          departmentId: data.staff?.departmentId ?? null,
          specialtyId: data.staff?.specialtyId ?? null,
        },
      });
      navigate(getRoleHomeRoute(role), { replace: true });
    } catch (caught) {
      setError(errorMessage(caught, "Could not complete your profile."));
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ArrowLeft size={15} aria-hidden="true" /> Back to home
        </Link>

        <div className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-7">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CheckCircle2 size={20} aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
                {toLabel(role)} onboarding
              </p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground">
                Complete your profile
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                This information is required before your dashboard opens. Your email address is already verified.
              </p>
            </div>
          </div>

          <form onSubmit={submit} noValidate className="mt-7 flex flex-col gap-5">
            <div className="flex items-center gap-4 rounded-xl bg-muted p-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-extrabold text-primary-foreground">
                {initials || "—"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-foreground">{name || "Your name"}</p>
                <p className="truncate text-xs text-muted-foreground">{data.email}</p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground outline-none transition-colors hover:bg-muted focus-within:ring-3 focus-within:ring-ring/50">
                <Upload size={14} aria-hidden="true" />
                {uploadAvatar.isPending ? "Uploading…" : "Photo"}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={uploadAvatar.isPending}
                  onChange={(event) => upload(event.target.files?.[0])}
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="onboarding-name">Full name</Label>
                <Input
                  id="onboarding-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="onboarding-phone">Phone number</Label>
                <Input
                  id="onboarding-phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  autoComplete="tel"
                  placeholder="+1 555 010 2030"
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label>Email address</Label>
                <Input value={data.email} readOnly className={`${inputClass} opacity-70`} />
              </div>
            </div>

            <fieldset className="flex flex-col gap-4">
              <legend className="text-sm font-bold text-foreground">Staff details</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="staff-title">Job title</Label>
                  <Input
                    id="staff-title"
                    value={staff.title}
                    onChange={(event) => setStaff((current) => ({ ...current, title: event.target.value }))}
                    placeholder="e.g. Attending Physician"
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="staff-license">
                    Professional license number{licenseRequired ? "" : " (optional)"}
                  </Label>
                  <Input
                    id="staff-license"
                    value={staff.licenseNumber}
                    onChange={(event) =>
                      setStaff((current) => ({ ...current, licenseNumber: event.target.value }))
                    }
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="staff-employee">Employee ID (optional)</Label>
                  <Input
                    id="staff-employee"
                    value={staff.employeeId}
                    onChange={(event) =>
                      setStaff((current) => ({ ...current, employeeId: event.target.value }))
                    }
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="staff-ward">Ward / unit (optional)</Label>
                  <Input
                    id="staff-ward"
                    value={staff.ward}
                    onChange={(event) => setStaff((current) => ({ ...current, ward: event.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>
            </fieldset>

            {error && (
              <p role="alert" className="text-xs font-medium text-destructive">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={complete.isPending || uploadAvatar.isPending}
              className="h-10 w-full rounded-xl text-sm font-bold"
            >
              {complete.isPending ? "Saving your profile…" : "Complete profile and open dashboard"}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
