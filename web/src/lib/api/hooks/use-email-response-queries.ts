import { useMutation, useQueryClient } from "@tanstack/react-query";

import { requestApi } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import { getQueryRefresher } from "@/lib/api/query-refresher";
import type {
  EmailDetail,
  EmailForwardRequest,
  EmailReplyRequest,
} from "@/lib/api/types";

/** Simulated recipient replies and forwards; both return the new inbound email. */

function useEmailResponseMutation<MutationInput>(
  mutationRequest: (mutationInput: MutationInput) => Promise<EmailDetail>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: mutationRequest,
    onSuccess: () => {
      // Without cancelling: a live refresh of a list may be running (PL-02.3).
      const queryRefresher = getQueryRefresher(queryClient);
      queryRefresher.refreshQueries(queryKeys.emails.all);
      queryRefresher.refreshQueries(queryKeys.system.stats);
    },
  });
}

export function useReplyToEmail() {
  return useEmailResponseMutation(
    ({
      emailId,
      replyRequest,
    }: {
      emailId: string;
      replyRequest: EmailReplyRequest;
    }) =>
      requestApi<EmailDetail>(`/emails/${emailId}/reply`, {
        method: "POST",
        requestBody: replyRequest,
      }),
  );
}

export function useForwardEmail() {
  return useEmailResponseMutation(
    ({
      emailId,
      forwardRequest,
    }: {
      emailId: string;
      forwardRequest: EmailForwardRequest;
    }) =>
      requestApi<EmailDetail>(`/emails/${emailId}/forward`, {
        method: "POST",
        requestBody: forwardRequest,
      }),
  );
}
