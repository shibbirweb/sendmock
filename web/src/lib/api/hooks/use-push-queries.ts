import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSelectedProjectKey } from "@/hooks/use-selected-project";
import { requestApi } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  PageOf,
  PushListFilters,
  PushNotification,
} from "@/lib/api/types";

export function usePushNotifications(pushFilters: PushListFilters = {}) {
  const projectFilters = { ...pushFilters, project: useSelectedProjectKey() };

  return useQuery({
    queryKey: queryKeys.push.list(projectFilters),
    queryFn: ({ signal }) =>
      requestApi<PageOf<PushNotification>>("/push", {
        queryParameters: projectFilters,
        abortSignal: signal,
      }),
  });
}

export function usePushNotification(pushId: string) {
  return useQuery({
    queryKey: queryKeys.push.detail(pushId),
    queryFn: ({ signal }) =>
      requestApi<PushNotification>(`/push/${pushId}`, { abortSignal: signal }),
  });
}

function usePushMutation<MutationInput>(
  mutationRequest: (mutationInput: MutationInput) => Promise<void>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: mutationRequest,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.push.all });
    },
  });
}

export function useDeletePushNotification() {
  return usePushMutation((pushId: string) =>
    requestApi<void>(`/push/${pushId}`, { method: "DELETE" }),
  );
}

/** Deletes every notification the filters match in the chosen project, or all of them. */
export function useDeletePushNotifications() {
  const projectKey = useSelectedProjectKey();

  return usePushMutation((pushFilters: PushListFilters) =>
    requestApi<void>("/push", {
      method: "DELETE",
      queryParameters: { ...pushFilters, project: projectKey },
    }),
  );
}
