import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { requestApi } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type { MailgunComplaint } from "@/lib/api/types";

/** Every Mailgun domain's complaints table (EM-23.5). */
export function useMailgunComplaints() {
  return useQuery({
    queryKey: queryKeys.mailgun.complaints,
    queryFn: ({ signal }) =>
      requestApi<MailgunComplaint[]>("/mailgun/complaints", {
        abortSignal: signal,
      }),
  });
}

export function useClearMailgunComplaints() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (domain: string) =>
      requestApi<void>(`/mailgun/complaints/${encodeURIComponent(domain)}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.mailgun.complaints,
      });
    },
  });
}
