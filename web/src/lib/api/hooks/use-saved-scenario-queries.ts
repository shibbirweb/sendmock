import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { requestApi } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type { SavedScenario, SavedScenarioInput } from "@/lib/api/types";

export function useSavedScenarios() {
  return useQuery({
    queryKey: queryKeys.savedScenarios,
    queryFn: ({ signal }) =>
      requestApi<SavedScenario[]>("/scenarios", { abortSignal: signal }),
  });
}

function useRefreshSavedScenarios() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.savedScenarios });
  };
}

export function useSaveScenario() {
  const refreshSavedScenarios = useRefreshSavedScenarios();

  return useMutation({
    mutationFn: (scenarioInput: SavedScenarioInput) =>
      requestApi<SavedScenario>("/scenarios", {
        method: "POST",
        requestBody: scenarioInput,
      }),
    onSuccess: refreshSavedScenarios,
  });
}

export function useUpdateSavedScenario() {
  const refreshSavedScenarios = useRefreshSavedScenarios();

  return useMutation({
    mutationFn: ({
      scenarioId,
      scenarioChange,
    }: {
      scenarioId: string;
      scenarioChange: Partial<SavedScenarioInput>;
    }) =>
      requestApi<SavedScenario>(
        `/scenarios/${encodeURIComponent(scenarioId)}`,
        {
          method: "PATCH",
          requestBody: scenarioChange,
        },
      ),
    onSuccess: refreshSavedScenarios,
  });
}

export function useDeleteSavedScenario() {
  const refreshSavedScenarios = useRefreshSavedScenarios();

  return useMutation({
    mutationFn: (scenarioId: string) =>
      requestApi<void>(`/scenarios/${encodeURIComponent(scenarioId)}`, {
        method: "DELETE",
      }),
    onSuccess: refreshSavedScenarios,
  });
}
