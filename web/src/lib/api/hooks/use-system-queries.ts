import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { requestApi } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  AppInfo,
  AppSettings,
  AppStats,
  CapturedHttpRequest,
  HttpBin,
  PageOf,
} from "@/lib/api/types";

export function useAppStats() {
  return useQuery({
    queryKey: queryKeys.system.stats,
    queryFn: ({ signal }) =>
      requestApi<AppStats>("/stats", { abortSignal: signal }),
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
    mutationFn: (settingsUpdate: Partial<AppSettings>) =>
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

export function useHttpBins() {
  return useQuery({
    queryKey: queryKeys.httpCatcher.bins,
    queryFn: ({ signal }) =>
      requestApi<HttpBin[]>("/http/bins", { abortSignal: signal }),
  });
}

export function useCapturedHttpRequests(binId: string | null) {
  return useQuery({
    queryKey: queryKeys.httpCatcher.requests(binId),
    queryFn: ({ signal }) =>
      requestApi<PageOf<CapturedHttpRequest>>("/http/requests", {
        queryParameters: { bin_id: binId },
        abortSignal: signal,
      }),
  });
}
