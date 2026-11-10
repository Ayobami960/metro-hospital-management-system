import { API_ENDPOINTS } from "@/services/api/endpoints";
import { apiClient } from "@/services/api/client";
import { unwrap, unwrapPage } from "@/services/api/response";
import { authClient } from "@/lib/auth-client";
import type {
  AccountStatus,
  ApiEnvelope,
  AuthChallengeResult,
  InvitationPreview,
  InviteStaffInput,
  OnboardingInput,
  OnboardingStatus,
  OtpResendResult,
  OtpVerificationResult,
  Paginated,
  RecoveryCodesResult,
  Role,
  RoomAccessRequestResult,
  RoomAccessSession,
  RoomAccessVerifyResult,
  SessionUser,
  StaffAccount,
  StaffDirectoryParams,
  StaffInvitation,
  TotpEnrollment,
} from "@/types/api.types";

/**
 * Authentication against the better-auth backend plus the account endpoints
 * that implement the login-progress challenges (TOTP, daily email code,
 * hospital ID) and staff invitations.
 *
 * The session cookie is httpOnly and owned by the server; the frontend only
 * reads the resolved user through `GET /me` (role, permissions, scoping ids).
 */

const getEnvelope = async <T>(url: string, params?: Record<string, unknown>): Promise<T> => {
  const response = await apiClient.get<ApiEnvelope<T>>(url, { params });
  return unwrap(response.data);
};

const postEnvelope = async <T>(url: string, body?: unknown): Promise<T> => {
  const response = await apiClient.post<ApiEnvelope<T>>(url, body ?? {});
  return unwrap(response.data);
};

export interface InvitationAcceptInput {
  token: string;
  password: string;
  name?: string;
}

