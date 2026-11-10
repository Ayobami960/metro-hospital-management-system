import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  User,
  Lock,
  Bell,
  Monitor,
  Smartphone,
  Eye,
  EyeOff,
  CheckCircle,
  ShieldCheck,
  KeyRound,
  Copy,
} from "lucide-react";
import { z } from "zod";
import { QRCodeSVG } from "qrcode.react";

import {
  useMyProfile,
  useMySessions,
  useNotificationPreferences,
  useRevokeOtherSessions,
  useRevokeSession,
  useUpdateMyProfile,
  useUpdateNotificationPreferences,
} from "@/hooks/profile/profile.hooks";
import {
  useAccountStatus,
  useConfirmTotp,
  useDisableTotp,
  useEnrollTotp,
  useRegenerateRecoveryCodes,
} from "@/hooks/auth/use-session";
import { QueryError, QueryLoading } from "@/components/globals/query-state";
import { errorMessage } from "@/services/api/api-error";
import { formatDateTime, initialsOf, label as toLabel } from "@/lib/format";
import { authApi } from "@/services/auth/auth.api";

const TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "security", label: "Security", icon: Lock },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "devices", label: "Devices", icon: Monitor },
] as const;

type TabId = (typeof TABS)[number]["id"];

const profileSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  phone: z
    .string()
    .trim()
    .max(32)
    .optional()
    .refine((value) => !value || value.replace(/\D/g, "").length >= 7, "Enter a valid phone number"),
});
type ProfileValues = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Use at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm the new password"),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });
type PasswordValues = z.infer<typeof passwordSchema>;

const inputClass =
  "w-full py-2.5 px-3.5 rounded-[10px] border-[1.5px] border-border bg-card text-foreground text-sm outline-none box-border focus:border-blue-600";
const cardClass = "bg-card border border-border rounded-2xl p-7";

const PREFERENCE_FIELDS = [
  { key: "appointmentReminders", label: "Appointment reminders and updates" },
  { key: "labResults", label: "Lab results available" },
  { key: "billingAlerts", label: "New invoices and payment due" },
  { key: "marketing", label: "Hospital news and announcements" },
] as const;

const CHANNEL_FIELDS = [
  { key: "emailEnabled", label: "📧 Email" },
  { key: "smsEnabled", label: "📱 SMS" },
  { key: "pushEnabled", label: "🔔 Push" },
] as const;

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{ background: on ? "#2563eb" : "var(--border)" }}
      className="w-11 h-6 rounded-xl relative cursor-pointer transition-colors shrink-0"
    >
      <div
        className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
        style={{ left: on ? 22 : 2, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}
      />
    </div>
  );
}

/**
 * Optional TOTP second factor. Enrollment returns the otpauth URI and secret
 * once; recovery codes are shown once and stored only as digests server-side.
 */
