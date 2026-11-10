/**
 * Create / Invite user modal.
 *
 * Both account-creation methods use the invitation mechanism: the account is
 * provisioned in a pending state and only the emailed single-use link can set a
 * password. "Create" collects the full profile; "Invite" collects essentials.
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2, Mail, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

import { errorMessage } from "@/services/api/api-error";
import { label as toLabel } from "@/lib/format";
import type { Role } from "@/types/api.types";
import type { Department, Specialty } from "@/services/administration/administration.api";
import { useCreateUser, useInviteStaff } from "@/hooks/auth/use-session";

const STAFF_ROLES: Role[] = ["DOCTOR", "NURSE", "RECEPTION", "PHARMACY", "LABORATORY", "BILLING"];

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-[13px] text-foreground outline-none transition-colors focus:border-blue-600";

export interface UserFormModalProps {
  open: boolean;
  initialMode: "CREATE" | "INVITE";
  roles: Role[];
  departments: Department[];
  specialties: Specialty[];
  onClose: () => void;
  onCreated: () => void;
}

const EMPTY = {
  name: "",
  email: "",
  phone: "",
  role: "" as Role | "",
  departmentId: "",
  specialtyId: "",
  hospitalId: "",
  employeeId: "",
  title: "",
  licenseNumber: "",
};

export function UserFormModal({
  open,
  initialMode,
  roles,
  departments,
  specialties,
  onClose,
  onCreated,
}: UserFormModalProps) {
  const [mode, setMode] = useState<"CREATE" | "INVITE">(initialMode);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const createUser = useCreateUser();
  const inviteStaff = useInviteStaff();

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setForm(EMPTY);
      setError(null);
    }
  }, [open, initialMode]);

  const isPatient = form.role === "PATIENT";
  const isStaff = STAFF_ROLES.includes(form.role as Role);
  const isDoctor = form.role === "DOCTOR";
  const pending = createUser.isPending || inviteStaff.isPending;

  const availableRoles = useMemo(
    () => (roles.length > 0 ? roles : STAFF_ROLES),
    [roles],
  );

  if (!open) return null;

  const update = (key: keyof typeof EMPTY, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (error) setError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.role) return setError("Select the role for this account.");
    if (form.name.trim().length < 2) return setError("Enter the user's full name.");
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return setError("Enter a valid email address.");
    if (isStaff && form.hospitalId.replace(/[^a-zA-Z0-9]/g, "").length < 3) {
      return setError("Enter a valid hospital staff ID.");
    }
    if (mode === "CREATE" && isStaff && !form.departmentId) {
      return setError("Select the user's department.");
    }
    if (isDoctor && mode === "CREATE" && !form.specialtyId) {
      return setError("Select the medical specialty.");
    }

    const payload = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      role: form.role,
      ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
      ...(isStaff && form.hospitalId.trim() ? { hospitalId: form.hospitalId.trim() } : {}),
      ...(isStaff && form.departmentId ? { departmentId: form.departmentId } : {}),
      ...(isDoctor && form.specialtyId ? { specialtyId: form.specialtyId } : {}),
      ...(isStaff && form.employeeId.trim() ? { employeeId: form.employeeId.trim() } : {}),
      ...(isStaff && form.title.trim() ? { title: form.title.trim() } : {}),
      ...(isStaff && form.licenseNumber.trim() ? { licenseNumber: form.licenseNumber.trim() } : {}),
    };

    try {
      const result =
        mode === "CREATE"
          ? await createUser.mutateAsync(payload)
          : await inviteStaff.mutateAsync(payload);
      toast.success(
        result.delivered
          ? `Invitation emailed to ${result.email} as ${toLabel(result.role)}.`
          : `Account created for ${result.email}, but the email could not be sent. Use “Resend invitation”.`,
      );
      onCreated();
      onClose();
    } catch (caught) {
      const message = errorMessage(caught, "Could not create the account.");
      setError(message);
      toast.error(message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div>
            <h2 className="text-lg font-extrabold text-foreground">
              {mode === "CREATE" ? "Create user" : "Invite user"}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              The account stays pending until the invited user creates a password and completes onboarding.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4 p-5" noValidate>
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
            {(["CREATE", "INVITE"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setMode(option)}
                className={
                  "flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition " +
                  (mode === option ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")
                }
              >
                {option === "CREATE" ? <UserPlus size={14} /> : <Mail size={14} />}
                {option === "CREATE" ? "Create User" : "Invite User"}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-foreground">
                Full name <span className="text-red-500">*</span>
              </span>
              <input
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
                className={inputClass}
                autoComplete="name"
                placeholder="Dr. Jane Doe"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-foreground">
                Email address <span className="text-red-500">*</span>
              </span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => update("email", event.target.value)}
                className={inputClass}
                autoComplete="email"
                placeholder="jane.doe@mgh.org"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-foreground">Phone number</span>
              <input
                type="tel"
                value={form.phone}
                onChange={(event) => update("phone", event.target.value)}
                className={inputClass}
                autoComplete="tel"
                placeholder="+1 555 010 2030"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-foreground">
                Role <span className="text-red-500">*</span>
              </span>
              <select
                value={form.role}
                onChange={(event) => {
                  update("role", event.target.value);
                  if (event.target.value === "PATIENT") {
                    setForm((current) => ({
                      ...current,
                      role: "PATIENT",
                      hospitalId: "",
                      departmentId: "",
                      specialtyId: "",
                      employeeId: "",
                      title: "",
                      licenseNumber: "",
                    }));
                  }
                }}
                className={inputClass}
              >
                <option value="">Select role</option>
                {availableRoles.map((role) => (
                  <option key={role} value={role}>
                    {toLabel(role)}
                  </option>
                ))}
              </select>
            </label>

            {isStaff && (
              <>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-semibold text-foreground">
                    Hospital staff ID <span className="text-red-500">*</span>
                  </span>
                  <input
                    value={form.hospitalId}
                    onChange={(event) => update("hospitalId", event.target.value)}
                    className={`${inputClass} font-mono`}
                    placeholder="MGH-1024"
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-semibold text-foreground">
                    Department{" "}
                    {mode === "CREATE" && <span className="text-red-500">*</span>}
                  </span>
                  <select
                    value={form.departmentId}
                    onChange={(event) => update("departmentId", event.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select department</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </label>

                {isDoctor && (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[13px] font-semibold text-foreground">
                      Medical specialty{" "}
                      {mode === "CREATE" && <span className="text-red-500">*</span>}
                    </span>
                    <select
                      value={form.specialtyId}
                      onChange={(event) => update("specialtyId", event.target.value)}
                      className={inputClass}
                    >
                      <option value="">Select specialty</option>
                      {specialties.map((specialty) => (
                        <option key={specialty.id} value={specialty.id}>
                          {specialty.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {mode === "CREATE" && (
                  <>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[13px] font-semibold text-foreground">Job title</span>
                      <input
                        value={form.title}
                        onChange={(event) => update("title", event.target.value)}
                        className={inputClass}
                        placeholder="e.g. Attending Physician"
                      />
                    </label>

                    <label className="flex flex-col gap-1.5">
                      <span className="text-[13px] font-semibold text-foreground">Employee ID</span>
                      <input
                        value={form.employeeId}
                        onChange={(event) => update("employeeId", event.target.value)}
                        className={inputClass}
                        placeholder="EMP-2048"
                      />
                    </label>

                    <label className="flex flex-col gap-1.5">
                      <span className="text-[13px] font-semibold text-foreground">
                        License number{(isDoctor || form.role === "NURSE") ? "" : " (optional)"}
                      </span>
                      <input
                        value={form.licenseNumber}
                        onChange={(event) => update("licenseNumber", event.target.value)}
                        className={inputClass}
                        placeholder="e.g. IL-123456"
                      />
                    </label>
                  </>
                )}
              </>
            )}

            {isPatient && (
              <div className="sm:col-span-2 rounded-xl bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
                The patient will receive an invitation, verify their email and complete the mandatory five-step
                patient profile before the patient dashboard opens.
              </div>
            )}
          </div>

          {error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending && <Loader2 size={15} className="animate-spin" />}
              {mode === "CREATE" ? "Create and send invitation" : "Send invitation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
