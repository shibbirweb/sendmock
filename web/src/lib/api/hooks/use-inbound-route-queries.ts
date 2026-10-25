import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { requestApi } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  InboundRoute,
  InboundRouteInput,
  InboundRouteTestRequest,
  InboundRouteTestResult,
} from "@/lib/api/types";

export function useInboundRoutes() {
  return useQuery({
    queryKey: queryKeys.inboundRoutes.all,
    queryFn: ({ signal }) =>
      requestApi<InboundRoute[]>("/inbound-routes", { abortSignal: signal }),
  });
}

function useRouteMutation<MutationInput, MutationResult>(
  mutationRequest: (mutationInput: MutationInput) => Promise<MutationResult>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: mutationRequest,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.inboundRoutes.all,
      });
    },
  });
}

/** Creates a route when no id is given, else saves it (WH-12.7). */
export function useSaveInboundRoute() {
  return useRouteMutation(
    ({
      routeId,
      routeInput,
    }: {
      routeId: string | null;
      routeInput: InboundRouteInput;
    }) =>
      routeId === null
        ? requestApi<InboundRoute>("/inbound-routes", {
            method: "POST",
            requestBody: routeInput,
          })
        : requestApi<InboundRoute>(`/inbound-routes/${routeId}`, {
            method: "PATCH",
            requestBody: routeInput,
          }),
  );
}

export function useDeleteInboundRoute() {
  return useRouteMutation((routeId: string) =>
    requestApi<null>(`/inbound-routes/${routeId}`, { method: "DELETE" }),
  );
}

/**
 * Moves a route by swapping priorities with its neighbour; equal priorities
 * get the moved route one below or above, so the order always changes.
 */
export function useMoveInboundRoute() {
  return useRouteMutation(
    async ({
      movedRoute,
      neighbourRoute,
      isMovingUp,
    }: {
      movedRoute: InboundRoute;
      neighbourRoute: InboundRoute;
      isMovingUp: boolean;
    }) => {
      const hasSamePriority = movedRoute.priority === neighbourRoute.priority;
      const movedPriority = hasSamePriority
        ? Math.max(0, neighbourRoute.priority + (isMovingUp ? -1 : 1))
        : neighbourRoute.priority;
      const neighbourPriority =
        hasSamePriority && movedPriority === neighbourRoute.priority
          ? neighbourRoute.priority + 1
          : hasSamePriority
            ? neighbourRoute.priority
            : movedRoute.priority;
      const toInput = (inboundRoute: InboundRoute, priority: number) => ({
        priority,
        description: inboundRoute.description,
        filter: inboundRoute.filter,
        actions: inboundRoute.actions,
      });
      await requestApi<InboundRoute>(`/inbound-routes/${movedRoute.id}`, {
        method: "PATCH",
        requestBody: toInput(movedRoute, movedPriority),
      });
      await requestApi<InboundRoute>(`/inbound-routes/${neighbourRoute.id}`, {
        method: "PATCH",
        requestBody: toInput(neighbourRoute, neighbourPriority),
      });
    },
  );
}

/** The live preview: which recent incoming emails a filter takes (WH-12.7). */
export function useInboundRouteTest(testRequest: InboundRouteTestRequest) {
  return useQuery({
    queryKey: queryKeys.inboundRoutes.test(testRequest),
    queryFn: ({ signal }) =>
      requestApi<InboundRouteTestResult>("/inbound-routes/test", {
        method: "POST",
        requestBody: testRequest,
        abortSignal: signal,
      }),
    placeholderData: keepPreviousData,
  });
}
