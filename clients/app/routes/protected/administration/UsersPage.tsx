/**
 * Admin → User Management.
 *
 * Central place to create/invite hospital users, see live database statistics,
 * search/filter/sort accounts, and manage profile, department, role, status and
 * invitation lifecycle. Every mutation is authorized again on the backend.
 */
import { useState } from "react";
import {
  ArrowUpDown,
  Calendar,
  CheckCircle2,
  Eye,
  Mail,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
  UserX,
} from "lucide-react";
import { toast } from "sonner";

import { UserFormModal } from "@/components/administration/UserFormModal";
import { UserDetailModal } from "@/components/administration/UserDetailModal";
import { QueryError, QueryLoading } from "@/components/globals/query-state";
import { ServerPager } from "@/components/globals/server-pager";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useDepartments, useSpecialties } from "@/hooks/administration/administration.hooks";
import {
  useInvitableRoles,
  useManagedUsers,
  usePendingInvitations,
  useResendInvitation,
  useRevokeInvitation,
  useSession,
  useUserStatistics,
} from "@/hooks/auth/use-session";
import { errorMessage } from "@/services/api/api-error";
import { formatDateTime, label as toLabel } from "@/lib/format";
import type { ManagedUserParams, Role, UserStatistics } from "@/types/api.types";

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none transition-colors focus:border-blue-600";

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  INVITED: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  SUSPENDED: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  LOCKED: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  DEACTIVATED: "bg-muted text-muted-foreground",
};

const STAT_LABELS: Array<{ key: keyof UserStatistics; label: string }> = [
  { key: "total", label: "Total Users" },
  { key: "active", label: "Active Users" },
  { key: "pending", label: "Pending Users" },
  { key: "pendingInvitations", label: "Pending Invitations" },
  { key: "suspended", label: "Suspended Users" },
  { key: "doctors", label: "Total Doctors" },
  { key: "nurses", label: "Total Nurses" },
  { key: "patients", label: "Total Patients" },
];

