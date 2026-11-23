import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { requestApi } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type { SmsOptOut } from "@/lib/api/types";

/** Contacts who texted STOP, newest first (SM-23.3). */
export function useSmsOptOuts() {
  return useQuery({
    queryKey: queryKeys.numbers.optOuts,
    queryFn: ({ signal }) =>
      requestApi<SmsOptOut[]>("/sms/opt-outs", { abortSignal: signal }),
  });
}

function useOptOutMutation<MutationInput>(
  mutationRequest: (mutationInput: MutationInput) => Promise<unknown>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: mutationRequest,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.numbers.optOuts,
      });
    },
  });
}

/** Lifts one opt-out, as if the contact texted START. */
export function useLiftSmsOptOut() {
  return useOptOutMutation((optOut: SmsOptOut) =>
    requestApi<null>(
      `/sms/opt-outs/${encodeURIComponent(optOut.sender)}/${encodeURIComponent(optOut.contact_number)}`,
      { method: "DELETE" },
    ),
  );
}

export function useLiftAllSmsOptOuts() {
  return useOptOutMutation(() =>
    requestApi<null>("/sms/opt-outs", { method: "DELETE" }),
  );
}