export const authApi = {
  me: async (): Promise<SessionUser> => getEnvelope<SessionUser>(API_ENDPOINTS.me),

  signIn: async (email: string, password: string): Promise<void> => {
    const { error } = await authClient.signIn.email({ email, password });
    if (error) {
      throw new Error(error.message ?? "Unable to sign in with those credentials.");
    }
  },

  signUp: async (input: { name: string; email: string; password: string }): Promise<void> => {
    const { error } = await authClient.signUp.email(input);
    if (error) throw new Error(error.message ?? "Unable to create the account.");
  },

  signOut: async (): Promise<void> => {
    await authClient.signOut();
  },

  /** better-auth owns the credential store, so password changes go through it. */
  changePassword: async (input: {
    currentPassword: string;
    newPassword: string;
  }): Promise<void> => {
    const { error } = await authClient.changePassword({
      currentPassword: input.currentPassword,
      newPassword: input.newPassword,
      revokeOtherSessions: true,
    });
    if (error) throw new Error(error.message ?? "Unable to update the password.");
  },

  /* Account progress */

  accountStatus: async (): Promise<AccountStatus> =>
    getEnvelope<AccountStatus>(API_ENDPOINTS.account.status),

  verifyEmail: async (code: string): Promise<OtpVerificationResult> =>
    postEnvelope<OtpVerificationResult>(API_ENDPOINTS.account.verifyEmail, { code }),

  resendEmailVerification: async (): Promise<OtpResendResult> =>
    postEnvelope<OtpResendResult>(API_ENDPOINTS.account.resendEmailVerification),

  verifyPatientOtp: async (code: string): Promise<OtpVerificationResult> =>
    postEnvelope<OtpVerificationResult>(API_ENDPOINTS.account.verifyPatientOtp, { code }),

  resendPatientOtp: async (): Promise<OtpResendResult> =>
    postEnvelope<OtpResendResult>(API_ENDPOINTS.account.resendPatientOtp),

  verifyTotp: async (code: string): Promise<AuthChallengeResult> =>
    postEnvelope<AuthChallengeResult>(API_ENDPOINTS.account.verifyTotp, { code }),

  verifyRecoveryCode: async (code: string): Promise<AuthChallengeResult> =>
    postEnvelope<AuthChallengeResult>(API_ENDPOINTS.account.verifyRecoveryCode, { code }),

  /* Mandatory first-login profile completion */

  onboarding: async (): Promise<OnboardingStatus> =>
    getEnvelope<OnboardingStatus>(API_ENDPOINTS.account.onboarding),

  completeOnboarding: async (input: OnboardingInput): Promise<OnboardingStatus> =>
    postEnvelope<OnboardingStatus>(API_ENDPOINTS.account.onboarding, input),

  uploadOnboardingAvatar: async (file: File): Promise<{ image: string }> => {
    const form = new FormData();
    form.append("file", file);
    const response = await apiClient.post<ApiEnvelope<{ image: string }>>(
      API_ENDPOINTS.account.onboardingAvatar,
      form,
    );
    return unwrap(response.data);
  },

  /* TOTP enrollment */

  enrollTotp: async (): Promise<TotpEnrollment> =>
    postEnvelope<TotpEnrollment>(API_ENDPOINTS.account.enrollTotp),

  confirmTotp: async (code: string): Promise<RecoveryCodesResult> =>
    postEnvelope<RecoveryCodesResult>(API_ENDPOINTS.account.confirmTotp, { code }),

  disableTotp: async (password: string): Promise<void> => {
    await postEnvelope<{ enabled: boolean }>(API_ENDPOINTS.account.disableTotp, { password });
  },

  regenerateRecoveryCodes: async (password: string): Promise<RecoveryCodesResult> =>
    postEnvelope<RecoveryCodesResult>(API_ENDPOINTS.account.regenerateRecoveryCodes, { password }),

  /* Daily Room Access (public: no authenticated session yet) */

  sendRoomAccessCode: async (email: string): Promise<RoomAccessRequestResult> =>
    postEnvelope<RoomAccessRequestResult>(API_ENDPOINTS.roomAccess.send, { email }),

  verifyRoomAccessCode: async (
    email: string,
    code: string,
  ): Promise<RoomAccessVerifyResult> =>
    postEnvelope<RoomAccessVerifyResult>(API_ENDPOINTS.roomAccess.verify, { email, code }),

  roomAccessSession: async (): Promise<RoomAccessSession> =>
    getEnvelope<RoomAccessSession>(API_ENDPOINTS.roomAccess.session),

  clearRoomAccessSession: async (): Promise<void> => {
    await apiClient.delete(API_ENDPOINTS.roomAccess.session);
  },

  /* Staff accounts and invitations (administrators) */

  listStaff: async (params: StaffDirectoryParams = {}): Promise<Paginated<StaffAccount>> => {
    const response = await apiClient.get<StaffAccount[]>(API_ENDPOINTS.staffUsers.list, { params });
    return unwrapPage(response.data);
  },

  invitableRoles: async (): Promise<Role[]> =>
    (await getEnvelope<{ roles: Role[] }>(API_ENDPOINTS.staffUsers.roles)).roles,

  inviteStaff: async (
    input: InviteStaffInput,
  ): Promise<{
    invitationId: string;
    email: string;
    role: Role;
    expiresAt: string;
    delivered: boolean;
  }> => postEnvelope(API_ENDPOINTS.staffUsers.invite, input),

  pendingInvitations: async (): Promise<StaffInvitation[]> =>
    (await getEnvelope<{ invitations: StaffInvitation[] }>(API_ENDPOINTS.staffUsers.invitations))
      .invitations,

  resendInvitation: async (
    invitationId: string,
  ): Promise<{ delivered: boolean; expiresAt: string }> =>
    postEnvelope<{ delivered: boolean; expiresAt: string }>(
      API_ENDPOINTS.staffUsers.resendInvitation(invitationId),
    ),

  revokeInvitation: async (invitationId: string): Promise<void> => {
    await apiClient.delete(API_ENDPOINTS.staffUsers.revokeInvitation(invitationId));
  },

  setStaffStatus: async (userId: string, status: string): Promise<void> => {
    await apiClient.patch(API_ENDPOINTS.staffUsers.status(userId), { status });
  },

  /* Invitation acceptance (public) */

  validateInvitation: async (token: string): Promise<InvitationPreview> =>
    getEnvelope<InvitationPreview>(API_ENDPOINTS.invitations.validate(token)),

  acceptInvitation: async (
    input: InvitationAcceptInput,
  ): Promise<{ email: string; role: Role; verificationRequired: boolean }> =>
    postEnvelope<{ email: string; role: Role; verificationRequired: boolean }>(
      API_ENDPOINTS.invitations.accept,
      input,
    ),
};
