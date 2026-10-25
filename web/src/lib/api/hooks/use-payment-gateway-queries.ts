import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { requestApi } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  GatewayCredentialReveal,
  PaymentCheckoutCreateRequest,
  PaymentDetail,
  PaymentGatewayCreateRequest,
  PaymentGatewayDefinition,
  PaymentGatewayInput,
  PaymentGatewayPreview,
  PaymentGatewayPreviewRequest,
} from "@/lib/api/types";

export function usePaymentGateways() {
  return useQuery({
    queryKey: queryKeys.payments.gateways,
    queryFn: ({ signal }) =>
      requestApi<PaymentGatewayDefinition[]>("/payments/gateways", {
        abortSignal: signal,
      }),
  });
}

function useGatewayMutation<MutationInput, MutationResult>(
  mutationRequest: (mutationInput: MutationInput) => Promise<MutationResult>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: mutationRequest,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
    },
  });
}

export function useCreatePaymentGateway() {
  return useGatewayMutation((createRequest: PaymentGatewayCreateRequest) =>
    requestApi<PaymentGatewayDefinition>("/payments/gateways", {
      method: "POST",
      requestBody: createRequest,
    }),
  );
}

/** Saves a gateway; the cached list takes the saved version at once, so a reopened sheet starts from it. */
export function useSavePaymentGateway() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (gatewayInput: PaymentGatewayInput) =>
      requestApi<PaymentGatewayDefinition>(
        `/payments/gateways/${gatewayInput.key}`,
        { method: "PATCH", requestBody: gatewayInput },
      ),
    onSuccess: (savedGateway) => {
      queryClient.setQueryData<PaymentGatewayDefinition[]>(
        queryKeys.payments.gateways,
        (cachedGateways) =>
          cachedGateways?.map((cachedGateway) =>
            cachedGateway.key === savedGateway.key
              ? savedGateway
              : cachedGateway,
          ),
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
    },
  });
}

export function useResetPaymentGateway() {
  return useGatewayMutation((gatewayKey: string) =>
    requestApi<PaymentGatewayDefinition>(
      `/payments/gateways/${gatewayKey}/reset`,
      { method: "POST" },
    ),
  );
}

export function useDeletePaymentGateway() {
  return useGatewayMutation((gatewayKey: string) =>
    requestApi<null>(`/payments/gateways/${gatewayKey}`, { method: "DELETE" }),
  );
}

/** One secret credential in plain text, after the UI asked first. */
export function useRevealGatewayCredential() {
  return useMutation({
    mutationFn: ({
      gatewayKey,
      credentialName,
    }: {
      gatewayKey: string;
      credentialName: string;
    }) =>
      requestApi<GatewayCredentialReveal>(
        `/payments/gateways/${gatewayKey}/credentials/${encodeURIComponent(credentialName)}`,
      ),
  });
}

/** The live preview of an unsaved gateway (PY-12.4); the last result stays while typing. */
export function usePaymentGatewayPreview(
  previewRequest: PaymentGatewayPreviewRequest,
) {
  return useQuery({
    queryKey: queryKeys.payments.gatewayPreview(previewRequest),
    queryFn: ({ signal }) =>
      requestApi<PaymentGatewayPreview>(
        `/payments/gateways/${previewRequest.gateway.key}/preview`,
        { method: "POST", requestBody: previewRequest, abortSignal: signal },
      ),
    placeholderData: keepPreviousData,
  });
}

/** A test checkout for a gateway (`POST /payments/checkout`, PY-12.3). */
export function useCreateTestCheckout() {
  return useGatewayMutation((checkoutRequest: PaymentCheckoutCreateRequest) =>
    requestApi<PaymentDetail>("/payments/checkout", {
      method: "POST",
      requestBody: checkoutRequest,
    }),
  );
}
