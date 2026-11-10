/**
 * The five-step patient experience, shared by self-registration and the
 * mandatory profile-completion wizard.
 *
 * Registration mode adds password + account creation on the last step. Profile
 * completion mode reuses the same fields and visual structure but never asks
 * for a password: the account already exists and was verified by email OTP.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  HeartPulse,
  Loader2,
  Lock,
  MapPin,
  Stethoscope,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";

import type { PatientDocument, PatientDraft, PatientProfileInput } from "@/types/api.types";

export const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
const genders = ["Male", "Female", "Non-binary", "Prefer not to say"] as const;
const insurers = [
  "Aetna",
  "Blue Cross Blue Shield",
  "Cigna",
  "UnitedHealth",
  "Humana",
  "Kaiser Permanente",
  "Anthem",
  "Medicare",
  "Medicaid",
  "Other",
] as const;
const relationships = ["Spouse", "Parent", "Child", "Sibling", "Guardian", "Other"] as const;

const BLOOD_TO_ENUM: Record<string, string> = {
  "A+": "A_POS",
  "A-": "A_NEG",
  "B+": "B_POS",
  "B-": "B_NEG",
  "AB+": "AB_POS",
  "AB-": "AB_NEG",
  "O+": "O_POS",
  "O-": "O_NEG",
};
const GENDER_TO_ENUM: Record<string, PatientProfileInput["gender"]> = {
  Male: "MALE",
  Female: "FEMALE",
  "Non-binary": "NON_BINARY",
  "Prefer not to say": "PREFER_NOT_TO_SAY",
};
const RELATION_TO_ENUM: Record<
  string,
  NonNullable<PatientProfileInput["emergencyContact"]>["relationship"]
> = {
  Spouse: "SPOUSE",
  Parent: "PARENT",
  Child: "CHILD",
  Sibling: "SIBLING",
  Guardian: "GUARDIAN",
  Other: "OTHER",
};

export interface PatientWizardInitial {
  email?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  emergencyRelation?: string;
  allergies?: string;
  conditions?: string;
  insurance?: string;
  insurancePlan?: string;
  insuranceId?: string;
  insuranceMember?: string;
  terms?: boolean;
  privacy?: boolean;
  hipaa?: boolean;
}

export interface PatientWizardSubmit {
  patient: PatientProfileInput;
  email: string;
  password?: string;
}

export interface PatientWizardProps {
  mode: "register" | "complete";
  initial?: PatientWizardInitial;
  /** Existing documents (profile completion); registration files are held until submit. */
  documents?: PatientDocument[];
  onUploadDocument?: (file: File) => void;
  onDeleteDocument?: (fileId: string) => void;
  uploadingDocument?: boolean;
  submitting: boolean;
  error?: string | null;
  onSubmit: (values: PatientWizardSubmit, files: File[]) => void;
  submitLabel?: string;
  /** Resume position from a server-side draft. */
  initialStep?: number;
  /** Persist partial progress; calls are fire-and-forget from the wizard. */
  onSaveDraft?: (draft: PatientDraft) => void;
  savingDraft?: boolean;
  draftSavedAt?: string | null;
}

const steps = [
  { label: "Personal", title: "Personal Info", icon: User },
  { label: "Contact", title: "Contact & Address", icon: MapPin },
  { label: "Medical", title: "Medical Info", icon: HeartPulse },
  { label: "Insurance", title: "Insurance", icon: FileText },
  { label: "Account", title: "Review & Consent", icon: Lock },
];

const fieldCls =
  "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground shadow-sm outline-none transition " +
  "placeholder:text-muted-foreground/70 hover:border-border focus:border-blue-600 focus:ring-4 focus:ring-blue-600/15";

function Field({
  label,
  required,
  hint,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-foreground">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children(id)}
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3.5 text-[13px] leading-relaxed text-foreground transition hover:bg-muted">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 shrink-0 rounded border-border accent-blue-600"
      />
      <span>{children}</span>
    </label>
  );
}

const link = "font-semibold text-blue-600 dark:text-blue-400";

