/**
 * Mandatory first-login profile completion.
 *
 * A verified patient or invited staff member cannot open any dashboard until
 * this form is submitted. The server re-checks the gate on every request, so
 * skipping this page by URL does not work.
 */
import { useEffect, useMemo, useState } from "react";
import type { Route } from "./+types/complete-profile";
import { Link, Navigate, useNavigate } from "react-router";
import { ArrowLeft, CheckCircle2, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useCompleteOnboarding,
  useOnboarding,
  useUploadOnboardingAvatar,
} from "@/hooks/auth/use-session";
import { errorMessage } from "@/services/api/api-error";
import { getRoleHomeRoute } from "@/data";
import { label as toLabel } from "@/lib/format";
import type { roles } from "@/types";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Complete your profile — HOS" },
    { name: "description", content: "Finish setting up your hospital account." },
  ];
}

type SexAtBirth = "MALE" | "FEMALE" | "INTERSEX" | "UNKNOWN";

const inputClass = "h-10";

export default function CompleteProfile() {
  const navigate = useNavigate();
  const onboarding = useOnboarding();
  const complete = useCompleteOnboarding();
  const uploadAvatar = useUploadOnboardingAvatar();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [patient, setPatient] = useState({
    firstName: "",
    lastName: "",
    middleName: "",
    dateOfBirth: "",
    sexAtBirth: "UNKNOWN" as SexAtBirth,
    bloodType: "UNKNOWN",
    addressLine1: "",
    city: "",
    state: "",
    postalCode: "",
  });
  const [staff, setStaff] = useState({
    title: "",
    licenseNumber: "",
    employeeId: "",
    ward: "",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const data = onboarding.data;
    if (!data) return;
    setName(data.name);
    setPhone(data.phone ?? "");
    setImage(data.image);
    if (data.patient) {
      setPatient({
        firstName: data.patient.firstName,
        lastName: data.patient.lastName,
        middleName: data.patient.middleName ?? "",
        dateOfBirth: data.patient.dateOfBirth,
        sexAtBirth: data.patient.sexAtBirth as SexAtBirth,
        bloodType: data.patient.bloodType,
        addressLine1: data.patient.addressLine1 ?? "",
        city: data.patient.city ?? "",
        state: data.patient.state ?? "",
        postalCode: data.patient.postalCode ?? "",
      });
    } else if (data.role === "PATIENT" && !patient.firstName) {
      const parts = data.name.trim().split(/\s+/);
      setPatient((current) => ({
        ...current,
        firstName: parts.slice(0, -1).join(" ") || parts[0] || "",
        lastName: parts.length > 1 ? (parts[parts.length - 1] ?? "") : "",
      }));
    }
    if (data.staff) {
      setStaff({
        title: data.staff.title ?? "",
        licenseNumber: data.staff.licenseNumber ?? "",
        employeeId: data.staff.employeeId ?? "",
        ward: data.staff.ward ?? "",
      });
    }
  }, [onboarding.data]);

  const isPatient = onboarding.data?.role === "PATIENT";
  const licenseRequired = onboarding.data?.required.license ?? false;
  const alreadyComplete = onboarding.data?.completed ?? false;
  const role = onboarding.data?.role as roles | undefined;

  const initials = useMemo(() => {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }, [name]);

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

  if (alreadyComplete && role) {
    return <Navigate to={getRoleHomeRoute(role)} replace />;
  }

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

    if (name.trim().length < 2) {
      setError("Enter your full name.");
      return;
    }
    if (phone.replace(/\D/g, "").length < 7) {
      setError("Enter a valid phone number.");
      return;
    }

    if (isPatient) {
      if (!patient.firstName.trim() || !patient.lastName.trim()) {
        setError("Enter your first and last name.");
        return;
      }
      if (!patient.dateOfBirth) {
        setError("Enter your date of birth.");
        return;
      }
      if (
        !patient.addressLine1.trim() ||
        !patient.city.trim() ||
        !patient.state.trim() ||
        !patient.postalCode.trim()
      ) {
        setError("Enter your full address.");
        return;
      }
    } else {
      if (!staff.title.trim()) {
        setError("Enter your job title.");
        return;
      }
      if (licenseRequired && !staff.licenseNumber.trim()) {
        setError("Enter your professional license number.");
        return;
      }
    }

    try {
      await complete.mutateAsync({
        name: name.trim(),
        phone: phone.trim(),
        image,
        ...(isPatient
          ? {
              patient: {
                firstName: patient.firstName.trim(),
                lastName: patient.lastName.trim(),
                middleName: patient.middleName.trim() || null,
                dateOfBirth: patient.dateOfBirth,
                sexAtBirth: patient.sexAtBirth,
                bloodType: patient.bloodType,
                addressLine1: patient.addressLine1.trim(),
                city: patient.city.trim(),
                state: patient.state.trim(),
                postalCode: patient.postalCode.trim(),
              },
            }
          : {
              staff: {
                title: staff.title.trim(),
                licenseNumber: staff.licenseNumber.trim() || null,
                employeeId: staff.employeeId.trim() || null,
                ward: staff.ward.trim() || null,
              },
            }),
      });
      navigate(role ? getRoleHomeRoute(role) : "/login", { replace: true });
    } catch (caught) {
      setError(errorMessage(caught, "Could not complete your profile."));
    }
  };

  const pending = complete.isPending;

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
                {role ? toLabel(role) : "Account"} onboarding
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
                <p className="truncate text-xs text-muted-foreground">{onboarding.data.email}</p>
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
                <Input value={onboarding.data.email} readOnly className={`${inputClass} opacity-70`} />
              </div>
            </div>

            {isPatient ? (
              <fieldset className="flex flex-col gap-4">
                <legend className="text-sm font-bold text-foreground">Patient details</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="patient-first">First name</Label>
                    <Input
                      id="patient-first"
                      value={patient.firstName}
                      onChange={(event) =>
                        setPatient((current) => ({ ...current, firstName: event.target.value }))
                      }
                      autoComplete="given-name"
                      className={inputClass}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="patient-last">Last name</Label>
                    <Input
                      id="patient-last"
                      value={patient.lastName}
                      onChange={(event) =>
                        setPatient((current) => ({ ...current, lastName: event.target.value }))
                      }
                      autoComplete="family-name"
                      className={inputClass}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="patient-dob">Date of birth</Label>
                    <Input
                      id="patient-dob"
                      type="date"
                      value={patient.dateOfBirth}
                      onChange={(event) =>
                        setPatient((current) => ({ ...current, dateOfBirth: event.target.value }))
                      }
                      className={inputClass}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="patient-sex">Sex at birth</Label>
                    <select
                      id="patient-sex"
                      value={patient.sexAtBirth}
                      onChange={(event) =>
                        setPatient((current) => ({
                          ...current,
                          sexAtBirth: event.target.value as SexAtBirth,
                        }))
                      }
                      className={`${inputClass} rounded-lg border border-border bg-background px-3 text-sm`}
                    >
                      <option value="UNKNOWN">Prefer not to say</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="INTERSEX">Intersex</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="patient-blood">Blood type</Label>
                    <select
                      id="patient-blood"
                      value={patient.bloodType}
                      onChange={(event) =>
                        setPatient((current) => ({ ...current, bloodType: event.target.value }))
                      }
                      className={`${inputClass} rounded-lg border border-border bg-background px-3 text-sm`}
                    >
                      <option value="UNKNOWN">Unknown</option>
                      <option value="A_POS">A+</option>
                      <option value="A_NEG">A−</option>
                      <option value="B_POS">B+</option>
                      <option value="B_NEG">B−</option>
                      <option value="AB_POS">AB+</option>
                      <option value="AB_NEG">AB−</option>
                      <option value="O_POS">O+</option>
                      <option value="O_NEG">O−</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <Label htmlFor="patient-address">Address</Label>
                    <Input
                      id="patient-address"
                      value={patient.addressLine1}
                      onChange={(event) =>
                        setPatient((current) => ({ ...current, addressLine1: event.target.value }))
                      }
                      autoComplete="address-line1"
                      className={inputClass}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="patient-city">City</Label>
                    <Input
                      id="patient-city"
                      value={patient.city}
                      onChange={(event) =>
                        setPatient((current) => ({ ...current, city: event.target.value }))
                      }
                      autoComplete="address-level2"
                      className={inputClass}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="patient-state">State / province</Label>
                    <Input
                      id="patient-state"
                      value={patient.state}
                      onChange={(event) =>
                        setPatient((current) => ({ ...current, state: event.target.value }))
                      }
                      autoComplete="address-level1"
                      className={inputClass}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="patient-postal">Postal code</Label>
                    <Input
                      id="patient-postal"
                      value={patient.postalCode}
                      onChange={(event) =>
                        setPatient((current) => ({ ...current, postalCode: event.target.value }))
                      }
                      autoComplete="postal-code"
                      className={inputClass}
                    />
                  </div>
                </div>
              </fieldset>
            ) : (
              <fieldset className="flex flex-col gap-4">
                <legend className="text-sm font-bold text-foreground">Staff details</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="staff-title">Job title</Label>
                    <Input
                      id="staff-title"
                      value={staff.title}
                      onChange={(event) =>
                        setStaff((current) => ({ ...current, title: event.target.value }))
                      }
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
                      onChange={(event) =>
                        setStaff((current) => ({ ...current, ward: event.target.value }))
                      }
                      className={inputClass}
                    />
                  </div>
                </div>
              </fieldset>
            )}

            {error && (
              <p role="alert" className="text-xs font-medium text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" disabled={pending || uploadAvatar.isPending} className="h-10 w-full rounded-xl text-sm font-bold">
              {pending ? "Saving your profile…" : "Complete profile and open dashboard"}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
