import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { requestApi } from "@/lib/api/api-client";
import { isOperationServed } from "@/lib/api/operation-availability";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  AppInfo,
  AppSettings,
  AppSettingsUpdate,
  UpdateCheckResult,
  AppStats,
} from "@/lib/api/types";

/** Counts for the sidebar and Overview; not asked for until the server serves them. */
export function useAppStats() {
  const appInfoQuery = useAppInfo();

  return useQuery({
    queryKey: queryKeys.system.stats,
    queryFn: ({ signal }) =>
      requestApi<AppStats>("/stats", { abortSignal: signal }),
    enabled:
      !appInfoQuery.isPending &&
      isOperationServed(appInfoQuery.data, "GET /api/v1/stats", true),
  });
}

export function useAppInfo() {
  return useQuery({
    queryKey: queryKeys.system.info,
    queryFn: ({ signal }) =>
      requestApi<AppInfo>("/info", { abortSignal: signal }),
  });
}

export function useAppSettings() {
  return useQuery({
    queryKey: queryKeys.system.settings,
    queryFn: ({ signal }) =>
      requestApi<AppSettings>("/settings", { abortSignal: signal }),
  });
}

export function useUpdateAppSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settingsUpdate: AppSettingsUpdate) =>
      requestApi<AppSettings>("/settings", {
        method: "PATCH",
        requestBody: settingsUpdate,
      }),
    onSuccess: (updatedSettings) => {
      queryClient.setQueryData(queryKeys.system.settings, updatedSettings);
    },
  });
}

/** Wipes traffic and restores the seed state (POST /reset). */
export function useResetToSeed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => requestApi<void>("/reset", { method: "POST" }),
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });
}

/** The server keeps an update check for 24 hours, so the UI does too. */
const updateCheckIntervalMs = 24 * 60 * 60 * 1000;

/** Asks GitHub Releases for a newer version; only works once opted in. */
export function useCheckForUpdates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => requestApi<UpdateCheckResult>("/updates"),
    onSuccess: (updateCheckResult) => {
      queryClient.setQueryData(queryKeys.system.updates, updateCheckResult);
    },
  });
}

/** The daily update check (PL-05.10): on start and then once a day. */
export function useDailyUpdateCheck({ isEnabled }: { isEnabled: boolean }) {
  return useQuery({
    queryKey: queryKeys.system.updates,
    queryFn: ({ signal }) =>
      requestApi<UpdateCheckResult>("/updates", { abortSignal: signal }),
    enabled: isEnabled,
    staleTime: updateCheckIntervalMs,
    refetchInterval: updateCheckIntervalMs,
    retry: false,
  });
}
