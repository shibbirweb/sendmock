import { useMutation, useQueryClient } from "@tanstack/react-query";

import { requestApi } from "@/lib/api/api-client";
import type { CreatedSample, SampleKind } from "@/lib/api/types";

/** POST /api/v1/samples/{kind}: a sample that touches several screens (UI-04.2). */
export function useCreateSample() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sampleKind: SampleKind) =>
      requestApi<CreatedSample>(`/samples/${sampleKind}`, { method: "POST" }),
    onSuccess: () => {
      // A sample shows up in lists, logs and stats, so refresh them all.
      void queryClient.invalidateQueries();
    },
  });
}