export default function UsersPage() {
  const session = useSession();
  const actorRole = (session.data?.role as Role | undefined) ?? "ADMIN";

  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [verified, setVerified] = useState("");
  const [profileComplete, setProfileComplete] = useState("");
  const [sort, setSort] = useState<NonNullable<ManagedUserParams["sort"]>>("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"CREATE" | "INVITE">("INVITE");
  const [detailId, setDetailId] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(search);
  const params: ManagedUserParams = {
    page,
    pageSize: 20,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(role ? { role } : {}),
    ...(status ? { status } : {}),
    ...(departmentId ? { departmentId } : {}),
    ...(verified ? { verified: verified as "true" | "false" } : {}),
    ...(profileComplete ? { profileComplete: profileComplete as "true" | "false" } : {}),
    sort,
    order,
  };

  const users = useManagedUsers(params);
  const statistics = useUserStatistics();
  const invitations = usePendingInvitations();
  const roles = useInvitableRoles();
  const departments = useDepartments({ pageSize: 100 });
  const specialties = useSpecialties({ pageSize: 100 });
  const resend = useResendInvitation();
  const revoke = useRevokeInvitation();

  const rows = users.data?.rows ?? [];
  const stats = statistics.data;

  const resetPage = () => setPage(1);

  const toggleSort = (column: NonNullable<ManagedUserParams["sort"]>) => {
    if (sort === column) {
      setOrder((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSort(column);
      setOrder("asc");
    }
    resetPage();
  };

  const openCreate = (mode: "CREATE" | "INVITE") => {
    setFormMode(mode);
    setFormOpen(true);
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-extrabold text-foreground">User Management</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Create, invite, and manage hospital users across all departments from one centralized platform.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openCreate("CREATE")}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-bold text-foreground transition hover:bg-muted"
          >
            <UserPlus size={16} /> Create User
          </button>
          <button
            type="button"
            onClick={() => openCreate("INVITE")}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
          >
            <Mail size={16} /> Invite User
          </button>
        </div>
      </div>

      {/* Statistics */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {STAT_LABELS.map(({ key, label }) => (
          <div key={key} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-extrabold text-foreground">
              {statistics.isLoading ? "—" : (stats?.[key] ?? 0)}
            </p>
          </div>
        ))}
      </div>

      {statistics.isError && (
        <div className="mb-4">
          <QueryError error={statistics.error} onRetry={() => void statistics.refetch()} />
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 rounded-2xl border border-border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-12">
          <div className="relative md:col-span-4">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                resetPage();
              }}
              placeholder="Search name, email, hospital ID or MRN…"
              className={`${inputClass} pl-9`}
            />
          </div>
          <select
            value={role}
            onChange={(event) => {
              setRole(event.target.value);
              resetPage();
            }}
            className={`${inputClass} md:col-span-2`}
            aria-label="Filter by role"
          >
            <option value="">All roles</option>
            {(roles.data ?? []).map((option) => (
              <option key={option} value={option}>
                {toLabel(option)}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              resetPage();
            }}
            className={`${inputClass} md:col-span-2`}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {["ACTIVE", "INVITED", "SUSPENDED", "LOCKED", "DEACTIVATED"].map((option) => (
              <option key={option} value={option}>
                {toLabel(option)}
              </option>
            ))}
          </select>
          <select
            value={departmentId}
            onChange={(event) => {
              setDepartmentId(event.target.value);
              resetPage();
            }}
            className={`${inputClass} md:col-span-2`}
            aria-label="Filter by department"
          >
            <option value="">All departments</option>
            {(departments.data?.rows ?? []).map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
          <select
            value={verified}
            onChange={(event) => {
              setVerified(event.target.value);
              resetPage();
            }}
            className={`${inputClass} md:col-span-2`}
            aria-label="Filter by email verification"
          >
            <option value="">Any verification</option>
            <option value="true">Verified</option>
            <option value="false">Unverified</option>
          </select>
          <select
            value={profileComplete}
            onChange={(event) => {
              setProfileComplete(event.target.value);
              resetPage();
            }}
            className={`${inputClass} md:col-span-3`}
            aria-label="Filter by profile status"
          >
            <option value="">Any profile status</option>
            <option value="true">Profile complete</option>
            <option value="false">Profile incomplete</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border bg-card p-5">
        {users.isLoading && <QueryLoading text="Loading users…" />}
        {users.isError && <QueryError error={users.error} onRetry={() => void users.refetch()} />}

        {!users.isLoading && !users.isError && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-[13px]">
              <thead>
                <tr className="border-b-2 border-border">
                  {(
                    [
                      ["User", "name"],
                      ["Email", "email"],
                      ["Role", "role"],
                      ["Department", null],
                      ["Status", "status"],
                      ["Profile Status", null],
                      ["Email Verification", null],
                      ["Date Created", "createdAt"],
                      ["Actions", null],
                    ] as Array<[string, ManagedUserParams["sort"] | null]>
                  ).map(([heading, column]) => (
                    <th key={heading} className="px-3 py-2 text-left text-xs font-bold text-muted-foreground">
                      {column ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(column)}
                          className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                          {heading}
                          <ArrowUpDown size={12} />
                        </button>
                      ) : (
                        heading
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((user) => (
                  <tr key={user.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2.5">
                        {user.image ? (
                          <img
                            src={user.image}
                            alt=""
                            className="size-8 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground">
                            {user.name
                              .split(/\s+/)
                              .filter(Boolean)
                              .slice(0, 2)
                              .map((part) => part[0]?.toUpperCase())
                              .join("")}
                          </span>
                        )}
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => setDetailId(user.id)}
                            className="text-left font-bold text-foreground hover:text-blue-600"
                          >
                            {user.name}
                          </button>
                          {user.mrn && <div className="text-[11px] text-muted-foreground">MRN {user.mrn}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{user.email}</td>
                    <td className="px-3 py-3 text-foreground">{toLabel(user.role)}</td>
                    <td className="px-3 py-3 text-muted-foreground">{user.departmentName ?? "—"}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_STYLES[user.status] ?? STATUS_STYLES.DEACTIVATED}`}
                      >
                        {toLabel(user.status)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold ${user.profileCompleted ? "text-emerald-600" : "text-amber-600"}`}
                      >
                        {user.profileCompleted ? <CheckCircle2 size={13} /> : <Users size={13} />}
                        {user.profileCompleted ? "Complete" : "Incomplete"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`text-[11px] font-semibold ${user.emailVerified ? "text-emerald-600" : "text-amber-600"}`}>
                        {user.emailVerified ? "Verified" : "Unverified"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{formatDateTime(user.createdAt)}</td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => setDetailId(user.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] font-semibold text-foreground transition hover:bg-muted"
                      >
                        <Eye size={12} /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No users match these filters.
              </div>
            )}
          </div>
        )}

        <ServerPager meta={users.data?.meta} onPageChange={setPage} />
      </div>

      {/* Pending invitations */}
      <div className="mt-5 rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck size={16} className="text-muted-foreground" />
          <h2 className="text-sm font-bold text-foreground">Pending invitations</h2>
        </div>
        {invitations.isLoading && <QueryLoading text="Loading invitations…" />}
        {invitations.isError && (
          <QueryError error={invitations.error} onRetry={() => void invitations.refetch()} />
        )}
        {invitations.data?.length === 0 && (
          <p className="text-[13px] text-muted-foreground">No invitations are waiting to be accepted.</p>
        )}
        <div className="flex flex-col gap-2">
          {(invitations.data ?? []).map((invitation) => (
            <div
              key={invitation.id}
              className="flex flex-wrap items-center gap-3 rounded-xl bg-muted px-3 py-2.5 text-[13px]"
            >
              <Calendar size={15} className="text-amber-600" />
              <div className="min-w-[200px] flex-1">
                <div className="font-bold text-foreground">{invitation.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {invitation.email} · {toLabel(invitation.role)}
                  {invitation.hospitalId ? ` · ${invitation.hospitalId}` : ""}
                </div>
              </div>
              <span className="text-[11px] text-muted-foreground">
                Expires {formatDateTime(invitation.expiresAt)}
              </span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    resend.mutate(invitation.id, {
                      onSuccess: (result) =>
                        toast.success(result.delivered ? "Invitation re-sent." : "Could not send the invitation email."),
                      onError: (error) => toast.error(errorMessage(error, "Could not resend the invitation.")),
                    })
                  }
                  disabled={resend.isPending}
                  className="rounded-md border border-border bg-card px-2.5 py-1.5 text-[11px] font-semibold text-foreground disabled:opacity-40"
                >
                  Resend
                </button>
                <button
                  type="button"
                  onClick={() =>
                    revoke.mutate(invitation.id, {
                      onSuccess: () => toast.success("Invitation revoked."),
                      onError: (error) => toast.error(errorMessage(error, "Could not revoke the invitation.")),
                    })
                  }
                  disabled={revoke.isPending}
                  className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2.5 py-1.5 text-[11px] font-semibold text-red-700 disabled:opacity-40"
                >
                  <UserX size={12} /> Revoke
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <UserFormModal
        open={formOpen}
        initialMode={formMode}
        roles={roles.data ?? []}
        departments={departments.data?.rows ?? []}
        specialties={specialties.data?.rows ?? []}
        onClose={() => setFormOpen(false)}
        onCreated={() => {
          void users.refetch();
          void statistics.refetch();
          void invitations.refetch();
        }}
      />

      {detailId && (
        <UserDetailModal
          userId={detailId}
          actorRole={actorRole}
          roles={roles.data ?? []}
          departments={departments.data?.rows ?? []}
          specialties={specialties.data?.rows ?? []}
          onClose={() => {
            setDetailId(null);
            void users.refetch();
            void statistics.refetch();
          }}
        />
      )}
    </div>
  );
}
