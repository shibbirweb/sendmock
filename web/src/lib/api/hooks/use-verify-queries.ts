import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSelectedProjectKey } from "@/hooks/use-selected-project";
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
  const projectFilters = {
    ...verificationFilters,
    project: useSelectedProjectKey(),
  };

  return useQuery({
    queryKey: queryKeys.verify.verifications(projectFilters),
    queryFn: ({ signal }) =>
      requestApi<PageOf<Verification>>("/verify", {
        queryParameters: projectFilters,
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.system.stats });
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

export function useDeleteVerification() {
  return useVerifyMutation((verificationSid: string) =>
    requestApi<void>(`/verify/${verificationSid}`, { method: "DELETE" }),
  );
}

/** Deletes the verifications the filters match in the chosen project, or all of them. */
export function useDeleteVerifications() {
  const projectKey = useSelectedProjectKey();

  return useVerifyMutation((verificationFilters: VerificationListFilters) =>
    requestApi<void>("/verify", {
      method: "DELETE",
      queryParameters: { ...verificationFilters, project: projectKey },
    }),
  );
}
