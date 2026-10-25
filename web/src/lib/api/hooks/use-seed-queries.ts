import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { requestApi, requestApiText } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type { SeedStatus, SeedValidation } from "@/lib/api/types";

export function useSeedStatus() {
  return useQuery({
    queryKey: queryKeys.system.seedStatus,
    queryFn: ({ signal }) =>
      requestApi<SeedStatus>("/seed/status", { abortSignal: signal }),
  });
}

/** Fetches the current configuration as `sendmock.seed.toml` text. */
export function useExportSeed() {
  return useMutation({
    mutationFn: () => requestApiText("/seed/export"),
  });
}

export function useValidateSeed() {
  return useMutation({
    mutationFn: (seedToml: string) =>
      requestApi<SeedValidation>("/seed/validate", {
        method: "POST",
        requestBody: { seed_toml: seedToml },
      }),
  });
}

export function useApplySeed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (seedToml: string) =>
      requestApi<SeedValidation>("/seed/apply", {
        method: "POST",
        requestBody: { seed_toml: seedToml },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });
}
