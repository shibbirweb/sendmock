import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { requestApi } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  CapturedHttpRequest,
  HttpBin,
  HttpBinInput,
  HttpForwardResult,
  HttpMockResponse,
  HttpResponseRule,
  HttpRulePreviewRequest,
  HttpRulePreviewResult,
  PageOf,
} from "@/lib/api/types";

/** Rows per page of the request list (HC-01.6). */
const requestPageSize = 50;

export function useHttpBins() {
  return useQuery({
    queryKey: queryKeys.httpCatcher.bins,
    queryFn: ({ signal }) =>
      requestApi<HttpBin[]>("/http/bins", { abortSignal: signal }),
  });
}

/** Captured requests of one bin (or all), newest first, 50 at a time. */
export function useCapturedHttpRequests(binId: string | null) {
  return useInfiniteQuery({
    queryKey: queryKeys.httpCatcher.requests(binId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      requestApi<PageOf<CapturedHttpRequest>>("/http/requests", {
        queryParameters: {
          bin_id: binId,
          cursor: pageParam,
          limit: requestPageSize,
        },
        abortSignal: signal,
      }),
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });
}

export function useCapturedHttpRequest(requestId: string) {
  return useQuery({
    queryKey: queryKeys.httpCatcher.request(requestId),
    queryFn: ({ signal }) =>
      requestApi<CapturedHttpRequest>(`/http/requests/${requestId}`, {
        abortSignal: signal,
      }),
  });
}

export function useHttpResponseRules(binId: string) {
  return useQuery({
    queryKey: queryKeys.httpCatcher.responseRules(binId),
    queryFn: ({ signal }) =>
      requestApi<HttpResponseRule[]>(`/http/bins/${binId}/responses`, {
        abortSignal: signal,
      }),
  });
}

/** Whether a draft rule matches a captured request, and what it returns (HC-02.4). */
export function useHttpRulePreview(
  binId: string,
  previewRequest: HttpRulePreviewRequest | null,
) {
  return useQuery({
    queryKey: queryKeys.httpCatcher.rulePreview(
      binId,
      previewRequest ?? { rule: {} as HttpResponseRule, request_id: "" },
    ),
    queryFn: ({ signal }) =>
      requestApi<HttpRulePreviewResult>(
        `/http/bins/${binId}/responses/preview`,
        { method: "POST", requestBody: previewRequest, abortSignal: signal },
      ),
    enabled: previewRequest !== null,
    placeholderData: keepPreviousData,
  });
}

function useCatcherMutation<MutationInput, MutationResult>(
  mutationRequest: (mutationInput: MutationInput) => Promise<MutationResult>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: mutationRequest,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.httpCatcher.all,
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.system.stats });
    },
  });
}

export function useCreateHttpBin() {
  return useCatcherMutation((binInput: HttpBinInput) =>
    requestApi<HttpBin>("/http/bins", {
      method: "POST",
      requestBody: binInput,
    }),
  );
}

export function useUpdateDefaultResponse() {
  return useCatcherMutation(
    ({
      binId,
      defaultResponse,
    }: {
      binId: string;
      defaultResponse: HttpMockResponse;
    }) =>
      requestApi<HttpBin>(`/http/bins/${binId}`, {
        method: "PATCH",
        requestBody: { default_response: defaultResponse },
      }),
  );
}

export function useDeleteHttpBin() {
  return useCatcherMutation((binId: string) =>
    requestApi<null>(`/http/bins/${binId}`, { method: "DELETE" }),
  );
}

export function useClearHttpRequests() {
  return useCatcherMutation((binId: string) =>
    requestApi<null>("/http/requests", {
      method: "DELETE",
      queryParameters: { bin_id: binId },
    }),
  );
}

/** Replaces a bin's ordered rules: add, edit, reorder, toggle and delete (HC-02.4). */
export function useSaveHttpResponseRules() {
  return useCatcherMutation(
    ({
      binId,
      responseRules,
    }: {
      binId: string;
      responseRules: HttpResponseRule[];
    }) =>
      requestApi<HttpResponseRule[]>(`/http/bins/${binId}/responses`, {
        method: "PUT",
        requestBody: responseRules,
      }),
  );
}

export function useForwardHttpRequest() {
  return useMutation({
    mutationFn: ({ requestId, url }: { requestId: string; url: string }) =>
      requestApi<HttpForwardResult>(`/http/requests/${requestId}/forward`, {
        method: "POST",
        requestBody: { url },
      }),
  });
}
