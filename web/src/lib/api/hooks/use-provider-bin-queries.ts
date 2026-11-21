import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { requestApi } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  ProviderArea,
  ProviderBin,
  ProviderBinAttachment,
} from "@/lib/api/types";

/** Which bin answers each provider's unmatched requests (PL-21.1). */
export function useProviderBins() {
  return useQuery({
    queryKey: queryKeys.httpCatcher.providerBins,
    queryFn: ({ signal }) =>
      requestApi<ProviderBin[]>("/provider-bins", { abortSignal: signal }),
  });
}

/** A provider, by area and key. */
export type ProviderReference = {
  area: ProviderArea;
  providerKey: string;
};

function useProviderBinMutation<MutationInput, MutationResult>(
  mutationRequest: (mutationInput: MutationInput) => Promise<MutationResult>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: mutationRequest,
    onSuccess: () => {
      // Attaching can make a new bin, so the bins list refreshes too.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.httpCatcher.all,
      });
    },
  });
}

/** Sends the provider's unmatched requests to the named bin, made if new. */
export function useAttachProviderBin() {
  return useProviderBinMutation(
    ({
      providerReference,
      binName,
    }: {
      providerReference: ProviderReference;
      binName: string;
    }) => {
      const attachment: ProviderBinAttachment = { bin_name: binName };
      return requestApi<ProviderBin>(
        `/provider-bins/${providerReference.area}/${providerReference.providerKey}`,
        { method: "PUT", requestBody: attachment },
      );
    },
  );
}

/** Answers the provider's unmatched requests with its 404 again. */
export function useDetachProviderBin() {
  return useProviderBinMutation((providerReference: ProviderReference) =>
    requestApi<void>(
      `/provider-bins/${providerReference.area}/${providerReference.providerKey}`,
      { method: "DELETE" },
    ),
  );
}
