import { useMutation, useQueryClient } from "@tanstack/react-query";

import { requestApi } from "@/lib/api/api-client";
import type { CreatedSample, SampleKind, WebhookChoice } from "@/lib/api/types";

/** POST /api/v1/samples/{kind}: a sample that touches several screens (UI-04.2). */
export function useCreateSample() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sampleKind,
      webhookChoice = {},
    }: {
      sampleKind: SampleKind;
      /** The webhooks chosen for this one sample (WH-13.4). */
      webhookChoice?: WebhookChoice;
    }) =>
      requestApi<CreatedSample>(`/samples/${sampleKind}`, {
        method: "POST",
        requestBody:
          webhookChoice.webhook_endpoint_ids === undefined
            ? undefined
            : webhookChoice,
      }),
    onSuccess: () => {
      // A sample shows up in lists, logs and stats, so refresh them all.
      void queryClient.invalidateQueries();
    },
  });
}
