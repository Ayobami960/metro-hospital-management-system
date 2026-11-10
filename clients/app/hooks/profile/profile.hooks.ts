import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { profileApi, type NotificationPreferences } from "@/services/profile/profile.api";
import { errorMessage } from "@/services/api/api-error";
import { queryKeys } from "@/lib/query-keys";

export const useMyProfile = () =>
  useQuery({ queryKey: queryKeys.profile.me, queryFn: profileApi.me });

export const useUpdateMyProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: profileApi.update,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile.me });
      void queryClient.invalidateQueries({ queryKey: queryKeys.session.me });
      toast.success("Profile updated");
    },
    onError: (error) => toast.error(errorMessage(error, "Could not update your profile.")),
  });
};

export const useNotificationPreferences = () =>
  useQuery({ queryKey: queryKeys.profile.preferences, queryFn: profileApi.preferences });

export const useUpdateNotificationPreferences = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<NotificationPreferences>) => profileApi.updatePreferences(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile.preferences });
      toast.success("Preferences saved");
    },
    onError: (error) => toast.error(errorMessage(error, "Could not save preferences.")),
  });
};

export const useMySessions = () =>
  useQuery({ queryKey: queryKeys.profile.sessions, queryFn: profileApi.sessions });

export const useRevokeSession = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: profileApi.revokeSession,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.profile.sessions }),
  });
};

export const useRevokeOtherSessions = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: profileApi.revokeOtherSessions,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.profile.sessions }),
  });
};

export const useHospitalSettings = () =>
  useQuery({ queryKey: queryKeys.profile.hospital, queryFn: profileApi.hospital });

export const useUpdateHospitalSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: profileApi.updateHospital,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile.hospital });
      toast.success("Hospital settings saved");
    },
  });
};
