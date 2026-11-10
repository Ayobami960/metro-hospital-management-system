/**
 * View / edit one managed account: profile fields, department, assigned role,
 * suspension and invitation lifecycle. The backend re-checks every restriction
 * (role assignment, super-admin protection, self-management).
 */
import { useEffect, useState } from "react";
import { Ban, CheckCircle2, KeyRound, Loader2, Mail, RotateCcw, Save, X } from "lucide-react";
import { toast } from "sonner";

import { QueryError, QueryLoading } from "@/components/globals/query-state";
import { errorMessage } from "@/services/api/api-error";
import { formatDateTime, label as toLabel } from "@/lib/format";
import type { Role } from "@/types/api.types";
import type { Department, Specialty } from "@/services/administration/administration.api";
import {
  useChangeUserRole,
  useManagedUser,
  useResendInvitation,
  useRevokeInvitation,
  useSetStaffStatus,
  useUpdateManagedUser,
} from "@/hooks/auth/use-session";

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none transition-colors focus:border-blue-600";

const STAFF_ROLES: Role[] = ["DOCTOR", "NURSE", "RECEPTION", "PHARMACY", "LABORATORY", "BILLING"];

function Chip({ tone, children }: { tone: "green" | "amber" | "red" | "slate"; children: React.ReactNode }) {
  const styles = {
    green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
    red: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
    slate: "bg-muted text-muted-foreground",
  } as const;
  return <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${styles[tone]}`}>{children}</span>;
}

export function UserDetailModal({
  userId,
  actorRole,
  roles,
  departments,
  specialties,
  onClose,
}: {
  userId: string;
  actorRole: Role;
  roles: Role[];
  departments: Department[];
  specialties: Specialty[];
  onClose: () => void;
}) {
  const detail = useManagedUser(userId);
  const update = useUpdateManagedUser(userId);
  const changeRole = useChangeUserRole(userId);
  const setStatus = useSetStaffStatus();
  const resend = useResendInvitation();
  const revoke = useRevokeInvitation();

  const [form, setForm] = useState({
    name: "",
    phone: "",
    hospitalId: "",
    departmentId: "",
    specialtyId: "",
    title: "",
    employeeId: "",
    ward: "",
    licenseNumber: "",
  });
  const [role, setRole] = useState<Role | "">("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const data = detail.data;
    if (!data) return;
    setForm({
      name: data.name,
      phone: data.phone ?? "",
      hospitalId: data.hospitalId ?? "",
      departmentId: data.departmentId ?? "",
      specialtyId: data.specialtyId ?? "",
      title: data.title ?? "",
      employeeId: data.employeeId ?? "",
      ward: data.ward ?? "",
      licenseNumber: data.licenseNumber ?? "",
    });
    setRole(data.role);
  }, [detail.data]);

  const data = detail.data;
  const isStaff = data ? STAFF_ROLES.includes(data.role) : false;
  const actorIsSuper = actorRole === "SUPER_ADMIN";
  const roleOptions = Array.from(
    new Set<Role>([...roles, ...(actorIsSuper && data ? [data.role, "ADMIN" as Role] : [])]),
  );

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!data) return;
    setError(null);
    try {
      await update.mutateAsync({
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        hospitalId: form.hospitalId.trim() || null,
        departmentId: isStaff ? form.departmentId || null : null,
        specialtyId: isStaff ? form.specialtyId || null : null,
        title: isStaff ? form.title.trim() || null : null,
        employeeId: isStaff ? form.employeeId.trim() || null : null,
        ward: isStaff ? form.ward.trim() || null : null,
        licenseNumber: isStaff ? form.licenseNumber.trim() || null : null,
      });
      toast.success("User details updated.");
    } catch (caught) {
      const message = errorMessage(caught, "Could not update the user.");
      setError(message);
      toast.error(message);
    }
  };

  const applyRole = async () => {
    if (!role || !data || role === data.role) return;
    try {
      await changeRole.mutateAsync(role);
      toast.success(`Role changed to ${toLabel(role)}. The user must complete onboarding again.`);
    } catch (caught) {
      toast.error(errorMessage(caught, "Could not change the role."));
    }
  };

  const changeStatus = (status: "ACTIVE" | "SUSPENDED") => {
    setStatus.mutate(
      { userId, status },
      {
        onSuccess: () => toast.success(status === "ACTIVE" ? "Account reactivated." : "Account suspended."),
        onError: (caught) => toast.error(errorMessage(caught, "Could not update the account.")),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center">
      <div className="w-full max-w-3xl rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-extrabold text-foreground">
              {data ? data.name : "User details"}
            </h2>
            <p className="truncate text-xs text-muted-foreground">{data?.email ?? "Loading…"}</p>
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

        <div className="max-h-[75vh] overflow-y-auto p-5">
          {detail.isLoading && <QueryLoading text="Loading user…" />}
          {detail.isError && <QueryError error={detail.error} onRetry={() => void detail.refetch()} />}

          {data && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone="slate">{toLabel(data.role)}</Chip>
                <Chip
                  tone={
                    data.status === "ACTIVE"
                      ? "green"
                      : data.status === "INVITED"
                        ? "amber"
                        : data.status === "SUSPENDED"
                          ? "red"
                          : "slate"
                  }
                >
                  {toLabel(data.status)}
                </Chip>
                <Chip tone={data.emailVerified ? "green" : "amber"}>
                  {data.emailVerified ? "Email verified" : "Email unverified"}
                </Chip>
                <Chip tone={data.profileCompleted ? "green" : "amber"}>
                  {data.profileCompleted ? "Profile complete" : "Profile incomplete"}
                </Chip>
                {data.invitation && (
                  <Chip tone={data.invitation.status === "PENDING" ? "amber" : "slate"}>
                    Invitation {toLabel(data.invitation.status)}
                  </Chip>
                )}
              </div>

              <dl className="grid grid-cols-1 gap-3 rounded-xl bg-muted/60 p-4 text-[13px] sm:grid-cols-2">
                {[
                  ["Department", data.departmentName ?? "—"],
                  ["Hospital ID", data.hospitalId ?? "—"],
                  ["MRN", data.mrn ?? "—"],
                  ["Created", formatDateTime(data.createdAt)],
                  ["Last sign-in", data.lastLoginAt ? formatDateTime(data.lastLoginAt) : "Never"],
                  [
                    "Invitation expires",
                    data.invitation ? formatDateTime(data.invitation.expiresAt) : "—",
                  ],
                ].map(([term, value]) => (
                  <div key={term} className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{term}</dt>
                    <dd className="text-right font-semibold text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>

              {data.role === "PATIENT" && (
                <div className="rounded-xl border border-border p-4 text-[13px]">
                  <h3 className="mb-2 text-sm font-bold text-foreground">Patient information</h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <p><span className="text-muted-foreground">Name: </span>{data.patientFirstName ?? "—"} {data.patientLastName ?? ""}</p>
                    <p><span className="text-muted-foreground">Date of birth: </span>{data.dateOfBirth ?? "—"}</p>
                    <p><span className="text-muted-foreground">Phone: </span>{data.patientPhone ?? "—"}</p>
                  </div>
                  {!data.profileCompleted && (
                    <p className="mt-2 text-xs text-amber-600">
                      Dashboard access is blocked until the patient completes the mandatory profile.
                    </p>
                  )}
                </div>
              )}

              <form onSubmit={save} className="space-y-4">
                <h3 className="text-sm font-bold text-foreground">Edit details</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-muted-foreground">Full name</span>
                    <input
                      value={form.name}
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                      className={inputClass}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-muted-foreground">Phone</span>
                    <input
                      value={form.phone}
                      onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                      className={inputClass}
                    />
                  </label>
                  {isStaff && (
                    <>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-muted-foreground">Hospital staff ID</span>
                        <input
                          value={form.hospitalId}
                          onChange={(event) => setForm((current) => ({ ...current, hospitalId: event.target.value }))}
                          className={`${inputClass} font-mono`}
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-muted-foreground">Department</span>
                        <select
                          value={form.departmentId}
                          onChange={(event) => setForm((current) => ({ ...current, departmentId: event.target.value }))}
                          className={inputClass}
                        >
                          <option value="">No department</option>
                          {departments.map((department) => (
                            <option key={department.id} value={department.id}>
                              {department.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-muted-foreground">Specialty</span>
                        <select
                          value={form.specialtyId}
                          onChange={(event) => setForm((current) => ({ ...current, specialtyId: event.target.value }))}
                          className={inputClass}
                        >
                          <option value="">No specialty</option>
                          {specialties.map((specialty) => (
                            <option key={specialty.id} value={specialty.id}>
                              {specialty.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-muted-foreground">Job title</span>
                        <input
                          value={form.title}
                          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                          className={inputClass}
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-muted-foreground">Employee ID</span>
                        <input
                          value={form.employeeId}
                          onChange={(event) => setForm((current) => ({ ...current, employeeId: event.target.value }))}
                          className={inputClass}
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-muted-foreground">Ward / unit</span>
                        <input
                          value={form.ward}
                          onChange={(event) => setForm((current) => ({ ...current, ward: event.target.value }))}
                          className={inputClass}
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-muted-foreground">License number</span>
                        <input
                          value={form.licenseNumber}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, licenseNumber: event.target.value }))
                          }
                          className={inputClass}
                        />
                      </label>
                    </>
                  )}
                </div>

                {error && <p role="alert" className="text-xs font-medium text-destructive">{error}</p>}

                <button
                  type="submit"
                  disabled={update.isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-60"
                >
                  {update.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save details
                </button>
              </form>

              <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
                <div className="rounded-xl border border-border p-4">
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
                    <KeyRound size={15} /> Role assignment
                  </h3>
                  <p className="mb-3 text-[11px] text-muted-foreground">
                    Changing the role revokes active sessions and requires the new role's onboarding.
                  </p>
                  <div className="flex gap-2">
                    <select
                      value={role}
                      onChange={(event) => setRole(event.target.value as Role)}
                      className={inputClass}
                    >
                      {roleOptions.map((option) => (
                        <option key={option} value={option}>
                          {toLabel(option)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={applyRole}
                      disabled={changeRole.isPending || role === data.role}
                      className="shrink-0 rounded-lg bg-foreground px-3 py-2 text-xs font-bold text-background transition hover:opacity-90 disabled:opacity-40"
                    >
                      Apply
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-border p-4">
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
                    <Ban size={15} /> Account actions
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {data.status === "ACTIVE" || data.status === "INVITED" ? (
                      <button
                        type="button"
                        onClick={() => changeStatus("SUSPENDED")}
                        disabled={setStatus.isPending}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-red-100 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-200 disabled:opacity-50"
                      >
                        <Ban size={13} /> Suspend user
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => changeStatus("ACTIVE")}
                        disabled={setStatus.isPending}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-200 disabled:opacity-50"
                      >
                        <CheckCircle2 size={13} /> Reactivate user
                      </button>
                    )}

                    {data.invitation?.status === "PENDING" && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            resend.mutate(data.invitation!.id, {
                              onSuccess: (result) =>
                                toast.success(
                                  result.delivered ? "Invitation re-sent." : "Could not send the invitation email.",
                                ),
                              onError: (caught) =>
                                toast.error(errorMessage(caught, "Could not resend the invitation.")),
                            })
                          }
                          disabled={resend.isPending}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold text-foreground transition hover:bg-muted disabled:opacity-50"
                        >
                          <RotateCcw size={13} /> Resend invitation
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            revoke.mutate(data.invitation!.id, {
                              onSuccess: () => toast.success("Invitation revoked."),
                              onError: (caught) =>
                                toast.error(errorMessage(caught, "Could not revoke the invitation.")),
                            })
                          }
                          disabled={revoke.isPending}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold text-foreground transition hover:bg-muted disabled:opacity-50"
                        >
                          <Mail size={13} /> Revoke invitation
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
