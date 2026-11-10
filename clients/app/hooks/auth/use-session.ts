import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { authApi } from "@/services/auth/auth.api";
import { errorMessage } from "@/services/api/api-error";
import type {
  ManagedUserParams,
  PatientDraft,
  PatientProfileInput,
  Role,
  StaffDirectoryParams,
  UpdateManagedUserInput,
} from "@/types/api.types";

export const sessionKeys = {
  me: ["session", "me"] as const,
};

export const accountKeys = {
  status: ["account", "status"] as const,
  onboarding: ["account", "onboarding"] as const,
  roomAccess: ["room-access", "session"] as const,
  staff: ["account", "staff"] as const,
  invitations: ["account", "invitations"] as const,
  invitableRoles: ["account", "invitable-roles"] as const,
  userStatistics: ["account", "user-statistics"] as const,
  managedUser: (userId: string) => ["account", "managed-user", userId] as const,
};

/** Resolved session user (`GET /me`). 401/403 are terminal — do not retry. */
export function useSession() {
  return useQuery({
    queryKey: sessionKeys.me,
    queryFn: authApi.me,
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function useSignIn() {
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authApi.signIn(email, password),
  });
}

export function useSignUp() {
  return useMutation({
    mutationFn: (input: { name: string; email: string; password: string }) => authApi.signUp(input),
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: authApi.signOut,
    onSuccess: () => {
      queryClient.clear();
      navigate("/login", { replace: true });
    },
    onError: (error) => toast.error(errorMessage(error, "Could not sign out.")),
  });
}

/** Login progress for the current session (works before a dashboard is allowed). */
export function useAccountStatus(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: accountKeys.status,
    queryFn: authApi.accountStatus,
    retry: false,
    staleTime: 0,
    enabled: options.enabled ?? true,
  });
}

const invalidateAccount = (queryClient: QueryClient): void => {
  void queryClient.invalidateQueries({ queryKey: accountKeys.status });
  void queryClient.invalidateQueries({ queryKey: sessionKeys.me });
  void queryClient.invalidateQueries({ queryKey: accountKeys.onboarding });
};

export function useVerifyTotp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { code: string }) => authApi.verifyTotp(input.code),
    onSuccess: () => invalidateAccount(queryClient),
  });
}

export function useVerifyRecoveryCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { code: string }) => authApi.verifyRecoveryCode(input.code),
    onSuccess: () => invalidateAccount(queryClient),
  });
}

export function useVerifyEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { code: string }) => authApi.verifyEmail(input.code),
    onSuccess: () => invalidateAccount(queryClient),
  });
}

export function useResendEmailVerification() {
  return useMutation({ mutationFn: () => authApi.resendEmailVerification() });
}

export function useVerifyPatientOtp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { code: string }) => authApi.verifyPatientOtp(input.code),
    onSuccess: () => invalidateAccount(queryClient),
  });
}

export function useResendPatientOtp() {
  return useMutation({ mutationFn: () => authApi.resendPatientOtp() });
}

export function useEnrollTotp() {
  return useMutation({ mutationFn: () => authApi.enrollTotp() });
}

export function useConfirmTotp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { code: string }) => authApi.confirmTotp(input.code),
    onSuccess: () => invalidateAccount(queryClient),
  });
}

export function useDisableTotp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { password: string }) => authApi.disableTotp(input.password),
    onSuccess: () => invalidateAccount(queryClient),
  });
}

export function useRegenerateRecoveryCodes() {
  return useMutation({
    mutationFn: (input: { password: string }) => authApi.regenerateRecoveryCodes(input.password),
  });
}

/* Daily Room Access (public, staff only) */

export function useRoomAccessSession(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: accountKeys.roomAccess,
    queryFn: authApi.roomAccessSession,
    retry: false,
    staleTime: 0,
    enabled: options.enabled ?? true,
  });
}

export function useSendRoomAccessCode() {
  return useMutation({
    mutationFn: (input: { email: string }) => authApi.sendRoomAccessCode(input.email),
  });
}

export function useVerifyRoomAccessCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; code: string }) =>
      authApi.verifyRoomAccessCode(input.email, input.code),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountKeys.roomAccess }),
  });
}

export function useClearRoomAccessSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.clearRoomAccessSession,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountKeys.roomAccess }),
  });
}

/* Mandatory first-login profile completion */

