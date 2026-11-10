/**
 * Staff accounts and invitations (administrators).
 *
 * Staff never self-register: this screen creates the account, emails a
 * single-use invitation link, and can resend or revoke it.
 */
import { useState } from "react";
import { CheckCircle2, Mail, Search, ShieldCheck, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

import { QueryError, QueryLoading } from "@/components/globals/query-state";
import { ServerPager } from "@/components/globals/server-pager";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { errorMessage } from "@/services/api/api-error";
import { formatDateTime, label as toLabel } from "@/lib/format";
import {
  useInvitableRoles,
  useInviteStaff,
  usePendingInvitations,
  useResendInvitation,
  useRevokeInvitation,
  useSetStaffStatus,
  useStaffAccounts,
} from "@/hooks/auth/use-session";
import type { Role } from "@/types/api.types";

const inputClass =
  "w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-[13px] text-foreground outline-none focus:border-blue-600 transition-colors box-border";

const EMPTY_FORM = { name: "", email: "", role: "" as Role | "", hospitalId: "", phone: "" };

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  ACTIVE: { bg: "#dcfce7", text: "#16a34a" },
  INVITED: { bg: "#fef9c3", text: "#ca8a04" },
  SUSPENDED: { bg: "#fee2e2", text: "#dc2626" },
  LOCKED: { bg: "#fee2e2", text: "#dc2626" },
  DEACTIVATED: { bg: "#f1f5f9", text: "#64748b" },
};

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const debouncedSearch = useDebouncedValue(search);
  const staff = useStaffAccounts({ page, pageSize: 20, search: debouncedSearch || undefined });
  const invitations = usePendingInvitations();
  const roles = useInvitableRoles();
  const invite = useInviteStaff();
  const resend = useResendInvitation();
  const revoke = useRevokeInvitation();
  const setStatus = useSetStaffStatus();

  const rows = staff.data?.rows ?? [];
  const meta = staff.data?.meta;

  const submitInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.role) {
      toast.error("Choose a role for this account.");
      return;
    }
    try {
      const result = await invite.mutateAsync({
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        hospitalId: form.hospitalId.trim(),
        phone: form.phone.trim() || undefined,
      });
      toast.success(
        result.delivered
          ? `Invitation emailed to ${result.email}`
          : "Invitation created, but the email could not be sent. Use resend.",
      );
      setOpen(false);
      setForm(EMPTY_FORM);
    } catch (error) {
      toast.error(errorMessage(error, "Could not create the invitation."));
    }
  };

  const changeStatus = (userId: string, status: string) => {
    setStatus.mutate(
      { userId, status },
      {
        onSuccess: () => toast.success("Account status updated"),
        onError: (error) => toast.error(errorMessage(error, "Could not update the account.")),
      },
    );
  };

  return (
    <div className="p-6">
      <div className="flex flex-wrap justify-between items-start gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground mb-1">Staff Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Invite staff with a single-use link, control access and audit sign-in factors
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white border-none rounded-xl cursor-pointer font-bold text-sm hover:bg-blue-700 transition-colors"
          >
            <UserPlus size={16} /> Invite staff
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 mb-4 flex gap-3 items-center">
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search by name, email or hospital ID…"
            className="w-full pl-9 pr-3 py-2 bg-muted border border-border rounded-lg text-[13px] text-foreground outline-none focus:border-blue-600 transition-colors"
          />
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 mb-4">
        {staff.isLoading && <QueryLoading text="Loading staff accounts…" />}
        {staff.isError && <QueryError error={staff.error} onRetry={() => void staff.refetch()} />}

        {!staff.isLoading && !staff.isError && (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b-2 border-border">
                  {["Staff", "Role", "Hospital ID", "Status", "2FA", "Last sign-in", "Actions"].map((heading) => (
                    <th key={heading} className="text-left py-2 px-3.5 text-xs font-bold text-muted-foreground">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((account) => {
                  const style = STATUS_STYLES[account.status] ?? STATUS_STYLES.DEACTIVATED;
                  return (
                    <tr key={account.id} className="border-b border-border">
                      <td className="py-3.5 px-3.5">
                        <div className="font-bold text-foreground">{account.name}</div>
                        <div className="text-[11px] text-muted-foreground">{account.email}</div>
                      </td>
                      <td className="py-3.5 px-3.5 text-muted-foreground">{toLabel(account.role)}</td>
                      <td className="py-3.5 px-3.5 font-mono text-xs text-foreground">
                        {account.hospitalId ?? "—"}
                      </td>
                      <td className="py-3.5 px-3.5">
                        <span
                          className="text-[11px] font-bold px-2.5 py-0.5 rounded-full"
                          style={{ backgroundColor: style.bg, color: style.text }}
                        >
                          {toLabel(account.status)}
                        </span>
                      </td>
                      <td className="py-3.5 px-3.5">
                        {account.twoFactorEnabled ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#16a34a]">
                            <ShieldCheck size={13} /> On
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">Off</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3.5 text-muted-foreground">
                        {account.lastLoginAt ? formatDateTime(account.lastLoginAt) : "Never"}
                      </td>
                      <td className="py-3.5 px-3.5">
                        {account.status === "ACTIVE" ? (
                          <button
                            onClick={() => changeStatus(account.id, "SUSPENDED")}
                            disabled={setStatus.isPending}
                            className="px-2.5 py-1.5 bg-red-100 text-red-600 border-none rounded-md cursor-pointer text-[11px] font-semibold hover:bg-red-200 transition-colors disabled:opacity-40"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            onClick={() => changeStatus(account.id, "ACTIVE")}
                            disabled={setStatus.isPending}
                            className="px-2.5 py-1.5 bg-green-100 text-green-700 border-none rounded-md cursor-pointer text-[11px] font-semibold hover:bg-green-200 transition-colors disabled:opacity-40"
                          >
                            Reactivate
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">No staff accounts match your search.</div>
            )}
          </div>
        )}

        <ServerPager meta={meta} onPageChange={setPage} />
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Mail size={16} className="text-muted-foreground" />
          <h2 className="text-sm font-bold text-foreground">Pending invitations</h2>
        </div>
        {invitations.isLoading && <QueryLoading text="Loading invitations…" />}
        {invitations.isError && (
          <QueryError error={invitations.error} onRetry={() => void invitations.refetch()} />
        )}
        {invitations.data && invitations.data.length === 0 && (
          <p className="text-[13px] text-muted-foreground">No invitations are waiting to be accepted.</p>
        )}
        <div className="flex flex-col gap-2">
          {(invitations.data ?? []).map((invitation) => (
            <div
              key={invitation.id}
              className="flex flex-wrap items-center gap-3 p-3 bg-muted rounded-xl text-[13px]"
            >
              <CheckCircle2 size={15} className="text-[#ca8a04]" />
              <div className="flex-1 min-w-[200px]">
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
                  onClick={() =>
                    resend.mutate(invitation.id, {
                      onSuccess: (result) =>
                        toast.success(
                          result.delivered ? "Invitation re-sent" : "Could not send the invitation email",
                        ),
                      onError: (error) => toast.error(errorMessage(error, "Could not resend the invitation.")),
                    })
                  }
                  disabled={resend.isPending}
                  className="px-2.5 py-1.5 bg-card border border-border text-foreground rounded-md cursor-pointer text-[11px] font-semibold disabled:opacity-40"
                >
                  Resend
                </button>
                <button
                  onClick={() =>
                    revoke.mutate(invitation.id, {
                      onSuccess: () => toast.success("Invitation revoked"),
                      onError: (error) => toast.error(errorMessage(error, "Could not revoke the invitation.")),
                    })
                  }
                  disabled={revoke.isPending}
                  className="px-2.5 py-1.5 bg-red-100 text-red-600 border-none rounded-md cursor-pointer text-[11px] font-semibold disabled:opacity-40"
                >
                  Revoke
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <form
            onSubmit={submitInvite}
            className="bg-card border border-border rounded-[20px] p-8 w-[480px] max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-extrabold text-foreground">Invite a staff member</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">Full name</label>
                <input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  required
                  className={inputClass}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">Role</label>
                <select
                  value={form.role}
                  onChange={(event) => setForm({ ...form, role: event.target.value as Role })}
                  required
                  className={inputClass}
                >
                  <option value="">Select a role</option>
                  {(roles.data ?? []).map((role) => (
                    <option key={role} value={role}>
                      {toLabel(role)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">Hospital ID</label>
                <input
                  value={form.hospitalId}
                  onChange={(event) => setForm({ ...form, hospitalId: event.target.value })}
                  placeholder="MGH-10042"
                  required
                  className={`${inputClass} uppercase`}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">Phone (optional)</label>
                <input
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  className={inputClass}
                />
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground mt-4">
              The invitation link is single use and expires automatically. The role and hospital ID
              are fixed by this invitation.
            </p>

            <div className="flex gap-2.5 mt-6 justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-5 py-2.5 bg-muted border border-border rounded-xl cursor-pointer font-semibold text-[13px] text-foreground hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={invite.isPending}
                className="px-5 py-2.5 bg-blue-600 text-white border-none rounded-xl cursor-pointer font-bold text-[13px] hover:bg-blue-700 transition-colors disabled:opacity-60"
              >
                {invite.isPending ? "Sending…" : "Send invitation"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
