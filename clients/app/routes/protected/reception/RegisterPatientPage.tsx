import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { User, Phone, Shield, CheckCircle, ChevronRight, Copy } from "lucide-react";

import { useCreatePatient, usePatients } from "@/hooks/patients/patients.hooks";
import { useDoctors } from "@/hooks/administration/administration.hooks";
import { registerPatientSchema, type RegisterPatientValues } from "@/schemas/patient.schema";
import { errorMessage } from "@/services/api/api-error";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

const STEPS = [
  { num: 1, label: "Personal Info", icon: User },
  { num: 2, label: "Contact & Demographics", icon: Phone },
  { num: 3, label: "Confirmation", icon: Shield },
];

const SEX_OPTIONS = ["MALE", "FEMALE", "INTERSEX", "UNKNOWN"] as const;
const BLOOD_OPTIONS = ["A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG", "O_POS", "O_NEG", "UNKNOWN"] as const;

const inputClass = "w-full py-2.5 px-3 rounded-lg text-[13px] bg-card text-foreground outline-none box-border border-[1.5px] border-border focus:border-blue-600";

export default function RegisterPatientPage() {
  const [step, setStep] = useState(1);
  const [registered, setRegistered] = useState<{ mrn: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [doctorSearch, setDoctorSearch] = useState("");

  const createPatient = useCreatePatient();
  const doctors = useDoctors({ pageSize: 50, status: "ACTIVE", search: useDebouncedValue(doctorSearch) || undefined });
  const existing = usePatients({ pageSize: 1 });

  const form = useForm<RegisterPatientValues>({
    resolver: zodResolver(registerPatientSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      sexAtBirth: "UNKNOWN",
      bloodType: "UNKNOWN",
      ssnLast4: "",
      phone: "",
      email: "",
      addressLine1: "",
      city: "",
      state: "",
      postalCode: "",
      heightCm: "",
      weightKg: "",
      primaryDoctorId: "",
    },
  });

  const values = form.watch();
  const errors = form.formState.errors;

  const nextStep = async () => {
    if (step === 1) {
      const valid = await form.trigger(["firstName", "lastName", "dateOfBirth", "sexAtBirth", "bloodType", "ssnLast4"]);
      if (!valid) return;
    }
    setStep((current) => Math.min(3, current + 1));
  };

  const submit = async () => {
    const valid = await form.trigger();
    if (!valid) {
      setStep(1);
      toast.error("Some required fields are missing.");
      return;
    }
    try {
      const patient = await createPatient.mutateAsync({
        input: {
          firstName: values.firstName,
          lastName: values.lastName,
          dateOfBirth: values.dateOfBirth,
          sexAtBirth: values.sexAtBirth,
          bloodType: values.bloodType,
          ssnLast4: values.ssnLast4 || undefined,
          phone: values.phone || undefined,
          email: values.email || undefined,
          addressLine1: values.addressLine1 || undefined,
          city: values.city || undefined,
          state: values.state || undefined,
          postalCode: values.postalCode || undefined,
          heightCm: values.heightCm ? Number(values.heightCm) : undefined,
          weightKg: values.weightKg ? Number(values.weightKg) : undefined,
          primaryDoctorId: values.primaryDoctorId || undefined,
        },
        // Stable per submission attempt so a retry cannot create duplicates.
        idempotencyKey: crypto.randomUUID(),
      });
      setRegistered({ mrn: patient.mrn, name: `${values.firstName} ${values.lastName}` });
      toast.success("Patient registered");
    } catch (error) {
      toast.error(errorMessage(error, "Could not register the patient."));
    }
  };

  const copyMrn = () => {
    if (!registered) return;
    void navigator.clipboard.writeText(registered.mrn).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (registered) {
    return (
      <div className="p-6 max-w-[600px] mx-auto">
        <div className="bg-card border border-border rounded-2xl p-6 text-center py-12">
          <div className="w-[72px] h-[72px] rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
            <CheckCircle size={36} color="#16a34a" />
          </div>
          <h2 className="text-[26px] font-extrabold text-foreground mb-2 font-['Plus_Jakarta_Sans',sans-serif]">
            Patient Registered!
          </h2>
          <p className="text-muted-foreground text-[15px] mb-7">
            Welcome, {registered.name}. The medical record has been created.
          </p>
          <div className="bg-muted rounded-xl py-5 px-6 mb-7 inline-block min-w-[260px]">
            <div className="text-xs text-muted-foreground mb-1.5">Medical Record Number</div>
            <div className="text-[28px] font-extrabold text-blue-600 font-mono tracking-wider">{registered.mrn}</div>
          </div>
          <div className="flex gap-2.5 justify-center">
            <button onClick={copyMrn} className="flex items-center gap-2 py-2.5 px-5 bg-muted text-foreground border border-border rounded-[10px] text-sm font-semibold cursor-pointer">
              <Copy size={14} /> {copied ? "Copied!" : "Copy MRN"}
            </button>
            <button
              onClick={() => {
                form.reset();
                setRegistered(null);
                setStep(1);
              }}
              className="flex items-center gap-2 py-2.5 px-5 bg-blue-600 text-white border-none rounded-[10px] text-sm font-semibold cursor-pointer"
            >
              Register Another Patient
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[760px] mx-auto">
      <div className="mb-7">
        <h1 className="text-2xl font-extrabold text-foreground mb-1 font-['Plus_Jakarta_Sans',sans-serif]">Register New Patient</h1>
        <p className="text-muted-foreground text-sm">
          Complete all steps to create a new patient record
          {existing.data ? ` · ${existing.data.meta.total} patients registered` : ""}
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center mb-8 gap-0">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const active = step === s.num;
          const done = step > s.num;
          return (
            <div key={s.num} className={`flex items-center ${i < STEPS.length - 1 ? "flex-1" : ""}`}>
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-200"
                  style={{ backgroundColor: done ? "#16a34a" : active ? "#2563eb" : "var(--muted)" }}
                >
                  {done ? <CheckCircle size={18} color="white" /> : <Icon size={16} color={active ? "white" : "var(--muted-foreground)"} />}
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">Step {s.num}</div>
                  <div className="text-[13px] font-bold" style={{ color: active || done ? "var(--foreground)" : "var(--muted-foreground)" }}>
                    {s.label}
                  </div>
                </div>
              </div>
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-0.5 mx-4 transition-colors duration-300" style={{ backgroundColor: done ? "#16a34a" : "var(--border)" }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-border rounded-sm mb-7">
        <div className="h-full bg-blue-600 rounded-sm transition-all duration-300" style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }} />
      </div>

      <form className="bg-card border border-border rounded-2xl p-6" onSubmit={form.handleSubmit(submit)}>
        {step === 1 && (
          <>
            <h2 className="text-[17px] font-bold text-foreground mb-5 font-['Plus_Jakarta_Sans',sans-serif]">Personal Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-[5px]">First Name</label>
                <input {...form.register("firstName")} placeholder="Jane" className={inputClass} />
                {errors.firstName && <p className="text-[11px] text-red-600 mt-1">{errors.firstName.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-[5px]">Last Name</label>
                <input {...form.register("lastName")} placeholder="Doe" className={inputClass} />
                {errors.lastName && <p className="text-[11px] text-red-600 mt-1">{errors.lastName.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-[5px]">Date of Birth</label>
                <input type="date" {...form.register("dateOfBirth")} className={inputClass} />
                {errors.dateOfBirth && <p className="text-[11px] text-red-600 mt-1">{errors.dateOfBirth.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-[5px]">Sex at Birth</label>
                <select {...form.register("sexAtBirth")} className={inputClass}>
                  {SEX_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option.replace("_", " ")}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-[5px]">SSN (last 4 stored)</label>
                <input {...form.register("ssnLast4")} placeholder="1234" maxLength={4} className={inputClass} />
                {errors.ssnLast4 && <p className="text-[11px] text-red-600 mt-1">{errors.ssnLast4.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-[5px]">Blood Type</label>
                <select {...form.register("bloodType")} className={inputClass}>
                  {BLOOD_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option.replace("_POS", "+").replace("_NEG", "−")}</option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-[17px] font-bold text-foreground mb-5 font-['Plus_Jakarta_Sans',sans-serif]">Contact &amp; Demographics</h2>
            <div className="mb-5">
              <div className="text-[13px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Contact Information</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-[5px]">Phone Number</label>
                  <input {...form.register("phone")} placeholder="(555) 000-0000" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-[5px]">Email Address</label>
                  <input type="email" {...form.register("email")} placeholder="jane@email.com" className={inputClass} />
                  {errors.email && <p className="text-[11px] text-red-600 mt-1">{errors.email.message}</p>}
                </div>
                <div className="col-span-full">
                  <label className="block text-xs font-semibold text-foreground mb-[5px]">Street Address</label>
                  <input {...form.register("addressLine1")} placeholder="123 Main St" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-[5px]">City</label>
                  <input {...form.register("city")} placeholder="Springfield" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-[5px]">State</label>
                  <input {...form.register("state")} placeholder="IL" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-[5px]">ZIP Code</label>
                  <input {...form.register("postalCode")} placeholder="62701" className={inputClass} />
                </div>
              </div>
            </div>
            <div>
              <div className="text-[13px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Clinical Details</div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-[5px]">Height (cm)</label>
                  <input type="number" {...form.register("heightCm")} placeholder="170" className={inputClass} />
                  {errors.heightCm && <p className="text-[11px] text-red-600 mt-1">{errors.heightCm.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-[5px]">Weight (kg)</label>
                  <input type="number" {...form.register("weightKg")} placeholder="70" className={inputClass} />
                  {errors.weightKg && <p className="text-[11px] text-red-600 mt-1">{errors.weightKg.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-[5px]">Search doctors</label>
                  <input
                    value={doctorSearch}
                    onChange={(e) => setDoctorSearch(e.target.value)}
                    placeholder="Filter list…"
                    className={inputClass}
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-xs font-semibold text-foreground mb-[5px]">Primary Doctor (optional)</label>
                  <select {...form.register("primaryDoctorId")} className={inputClass}>
                    <option value="">Assign later</option>
                    {(doctors.data?.rows ?? []).map((doctor) => (
                      <option key={doctor.id} value={doctor.id}>{doctor.name}{doctor.specialty ? ` · ${doctor.specialty}` : ""}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="text-[17px] font-bold text-foreground mb-5 font-['Plus_Jakarta_Sans',sans-serif]">Review &amp; Confirm</h2>
            <div className="grid grid-cols-2 gap-5 mb-6">
              {[
                {
                  title: "Personal Info",
                  rows: [
                    ["Full Name", `${values.firstName} ${values.lastName}`],
                    ["Date of Birth", values.dateOfBirth],
                    ["Sex at Birth", values.sexAtBirth.replace("_", " ")],
                    ["SSN", values.ssnLast4 ? `***-**-${values.ssnLast4.slice(-4)}` : ""],
                    ["Blood Type", values.bloodType.replace("_POS", "+").replace("_NEG", "−")],
                  ],
                },
                {
                  title: "Contact",
                  rows: [
                    ["Phone", values.phone ?? ""],
                    ["Email", values.email ?? ""],
                    ["Address", values.addressLine1 ? `${values.addressLine1}, ${values.city ?? ""}` : ""],
                    ["City / State", [values.city, values.state].filter(Boolean).join(", ")],
                  ],
                },
              ].map((block) => (
                <div key={block.title} className="bg-muted rounded-xl p-[18px]">
                  <div className="text-[13px] font-bold text-foreground mb-3">{block.title}</div>
                  {block.rows.map(([label, value]) => (
                    <div key={label} className="flex justify-between py-2 border-b border-border">
                      <span className="text-[13px] text-muted-foreground">{label}</span>
                      <span className="text-[13px] font-semibold text-foreground">{value || "—"}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="bg-blue-50 border-[1.5px] border-blue-200 rounded-xl py-3.5 px-[18px] mb-5">
              <div className="text-[13px] text-blue-800 font-semibold">An MRN is generated by the server on submission</div>
              <div className="text-xs text-blue-500 mt-1">The patient can be added to the queue once the record exists.</div>
            </div>
          </>
        )}

        <div className="flex justify-between mt-7 pt-5 border-t border-border">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="py-2.5 px-[22px] bg-muted text-foreground border border-border rounded-[10px] text-sm font-semibold disabled:cursor-default disabled:opacity-50"
          >
            Back
          </button>
          {step < 3 ? (
            <button
              type="button"
              onClick={() => void nextStep()}
              className="flex items-center gap-2 py-2.5 px-[22px] bg-blue-600 text-white border-none rounded-[10px] text-sm font-semibold cursor-pointer"
            >
              Continue <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={createPatient.isPending}
              className="flex items-center gap-2 py-2.5 px-[22px] bg-green-600 text-white border-none rounded-[10px] text-sm font-semibold cursor-pointer disabled:opacity-60"
            >
              <CheckCircle size={16} /> {createPatient.isPending ? "Submitting…" : "Submit Registration"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
