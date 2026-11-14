import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { requestApi } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  ApiRequestLogEntry,
  ApiRequestLogFilters,
  PageOf,
  SmtpSession,
  SmtpSessionListFilters,
} from "@/lib/api/types";

/** Rows per page; logs grow large, so they always load in pages (EM-09.5). */
const logPageSize = 50;

export function useSmtpSessions(sessionFilters: SmtpSessionListFilters = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.logs.smtpSessions(sessionFilters),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      requestApi<PageOf<SmtpSession>>("/logs/smtp", {
        queryParameters: {
          ...sessionFilters,
          cursor: pageParam,
          limit: logPageSize,
        },
        abortSignal: signal,
      }),
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });
}

export function useSmtpSession(sessionId: string) {
  return useQuery({
    queryKey: queryKeys.logs.smtpSession(sessionId),
    queryFn: ({ signal }) =>
      requestApi<SmtpSession>(`/logs/smtp/${sessionId}`, {
        abortSignal: signal,
      }),
  });
}

export function useApiRequestLog(requestFilters: ApiRequestLogFilters = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.logs.apiRequests(requestFilters),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      requestApi<PageOf<ApiRequestLogEntry>>("/logs/http", {
        queryParameters: {
          ...requestFilters,
          cursor: pageParam,
          limit: logPageSize,
        },
        abortSignal: signal,
      }),
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });
}

export function useApiRequest(requestId: string) {
  return useQuery({
    queryKey: queryKeys.logs.apiRequest(requestId),
    queryFn: ({ signal }) =>
      requestApi<ApiRequestLogEntry>(`/logs/http/${requestId}`, {
        abortSignal: signal,
      }),
  });
}