function TwoFactorCard() {
  const status = useAccountStatus();
  const enroll = useEnrollTotp();
  const confirm = useConfirmTotp();
  const disable = useDisableTotp();
  const regenerate = useRegenerateRecoveryCodes();

  const [enrollment, setEnrollment] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  const enabled = status.data?.twoFactorEnabled ?? false;
  const isAdministrator =
    status.data?.user.role === "ADMIN" || status.data?.user.role === "SUPER_ADMIN";

  // Optional 2FA is an administrator feature in this workflow. Staff room
  // access is already verified with the Daily Access Code, and patients use
  // their emailed login code.
  if (status.data && !isAdministrator) return null;

  const start = () => {
    enroll.mutate(undefined, {
      onSuccess: (result) => {
        setEnrollment(result);
        setRecoveryCodes(null);
      },
      onError: (error) => toast.error(errorMessage(error, "Could not start two-factor enrollment.")),
    });
  };

  const finish = () => {
    if (!code.trim()) return;
    confirm.mutate(
      { code: code.trim() },
      {
        onSuccess: (result) => {
          setRecoveryCodes(result.recoveryCodes);
          setEnrollment(null);
          setCode("");
          toast.success("Two-factor authentication enabled");
        },
        onError: (error) => toast.error(errorMessage(error, "That authenticator code is not valid.")),
      },
    );
  };

  const turnOff = () => {
    if (!password) {
      toast.error("Enter your password to disable two-factor authentication.");
      return;
    }
    disable.mutate(
      { password },
      {
        onSuccess: () => {
          setPassword("");
          setRecoveryCodes(null);
          toast.success("Two-factor authentication disabled");
        },
        onError: (error) => toast.error(errorMessage(error, "Could not disable two-factor authentication.")),
      },
    );
  };

  const newCodes = () => {
    if (!password) {
      toast.error("Enter your password to regenerate recovery codes.");
      return;
    }
    regenerate.mutate(
      { password },
      {
        onSuccess: (result) => {
          setRecoveryCodes(result.recoveryCodes);
          toast.success("New recovery codes generated");
        },
        onError: (error) => toast.error(errorMessage(error, "Could not regenerate recovery codes.")),
      },
    );
  };

  const copyUri = async () => {
    if (!enrollment) return;
    try {
      await navigator.clipboard.writeText(enrollment.otpauthUri);
      toast.success("Enrollment link copied");
    } catch {
      toast.error("Could not copy the link.");
    }
  };

  return (
    <div className={cardClass}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-bold text-foreground font-['Plus_Jakarta_Sans',sans-serif]">
            Two-Factor Authentication
          </h3>
          <p className="text-[13px] text-muted-foreground mt-1">
            Authenticator app (TOTP) plus single-use recovery codes.
          </p>
        </div>
        <span
          className="text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0"
          style={{
            backgroundColor: enabled ? "#dcfce7" : "#f1f5f9",
            color: enabled ? "#16a34a" : "#64748b",
          }}
        >
          {enabled ? "Enabled" : "Optional"}
        </span>
      </div>

      {recoveryCodes && (
        <div className="p-4 bg-[#fffbeb] border border-[#fde68a] rounded-xl mb-4">
          <div className="text-sm font-bold text-[#92400e] mb-2">Save these recovery codes now</div>
          <div className="grid grid-cols-2 gap-1.5 font-mono text-[12px] text-foreground">
            {recoveryCodes.map((recoveryCode) => (
              <span key={recoveryCode}>{recoveryCode}</span>
            ))}
          </div>
          <div className="text-[11px] text-[#92400e] mt-2">
            Each code works once and cannot be shown again.
          </div>
        </div>
      )}

      {!enabled && !enrollment && (
        <button
          type="button"
          onClick={start}
          disabled={enroll.isPending}
          className="flex items-center gap-2 py-2.5 px-5 bg-blue-600 text-white border-none rounded-[10px] text-sm font-bold cursor-pointer disabled:opacity-60"
        >
          <ShieldCheck size={16} />
          {enroll.isPending ? "Preparing…" : "Enable two-factor authentication"}
        </button>
      )}

      {!enabled && enrollment && (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-muted-foreground">
            Scan this code with your authenticator app, then confirm the 6-digit code it shows.
          </p>
          <div className="flex flex-col items-center gap-2 self-start rounded-xl border border-border bg-white p-4">
            <QRCodeSVG
              value={enrollment.otpauthUri}
              size={168}
              level="M"
              marginSize={2}
              title="Scan this QR code with your authenticator app"
            />
          </div>
          <p className="text-[12px] text-muted-foreground">
            Cannot scan? Enter this key manually instead:
          </p>
          <code className="block break-all rounded-lg bg-muted p-3 text-[12px] text-foreground">
            {enrollment.secret}
          </code>
          <button
            type="button"
            onClick={() => void copyUri()}
            className="flex items-center gap-2 self-start py-2 px-3.5 bg-muted border border-border rounded-lg text-xs font-semibold text-foreground cursor-pointer"
          >
            <Copy size={13} /> Copy enrollment link
          </button>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="123456"
              inputMode="numeric"
              className={`${inputClass} flex-1`}
            />
            <button
              type="button"
              onClick={finish}
              disabled={confirm.isPending}
              className="py-2.5 px-5 bg-blue-600 text-white border-none rounded-[10px] text-sm font-bold cursor-pointer disabled:opacity-60"
            >
              {confirm.isPending ? "Confirming…" : "Confirm"}
            </button>
          </div>
        </div>
      )}

      {enabled && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <KeyRound size={14} /> Enter your password to manage recovery codes or disable TOTP.
          </div>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            className={inputClass}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={newCodes}
              disabled={regenerate.isPending}
              className="py-2.5 px-4 bg-muted border border-border rounded-[10px] text-[13px] font-semibold text-foreground cursor-pointer disabled:opacity-60"
            >
              {regenerate.isPending ? "Generating…" : "New recovery codes"}
            </button>
            <button
              type="button"
              onClick={turnOff}
              disabled={disable.isPending}
              className="py-2.5 px-4 bg-[#fee2e2] text-[#dc2626] border border-[#fecaca] rounded-[10px] text-[13px] font-semibold cursor-pointer disabled:opacity-60"
            >
              {disable.isPending ? "Disabling…" : "Disable 2FA"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Shared account settings for every role. Identity, preferences and sessions are
 * read from `profileApi`; password changes go through better-auth.
 */
export default function SettingsView() {
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [showPass, setShowPass] = useState(false);

  const profile = useMyProfile();
  const preferences = useNotificationPreferences();
  const sessions = useMySessions();
  const updateProfile = useUpdateMyProfile();
  const updatePreferences = useUpdateNotificationPreferences();
  const revokeSession = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    values: {
      name: profile.data?.name ?? "",
      phone: profile.data?.phone ?? "",
    },
  });
  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const [changingPassword, setChangingPassword] = useState(false);

  const submitProfile = async (values: ProfileValues) => {
    try {
      await updateProfile.mutateAsync({ name: values.name, phone: values.phone || null });
      toast.success("Profile updated");
    } catch (error) {
      toast.error(errorMessage(error, "Could not update the profile."));
    }
  };

  const submitPassword = async (values: PasswordValues) => {
    setChangingPassword(true);
    try {
      await authApi.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      toast.success("Password updated");
      passwordForm.reset();
    } catch (error) {
      toast.error(errorMessage(error, "Could not update the password."));
    } finally {
      setChangingPassword(false);
    }
  };

  const togglePreference = (key: string) => {
    const current = preferences.data;
    if (!current) return;
    updatePreferences.mutate(
      { [key]: !current[key] },
      { onError: (error) => toast.error(errorMessage(error, "Could not save the preference.")) },
    );
  };

  return (
    <div className="p-6 max-w-[900px] mx-auto">
      <div className="mb-7">
        <h1 className="text-[26px] font-extrabold text-foreground mb-1 font-['Plus_Jakarta_Sans',sans-serif]">Account Settings</h1>
        <p className="text-muted-foreground text-[15px]">Manage your profile, security, and preferences</p>
      </div>

      <div className="flex gap-6">
        {/* Tabs sidebar */}
        <div className="w-[200px] shrink-0">
          <div className="flex flex-col gap-0.5">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2.5 py-2.5 px-3.5 rounded-[10px] border-none text-sm text-left transition-all ${
                    active ? "bg-[#eff6ff] text-blue-600 font-bold" : "bg-transparent text-muted-foreground font-normal"
                  }`}
                >
                  <Icon size={17} /> {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          {profile.isLoading && activeTab === "profile" && <QueryLoading text="Loading your profile…" />}
          {profile.isError && activeTab === "profile" && (
            <QueryError error={profile.error} onRetry={() => void profile.refetch()} />
          )}

          {activeTab === "profile" && profile.data && (
            <div className={cardClass}>
              <h3 className="text-base font-bold text-foreground mb-5 font-['Plus_Jakarta_Sans',sans-serif]">Profile Information</h3>
              <div className="flex items-center gap-5 mb-7 p-5 bg-muted rounded-[14px]">
                <div className="w-[72px] h-[72px] rounded-full bg-blue-600 flex items-center justify-center text-2xl font-extrabold text-white font-['Plus_Jakarta_Sans',sans-serif]">
                  {initialsOf(profile.data.name)}
                </div>
                <div>
                  <div className="text-[17px] font-bold text-foreground mb-1">{profile.data.name}</div>
                  <div className="text-[13px] text-muted-foreground mb-2.5">
                    {profile.data.email} · {toLabel(profile.data.role)}
                  </div>
                  {profile.data.doctor && (
                    <div className="text-[13px] text-muted-foreground">
                      {profile.data.doctor.specialty ?? "—"} · License {profile.data.doctor.licenseNumber}
                    </div>
                  )}
                  {profile.data.patient && (
                    <div className="text-[13px] text-muted-foreground">
                      MRN {profile.data.patient.mrn} · DOB {profile.data.patient.dateOfBirth}
                    </div>
                  )}
                </div>
              </div>

              <form onSubmit={profileForm.handleSubmit(submitProfile)}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] font-semibold text-foreground mb-1.5">Full Name</label>
                    <input {...profileForm.register("name")} className={inputClass} />
                    {profileForm.formState.errors.name && (
                      <p className="text-[11px] text-red-600 mt-1">{profileForm.formState.errors.name.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-foreground mb-1.5">Email Address</label>
                    <input value={profile.data.email} readOnly className={`${inputClass} opacity-70`} />
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-foreground mb-1.5">Phone Number</label>
                    <input {...profileForm.register("phone")} className={inputClass} />
                    {profileForm.formState.errors.phone && (
                      <p className="text-[11px] text-red-600 mt-1">{profileForm.formState.errors.phone.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-foreground mb-1.5">Role</label>
                    <input value={toLabel(profile.data.role)} readOnly className={`${inputClass} opacity-70`} />
                  </div>
                </div>
                <div className="flex justify-end mt-5">
                  <button
                    type="submit"
                    disabled={updateProfile.isPending}
                    className="flex items-center gap-2 py-2.5 px-[22px] bg-blue-600 text-white border-none rounded-[10px] text-sm font-bold cursor-pointer disabled:opacity-60"
                  >
                    {updateProfile.isPending ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === "security" && (
            <div className="flex flex-col gap-5">
              <form onSubmit={passwordForm.handleSubmit(submitPassword)} className={cardClass}>
                <h3 className="text-base font-bold text-foreground mb-5 font-['Plus_Jakarta_Sans',sans-serif]">Change Password</h3>
                <div className="flex flex-col gap-3.5">
                  {(
                    [
                      { label: "Current Password", name: "currentPassword" },
                      { label: "New Password", name: "newPassword" },
                      { label: "Confirm New Password", name: "confirmPassword" },
                    ] as const
                  ).map((field) => (
                    <div key={field.name}>
                      <label className="block text-[13px] font-semibold text-foreground mb-1.5">{field.label}</label>
                      <div className="relative">
                        <input
                          type={showPass ? "text" : "password"}
                          placeholder="••••••••••"
                          {...passwordForm.register(field.name)}
                          className={`${inputClass} pr-11`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPass(!showPass)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 bg-none border-none cursor-pointer text-muted-foreground flex"
                        >
                          {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {passwordForm.formState.errors[field.name] && (
                        <p className="text-[11px] text-red-600 mt-1">
                          {passwordForm.formState.errors[field.name]?.message}
                        </p>
                      )}
                    </div>
                  ))}
                  <button
                    type="submit"
                    disabled={changingPassword}
                    className="py-2.5 px-5 bg-blue-600 text-white border-none rounded-[10px] text-sm font-bold cursor-pointer self-start disabled:opacity-60"
                  >
                    {changingPassword ? "Updating…" : "Update Password"}
                  </button>
                </div>
              </form>

              <TwoFactorCard />

              <div className={cardClass}>
                <h3 className="text-base font-bold text-foreground mb-4 font-['Plus_Jakarta_Sans',sans-serif]">Account Security</h3>
                <div className="flex items-center gap-3.5 p-4 bg-[#dcfce7] rounded-xl border border-[#86efac]">
                  <CheckCircle size={20} color="#16a34a" />
                  <div className="flex-1">
                    <div className="text-sm font-bold text-[#15803d]">Session-based authentication</div>
                    <div className="text-xs text-[#16a34a]">
                      Your session is protected by an httpOnly cookie issued by the server
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className={cardClass}>
              <h3 className="text-base font-bold text-foreground mb-5 font-['Plus_Jakarta_Sans',sans-serif]">Notification Preferences</h3>
              {preferences.isLoading && <QueryLoading text="Loading preferences…" />}
              {preferences.isError && (
                <QueryError error={preferences.error} onRetry={() => void preferences.refetch()} />
              )}
              {preferences.data && (
                <>
                  <div className="mb-6">
                    <div className="text-sm font-bold text-foreground mb-3.5">Notify me about</div>
                    <div className="flex flex-col gap-3">
                      {PREFERENCE_FIELDS.map((field) => (
                        <div
                          key={field.key}
                          className="flex items-center justify-between p-3 px-4 bg-muted rounded-[10px]"
                        >
                          <span className="text-sm text-foreground">{field.label}</span>
                          <Toggle
                            on={Boolean(preferences.data?.[field.key])}
                            onClick={() => togglePreference(field.key)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-foreground mb-3.5">Notification channels</div>
                    <div className="flex gap-3">
                      {CHANNEL_FIELDS.map((field) => {
                        const on = Boolean(preferences.data?.[field.key]);
                        return (
                          <button
                            key={field.key}
                            onClick={() => togglePreference(field.key)}
                            className={`flex-1 py-3 rounded-[10px] text-sm font-semibold cursor-pointer border-[1.5px] ${
                              on
                                ? "border-blue-600 bg-accent text-blue-600"
                                : "border-border bg-card text-muted-foreground"
                            }`}
                          >
                            {field.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {updatePreferences.isPending && (
                    <div className="mt-4 text-xs text-muted-foreground">Saving preference…</div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === "devices" && (
            <div className={cardClass}>
              <h3 className="text-base font-bold text-foreground mb-5 font-['Plus_Jakarta_Sans',sans-serif]">Active Sessions & Devices</h3>
              {sessions.isLoading && <QueryLoading text="Loading sessions…" />}
              {sessions.isError && <QueryError error={sessions.error} onRetry={() => void sessions.refetch()} />}
              <div className="flex flex-col gap-3">
                {(sessions.data ?? []).map((session) => {
                  const isMobile = /iphone|ipad|android|mobile/i.test(session.deviceName ?? session.userAgent ?? "");
                  return (
                    <div
                      key={session.id}
                      className="flex gap-3.5 p-4 bg-muted rounded-xl border-[1.5px] border-transparent"
                    >
                      <div className="w-11 h-11 rounded-xl bg-border flex items-center justify-center">
                        {isMobile ? (
                          <Smartphone size={22} color="var(--muted-foreground)" />
                        ) : (
                          <Monitor size={22} color="var(--muted-foreground)" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-bold text-foreground mb-1">
                          {session.deviceName ?? "Unknown device"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {session.ipAddress ?? "Unknown IP"} · Last active {formatDateTime(session.lastSeenAt)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Signed in {formatDateTime(session.createdAt)} · Expires {formatDateTime(session.expiresAt)}
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          revokeSession.mutate(session.id, {
                            onSuccess: () => toast.success("Session signed out"),
                            onError: (error) => toast.error(errorMessage(error, "Could not revoke the session.")),
                          })
                        }
                        disabled={revokeSession.isPending}
                        className="py-1.5 px-3.5 bg-[#fee2e2] text-[#dc2626] border-none rounded-lg text-xs font-semibold cursor-pointer self-center disabled:opacity-60"
                      >
                        Sign Out
                      </button>
                    </div>
                  );
                })}
                {sessions.data && sessions.data.length === 0 && (
                  <div className="text-sm text-muted-foreground">No active sessions recorded.</div>
                )}
              </div>
              <button
                onClick={() =>
                  revokeOthers.mutate(undefined, {
                    onSuccess: () => toast.success("All other sessions signed out"),
                    onError: (error) => toast.error(errorMessage(error, "Could not sign out other sessions.")),
                  })
                }
                disabled={revokeOthers.isPending}
                className="mt-4 py-2.5 px-4.5 bg-[#fee2e2] text-[#dc2626] border border-[#fecaca] rounded-[10px] text-[13px] font-semibold cursor-pointer disabled:opacity-60"
              >
                Sign Out All Other Devices
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