export function useOnboarding(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: accountKeys.onboarding,
    queryFn: authApi.onboarding,
    retry: false,
    staleTime: 0,
    enabled: options.enabled ?? true,
  });
}

export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.completeOnboarding,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accountKeys.onboarding });
      void queryClient.invalidateQueries({ queryKey: accountKeys.status });
      void queryClient.invalidateQueries({ queryKey: sessionKeys.me });
    },
  });
}

export function useUploadOnboardingAvatar() {
  return useMutation({ mutationFn: (file: File) => authApi.uploadOnboardingAvatar(file) });
}

/** Saves the registration profile without completing onboarding. */
export function usePatientRegistration() {
  return useMutation({ mutationFn: (patient: PatientProfileInput) => authApi.registerPatient(patient) });
}

export function useSavePatientDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draft: PatientDraft) => authApi.savePatientDraft(draft),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountKeys.onboarding }),
  });
}

export function useUploadOnboardingDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => authApi.uploadOnboardingDocument(file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountKeys.onboarding }),
  });
}

export function useDeleteOnboardingDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fileId: string) => authApi.deleteOnboardingDocument(fileId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountKeys.onboarding }),
  });
}

/* Staff administration */

export function useStaffAccounts(params: StaffDirectoryParams = {}) {
  return useQuery({
    queryKey: [...accountKeys.staff, params],
    queryFn: () => authApi.listStaff(params),
    staleTime: 30_000,
  });
}

export function useInvitableRoles() {
  return useQuery({
    queryKey: accountKeys.invitableRoles,
    queryFn: authApi.invitableRoles,
    staleTime: 10 * 60_000,
  });
}

export function usePendingInvitations() {
  return useQuery({
    queryKey: accountKeys.invitations,
    queryFn: authApi.pendingInvitations,
    staleTime: 15_000,
  });
}

const invalidateUserManagement = (queryClient: QueryClient): void => {
  void queryClient.invalidateQueries({ queryKey: accountKeys.staff });
  void queryClient.invalidateQueries({ queryKey: accountKeys.invitations });
  void queryClient.invalidateQueries({ queryKey: accountKeys.userStatistics });
};

export function useInviteStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.inviteStaff,
    onSuccess: () => invalidateUserManagement(queryClient),
  });
}

/* Admin user management */

export function useManagedUsers(params: ManagedUserParams = {}) {
  return useQuery({
    queryKey: [...accountKeys.staff, "managed", params],
    queryFn: () => authApi.listManagedUsers(params),
    staleTime: 15_000,
  });
}

export function useUserStatistics() {
  return useQuery({
    queryKey: accountKeys.userStatistics,
    queryFn: authApi.userStatistics,
    staleTime: 30_000,
  });
}

export function useManagedUser(userId: string | null) {
  return useQuery({
    queryKey: accountKeys.managedUser(userId ?? ""),
    queryFn: () => authApi.managedUser(userId ?? ""),
    enabled: Boolean(userId),
    retry: false,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.createUser,
    onSuccess: () => invalidateUserManagement(queryClient),
  });
}

export function useUpdateManagedUser(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateManagedUserInput) => authApi.updateManagedUser(userId, input),
    onSuccess: () => {
      invalidateUserManagement(queryClient);
      void queryClient.invalidateQueries({ queryKey: accountKeys.managedUser(userId) });
    },
  });
}

export function useChangeUserRole(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (role: Role) => authApi.changeUserRole(userId, role),
    onSuccess: () => {
      invalidateUserManagement(queryClient);
      void queryClient.invalidateQueries({ queryKey: accountKeys.managedUser(userId) });
    },
  });
}

export function useResendInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) => authApi.resendInvitation(invitationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accountKeys.invitations });
      void queryClient.invalidateQueries({ queryKey: accountKeys.userStatistics });
    },
  });
}

export function useRevokeInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) => authApi.revokeInvitation(invitationId),
    onSuccess: () => invalidateUserManagement(queryClient),
  });
}

export function useSetStaffStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string; status: string }) =>
      authApi.setStaffStatus(input.userId, input.status),
    onSuccess: () => invalidateUserManagement(queryClient),
  });
}

/* Invitation acceptance */

export function useInvitation(token: string | null) {
  return useQuery({
    queryKey: ["invitation", token],
    queryFn: () => authApi.validateInvitation(token ?? ""),
    enabled: Boolean(token),
    retry: false,
  });
}

export function useAcceptInvitation() {
  return useMutation({ mutationFn: authApi.acceptInvitation });
}
