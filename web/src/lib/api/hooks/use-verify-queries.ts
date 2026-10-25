import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { requestApi } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  ForcedVerificationState,
  PageOf,
  Verification,
  VerificationDetail,
  VerificationListFilters,
  VerifyService,
  VerifyServiceInput,
} from "@/lib/api/types";

export function useVerifications(
  verificationFilters: VerificationListFilters = {},
) {
  return useQuery({
    queryKey: queryKeys.verify.verifications(verificationFilters),
    queryFn: ({ signal }) =>
      requestApi<PageOf<Verification>>("/verify", {
        queryParameters: verificationFilters,
        abortSignal: signal,
      }),
  });
}

export function useVerification(verificationSid: string) {
  return useQuery({
    queryKey: queryKeys.verify.detail(verificationSid),
    queryFn: ({ signal }) =>
      requestApi<VerificationDetail>(`/verify/${verificationSid}`, {
        abortSignal: signal,
      }),
  });
}

export function useVerifyServices() {
  return useQuery({
    queryKey: queryKeys.verify.services,
    queryFn: ({ signal }) =>
      requestApi<VerifyService[]>("/verify/services", { abortSignal: signal }),
  });
}

function useVerifyMutation<MutationInput, MutationResult>(
  mutationRequest: (mutationInput: MutationInput) => Promise<MutationResult>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: mutationRequest,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.verify.all });
    },
  });
}

export function useForceVerificationState() {
  return useVerifyMutation(
    ({
      verificationSid,
      forcedState,
    }: {
      verificationSid: string;
      forcedState: ForcedVerificationState;
    }) =>
      requestApi<VerificationDetail>(`/verify/${verificationSid}/force`, {
        method: "POST",
        requestBody: { state: forcedState },
      }),
  );
}

export function useCreateVerifyService() {
  return useVerifyMutation((serviceInput: VerifyServiceInput) =>
    requestApi<VerifyService>("/verify/services", {
      method: "POST",
      requestBody: serviceInput,
    }),
  );
}

export function useUpdateVerifyService() {
  return useVerifyMutation(
    ({
      serviceSid,
      serviceInput,
    }: {
      serviceSid: string;
      serviceInput: VerifyServiceInput;
    }) =>
      requestApi<VerifyService>(`/verify/services/${serviceSid}`, {
        method: "PATCH",
        requestBody: serviceInput,
      }),
  );
}

export function useDeleteVerifyService() {
  return useVerifyMutation((serviceSid: string) =>
    requestApi<void>(`/verify/services/${serviceSid}`, { method: "DELETE" }),
  );
}