export default function PatientProfileWizard({
  mode,
  initial,
  documents = [],
  onUploadDocument,
  onDeleteDocument,
  uploadingDocument = false,
  submitting,
  error: serverError,
  onSubmit,
  submitLabel,
  initialStep,
  onSaveDraft,
  savingDraft = false,
  draftSavedAt,
}: PatientWizardProps) {
  const [step, setStep] = useState(() => Math.min(steps.length - 1, Math.max(0, initialStep ?? 0)));
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [records, setRecords] = useState<File[]>([]);
  const [cards, setCards] = useState<File[]>([]);
  const recordsInput = useRef<HTMLInputElement>(null);
  const cardsInput = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    firstName: initial?.firstName ?? "",
    lastName: initial?.lastName ?? "",
    middleName: initial?.middleName ?? "",
    dob: initial?.dateOfBirth ?? "",
    gender: initial?.gender ?? "",
    bloodGroup: initial?.bloodGroup ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    address: initial?.address ?? "",
    city: initial?.city ?? "",
    state: initial?.state ?? "",
    zip: initial?.zip ?? "",
    emergencyName: initial?.emergencyName ?? "",
    emergencyPhone: initial?.emergencyPhone ?? "",
    emergencyRelation: initial?.emergencyRelation ?? "",
    allergies: initial?.allergies ?? "",
    conditions: initial?.conditions ?? "",
    insurance: initial?.insurance ?? "",
    insurancePlan: initial?.insurancePlan ?? "",
    insuranceId: initial?.insuranceId ?? "",
    insuranceMember: initial?.insuranceMember ?? "",
    password: "",
    confirmPassword: "",
    terms: initial?.terms ?? false,
    privacy: initial?.privacy ?? false,
    hipaa: initial?.hipaa ?? false,
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (error) setError("");
  };

  const text = (key: keyof typeof form) => ({
    value: form[key] as string,
    onChange: (event: { target: { value: string } }) =>
      update(key, event.target.value as never),
  });

  const passwordRules = useMemo(
    () => [
      { label: "At least 12 characters", test: (value: string) => value.length >= 12 },
      { label: "One letter", test: (value: string) => /[A-Za-z]/.test(value) },
      { label: "One number", test: (value: string) => /\d/.test(value) },
      { label: "One special character", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
    ],
    [],
  );

  const canonicalDraft = (nextStep?: number): PatientDraft => ({
    ...(nextStep !== undefined ? { step: nextStep } : {}),
    firstName: form.firstName,
    lastName: form.lastName,
    middleName: form.middleName,
    ...(form.dob ? { dateOfBirth: form.dob } : {}),
    ...(form.gender ? { gender: GENDER_TO_ENUM[form.gender] } : {}),
    ...(form.bloodGroup ? { bloodType: BLOOD_TO_ENUM[form.bloodGroup] } : {}),
    phone: form.phone,
    addressLine1: form.address,
    city: form.city,
    state: form.state,
    postalCode: form.zip,
    ...(form.emergencyName.trim()
      ? {
          emergencyContact: {
            name: form.emergencyName,
            ...(form.emergencyRelation
              ? { relationship: RELATION_TO_ENUM[form.emergencyRelation] }
              : {}),
            phone: form.emergencyPhone,
          },
        }
      : {}),
    allergies: form.allergies
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    conditions: form.conditions
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    ...(form.insurance.trim()
      ? {
          insurance: {
            providerName: form.insurance,
            planName: form.insurancePlan,
            policyNumber: form.insuranceId,
            memberId: form.insuranceMember,
          },
        }
      : {}),
    consents: { terms: form.terms, privacy: form.privacy, hipaa: form.hipaa },
  });

  const validateStep = (): string => {
    if (step === 0) {
      if (!form.firstName.trim() || !form.lastName.trim()) return "Please enter your first and last name.";
      if (!form.dob) return "Please enter your date of birth.";
      if (!form.gender) return "Please select your gender.";
    }
    if (step === 1) {
      if (mode === "register" && !/^\S+@\S+\.\S+$/.test(form.email)) {
        return "Please enter a valid email address.";
      }
      if (form.phone.replace(/\D/g, "").length < 7) return "Please enter a valid phone number.";
      if (!form.address.trim() || !form.city.trim() || !form.state.trim() || !form.zip.trim()) {
        return "Please enter your full street address, city, state and ZIP code.";
      }
      if (form.emergencyName.trim() || form.emergencyPhone.trim()) {
        if (!form.emergencyName.trim() || form.emergencyPhone.replace(/\D/g, "").length < 7) {
          return "Enter both an emergency contact name and a valid phone number.";
        }
      }
    }
    if (step === 3) {
      if (form.insurance && (!form.insuranceId.trim() || !form.insurance.trim())) {
        return "Enter the insurance provider and policy number, or leave insurance blank.";
      }
    }
    if (step === 4) {
      if (mode === "register") {
        if (!passwordRules.every((rule) => rule.test(form.password))) {
          return "Your password does not meet all the requirements.";
        }
        if (form.password !== form.confirmPassword) return "Passwords do not match.";
      }
      if (!form.terms || !form.privacy || !form.hipaa) {
        return "Accept the Terms, Privacy Policy and HIPAA notice to continue.";
      }
    }
    return "";
  };

  const next = () => {
    const message = validateStep();
    if (message) return setError(message);
    setError("");
    onSaveDraft?.(canonicalDraft(step + 1));
    setStep((current) => current + 1);
  };

  const back = () => {
    setError("");
    setStep((current) => current - 1);
  };

  const submit = () => {
    if (submitting) return;
    const message = validateStep();
    if (message) return setError(message);

    const patient: PatientProfileInput = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      middleName: form.middleName.trim() || null,
      dateOfBirth: form.dob,
      gender: GENDER_TO_ENUM[form.gender] ?? "PREFER_NOT_TO_SAY",
      ...(form.bloodGroup ? { bloodType: BLOOD_TO_ENUM[form.bloodGroup] } : {}),
      phone: form.phone.trim(),
      addressLine1: form.address.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      postalCode: form.zip.trim(),
      ...(form.emergencyName.trim()
        ? {
            emergencyContact: {
              name: form.emergencyName.trim(),
              phone: form.emergencyPhone.trim(),
              relationship: RELATION_TO_ENUM[form.emergencyRelation] ?? "OTHER",
            },
          }
        : {}),
      allergies: form.allergies
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      conditions: form.conditions
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      ...(form.insurance.trim()
        ? {
            insurance: {
              providerName: form.insurance.trim(),
              planName: form.insurancePlan.trim() || null,
              policyNumber: form.insuranceId.trim(),
              memberId: form.insuranceMember.trim() || null,
            },
          }
        : {}),
      consents: { terms: form.terms, privacy: form.privacy, hipaa: form.hipaa },
    };

    setError("");
    onSubmit(
      {
        patient,
        email: form.email.trim().toLowerCase(),
        ...(mode === "register" ? { password: form.password } : {}),
      },
      [...records, ...cards],
    );
  };

  const pickRecords = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (mode === "complete" && onUploadDocument) {
      files.forEach((file) => onUploadDocument(file));
      return;
    }
    setRecords((current) => [...current, ...files]);
  };

  const pickCards = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (mode === "complete" && onUploadDocument) {
      files.forEach((file) => onUploadDocument(file));
      return;
    }
    setCards((current) => [...current, ...files]);
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="First name" required>
              {(id) => (
                <input id={id} className={fieldCls} type="text" autoComplete="given-name" placeholder="John" {...text("firstName")} />
              )}
            </Field>
            <Field label="Last name" required>
              {(id) => (
                <input id={id} className={fieldCls} type="text" autoComplete="family-name" placeholder="Doe" {...text("lastName")} />
              )}
            </Field>
            <Field label="Middle name">
              {(id) => <input id={id} className={fieldCls} type="text" autoComplete="additional-name" {...text("middleName")} />}
            </Field>
            <Field label="Date of birth" required>
              {(id) => <input id={id} className={fieldCls} type="date" autoComplete="bday" {...text("dob")} />}
            </Field>
            <Field label="Gender" required>
              {(id) => (
                <select id={id} className={fieldCls} {...text("gender")}>
                  <option value="">Select gender</option>
                  {genders.map((gender) => (
                    <option key={gender} value={gender}>
                      {gender}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <div className="sm:col-span-2">
              <span className="mb-2 block text-[13px] font-semibold text-foreground">Blood group</span>
              <div role="radiogroup" aria-label="Blood group" className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                {bloodGroups.map((group) => {
                  const active = form.bloodGroup === group;
                  return (
                    <button
                      key={group}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => update("bloodGroup", active ? "" : group)}
                      className={
                        "rounded-xl border py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-600/20 " +
                        (active
                          ? "border-blue-600 bg-blue-50 text-blue-700 shadow-sm dark:bg-blue-500/15 dark:text-blue-300"
                          : "border-border bg-background text-foreground hover:bg-muted")
                      }
                    >
                      {group}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      case 1:
        return (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-6">
            <Field label="Email address" required={mode === "register"} className="sm:col-span-3">
              {(id) => (
                <input
                  id={id}
                  className={fieldCls}
                  type="email"
                  autoComplete="email"
                  readOnly={mode === "complete"}
                  {...text("email")}
                />
              )}
            </Field>
            <Field label="Phone number" required className="sm:col-span-3">
              {(id) => (
                <input id={id} className={fieldCls} type="tel" autoComplete="tel" placeholder="(555) 000-0000" {...text("phone")} />
              )}
            </Field>
            <Field label="Street address" required className="sm:col-span-6">
              {(id) => (
                <input id={id} className={fieldCls} type="text" autoComplete="street-address" placeholder="1200 Main St" {...text("address")} />
              )}
            </Field>
            <Field label="City" required className="sm:col-span-3">
              {(id) => <input id={id} className={fieldCls} type="text" autoComplete="address-level2" placeholder="Chicago" {...text("city")} />}
            </Field>
            <Field label="State" required className="sm:col-span-1">
              {(id) => <input id={id} className={fieldCls} type="text" autoComplete="address-level1" placeholder="IL" {...text("state")} />}
            </Field>
            <Field label="ZIP code" required className="sm:col-span-2">
              {(id) => <input id={id} className={fieldCls} type="text" autoComplete="postal-code" placeholder="60601" {...text("zip")} />}
            </Field>

            <div className="rounded-2xl border border-border bg-muted/60 p-5 sm:col-span-6">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-foreground">Emergency contact</h3>
                <p className="text-xs text-muted-foreground">Someone we can reach if you need urgent care.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Full name">
                  {(id) => <input id={id} className={fieldCls} type="text" placeholder="Jane Doe" {...text("emergencyName")} />}
                </Field>
                <Field label="Phone">
                  {(id) => <input id={id} className={fieldCls} type="tel" placeholder="(555) 111-1111" {...text("emergencyPhone")} />}
                </Field>
                <Field label="Relationship">
                  {(id) => (
                    <select id={id} className={fieldCls} {...text("emergencyRelation")}>
                      <option value="">Select relationship</option>
                      {relationships.map((relation) => (
                        <option key={relation} value={relation}>
                          {relation}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-5">
            <Field label="Known allergies" hint="Separate multiple allergies with commas. Leave blank if none.">
              {(id) => (
                <textarea id={id} rows={3} className={`${fieldCls} resize-y`} placeholder="e.g. Penicillin, peanuts" {...text("allergies")} />
              )}
            </Field>
            <Field label="Existing medical conditions" hint="Separate multiple conditions with commas.">
              {(id) => (
                <textarea id={id} rows={3} className={`${fieldCls} resize-y`} placeholder="Diabetes, hypertension, asthma, etc." {...text("conditions")} />
              )}
            </Field>

            <div>
              <p className="mb-2 text-[13px] font-semibold text-foreground">Medical documents</p>
              <input
                ref={recordsInput}
                type="file"
                className="sr-only"
                multiple
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={pickRecords}
              />
              <button
                type="button"
                onClick={() => recordsInput.current?.click()}
                disabled={uploadingDocument}
                className="group flex w-full cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-border bg-muted/40 px-6 py-7 text-center transition hover:border-blue-500 hover:bg-blue-50/60 disabled:opacity-60 dark:hover:bg-blue-500/5"
              >
                <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm ring-1 ring-border transition group-hover:text-blue-600">
                  {uploadingDocument ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {mode === "complete" ? "Upload another document" : "Upload medical documents"}
                </span>
                <span className="mt-1 text-xs text-muted-foreground">
                  Previous records, lab results, imaging reports (PDF, JPG, PNG · max 15 MB)
                </span>
              </button>

              {(documents.length > 0 || records.length > 0) && (
                <ul className="mt-3 space-y-1.5">
                  {documents.map((document) => (
                    <li
                      key={document.id}
                      className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                    >
                      <Check size={14} />
                      <span className="truncate">{document.fileName}</span>
                      {onDeleteDocument && (
                        <button
                          type="button"
                          aria-label={`Remove ${document.fileName}`}
                          onClick={() => onDeleteDocument(document.id)}
                          className="ml-auto rounded p-1 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-400"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </li>
                  ))}
                  {records.map((file) => (
                    <li
                      key={`${file.name}-${file.size}-${file.lastModified}`}
                      className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                    >
                      <Check size={14} />
                      <span className="truncate">{file.name}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${file.name}`}
                        onClick={() =>
                          setRecords((current) =>
                            current.filter(
                              (item) =>
                                !(
                                  item.name === file.name &&
                                  item.size === file.size &&
                                  item.lastModified === file.lastModified
                                ),
                            ),
                          )
                        }
                        className="ml-auto rounded p-1 hover:bg-emerald-100"
                      >
                        <Trash2 size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        );
      case 3:
        return (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Insurance provider" className="sm:col-span-2">
              {(id) => (
                <select id={id} className={fieldCls} {...text("insurance")}>
                  <option value="">No insurance / self-pay</option>
                  {insurers.map((insurer) => (
                    <option key={insurer} value={insurer}>
                      {insurer}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Plan name">
              {(id) => <input id={id} className={fieldCls} type="text" placeholder="e.g. Gold PPO" {...text("insurancePlan")} />}
            </Field>
            <Field label="Insurance ID / policy number">
              {(id) => <input id={id} className={fieldCls} type="text" placeholder="INS-123456789" {...text("insuranceId")} />}
            </Field>
            <Field label="Member ID">
              {(id) => <input id={id} className={fieldCls} type="text" placeholder="MBR-987654" {...text("insuranceMember")} />}
            </Field>
            <div className="sm:col-span-2">
              <p className="mb-2 text-[13px] font-semibold text-foreground">Insurance card</p>
              <input ref={cardsInput} type="file" className="sr-only" multiple accept=".jpg,.jpeg,.png,.pdf" onChange={pickCards} />
              <button
                type="button"
                onClick={() => cardsInput.current?.click()}
                disabled={uploadingDocument}
                className="group flex w-full cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-border bg-muted/40 px-6 py-7 text-center transition hover:border-blue-500 hover:bg-blue-50/60 disabled:opacity-60 dark:hover:bg-blue-500/5"
              >
                <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm ring-1 ring-border transition group-hover:text-blue-600">
                  <Upload size={20} />
                </span>
                <span className="text-sm font-semibold text-foreground">Upload insurance card</span>
                <span className="mt-1 text-xs text-muted-foreground">A photo of the front and back of your card</span>
              </button>
              {cards.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {cards.map((file) => (
                    <li
                      key={`${file.name}-${file.size}-${file.lastModified}`}
                      className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                    >
                      <Check size={14} />
                      <span className="truncate">{file.name}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${file.name}`}
                        onClick={() => setCards((current) => current.filter((item) => item !== file))}
                        className="ml-auto rounded p-1 hover:bg-emerald-100"
                      >
                        <Trash2 size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">
              No insurance? You can skip this step and add it later from your profile.
            </p>
          </div>
        );
      default: {
        const mismatch = form.confirmPassword.length > 0 && form.password !== form.confirmPassword;
        return (
          <div className="space-y-5">
            {mode === "register" ? (
              <>
                <Field label="Password" required>
                  {(id) => (
                    <div className="relative">
                      <input
                        id={id}
                        className={`${fieldCls} pr-11`}
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="Create a strong password"
                        {...text("password")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground transition hover:text-foreground"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  )}
                </Field>
                <Field label="Confirm password" required>
                  {(id) => (
                    <input
                      id={id}
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Re-enter your password"
                      aria-invalid={mismatch}
                      className={`${fieldCls} ${mismatch ? "border-red-400 focus:border-red-500 focus:ring-red-500/15" : ""}`}
                      {...text("confirmPassword")}
                    />
                  )}
                </Field>
                {mismatch && <p className="-mt-3 text-xs font-medium text-red-600">Passwords do not match.</p>}

                <div className="rounded-2xl bg-muted p-4 ring-1 ring-border">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Password requirements
                  </p>
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {passwordRules.map((rule) => {
                      const ok = rule.test(form.password);
                      return (
                        <li
                          key={rule.label}
                          className={`flex items-center gap-2 text-xs font-medium ${ok ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}
                        >
                          <span
                            className={`flex size-4 items-center justify-center rounded-full ${ok ? "bg-emerald-500 text-white" : "bg-border text-transparent"}`}
                          >
                            <Check size={10} strokeWidth={3} />
                          </span>
                          {rule.label}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
                Your password was set during registration and is not changed here. Review the summary below and
                confirm the required consents to finish your profile.
              </div>
            )}

            <div className="space-y-3">
              <Checkbox checked={form.terms} onChange={(value) => update("terms", value)}>
                I agree to the <span className={link}>Terms of Service</span> and{" "}
                <span className={link}>Privacy Policy</span>.
              </Checkbox>
              <Checkbox checked={form.privacy} onChange={(value) => update("privacy", value)}>
                I consent to the processing of my personal and health information as described in the{" "}
                <span className={link}>Privacy Policy</span>.
              </Checkbox>
              <Checkbox checked={form.hipaa} onChange={(value) => update("hipaa", value)}>
                I acknowledge the <span className={link}>HIPAA Privacy Notice</span> and consent to electronic
                health record management.
              </Checkbox>
            </div>
          </div>
        );
      }
    }
  };

  const isLast = step === steps.length - 1;
  const activeError = error || serverError;

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-xl shadow-slate-900/5 dark:shadow-none sm:p-9">
      <div className="mb-7">
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-[26px]">
          {mode === "register" ? "Create patient account" : "Complete your patient profile"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Step {step + 1} of {steps.length} · {steps[step]?.title}
        </p>
        {onSaveDraft && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            {savingDraft ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <CheckCircle2 size={12} className="text-emerald-600" />
            )}
            {savingDraft
              ? "Saving your progress…"
              : draftSavedAt
                ? "Progress saved to your account — resume on any device."
                : "Your progress is saved to your account as you continue."}
          </p>
        )}
      </div>

      <ol className="mb-8 flex items-center" aria-label="Profile progress">
        {steps.map((item, index) => {
          const done = index < step;
          const active = index === step;
          const Icon = item.icon;
          return (
            <li
              key={item.label}
              className={`flex items-center ${index < steps.length - 1 ? "flex-1" : ""}`}
              aria-current={active ? "step" : undefined}
            >
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={
                    "flex size-9 items-center justify-center rounded-full text-sm transition-all " +
                    (done || active
                      ? "bg-blue-600 text-white" + (active ? " ring-4 ring-blue-600/20" : "")
                      : "bg-muted text-muted-foreground")
                  }
                >
                  {done ? <Check size={16} strokeWidth={3} /> : <Icon size={16} />}
                </span>
                <span className={`hidden text-[11px] font-semibold sm:block ${active ? "text-blue-700 dark:text-blue-400" : "text-muted-foreground"}`}>
                  {item.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <span className={`mx-2 h-0.5 flex-1 rounded-full transition-colors sm:mb-5 ${done ? "bg-blue-600" : "bg-border"}`} />
              )}
            </li>
          );
        })}
      </ol>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (isLast) submit();
          else next();
        }}
        noValidate
      >
        {renderStep()}

        {activeError && (
          <div
            role="alert"
            className="mt-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
          >
            <X size={16} className="mt-0.5 shrink-0" /> {activeError}
          </div>
        )}

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row">
          {step > 0 && (
            <button
              type="button"
              onClick={back}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-muted focus:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
            >
              <ArrowLeft size={16} /> Previous
            </button>
          )}
          {isLast ? (
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex flex-[2] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-600/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {mode === "register" ? "Creating account…" : "Saving your profile…"}
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  {submitLabel ?? (mode === "register" ? "Create account" : "Complete profile")}
                </>
              )}
            </button>
          ) : (
            <button
              type="submit"
              className="inline-flex flex-[2] items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-600/30"
            >
              Continue <ArrowRight size={16} />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

/** Shared branding panel for the patient registration screens. */
export function PatientBrandPanel({ title, description }: { title: string; description: string }) {
  return (
    <aside className="relative hidden overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 p-10 text-white lg:flex lg:flex-col lg:justify-between">
      <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-20 size-80 rounded-full bg-indigo-400/20 blur-3xl" />

      <div className="relative flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
          <Stethoscope size={20} />
        </span>
        <span className="text-xl font-extrabold tracking-tight">MGH Hospital</span>
      </div>

      <div className="relative">
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight">{title}</h1>
        <p className="mt-4 max-w-xs text-sm leading-relaxed text-blue-100">{description}</p>
        <ul className="mt-8 space-y-4 text-sm">
          {[
            "Instant access to prescriptions and results",
            "Encrypted, HIPAA-compliant data storage",
            "One profile across every department",
          ].map((item) => (
            <li key={item} className="flex items-center gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
                <Check size={13} strokeWidth={3} />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative flex items-center gap-2 text-xs text-blue-100">
        <Lock size={14} /> Your information is protected end-to-end.
      </div>
    </aside>
  );
}
