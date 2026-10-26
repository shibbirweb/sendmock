import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { requestApi } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  MessageProviderArea,
  MessageProviderCreateRequest,
  MessageProviderDefinition,
  MessageProviderInput,
  MessageProviderPreview,
  MessageProviderPreviewRequest,
  ProviderCredentialReveal,
} from "@/lib/api/types";

/** `/emails/providers` or `/sms/providers` (docs/plan/22-configurable-providers.md). */
export function toProvidersPath(providerArea: MessageProviderArea): string {
  return providerArea === "email" ? "/emails/providers" : "/sms/providers";
}

export function useMessageProviders(providerArea: MessageProviderArea) {
  return useQuery({
    queryKey: queryKeys.messageProviders.list(providerArea),
    queryFn: ({ signal }) =>
      requestApi<MessageProviderDefinition[]>(toProvidersPath(providerArea), {
        abortSignal: signal,
      }),
  });
}

function useProviderMutation<MutationInput, MutationResult>(
  mutationRequest: (mutationInput: MutationInput) => Promise<MutationResult>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: mutationRequest,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.messageProviders.all,
      });
    },
  });
}

export function useCreateMessageProvider(providerArea: MessageProviderArea) {
  return useProviderMutation((createRequest: MessageProviderCreateRequest) =>
    requestApi<MessageProviderDefinition>(toProvidersPath(providerArea), {
      method: "POST",
      requestBody: createRequest,
    }),
  );
}

/** Saves a provider; the cached list takes the saved version at once. */
export function useSaveMessageProvider(providerArea: MessageProviderArea) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (providerInput: MessageProviderInput) =>
      requestApi<MessageProviderDefinition>(
        `${toProvidersPath(providerArea)}/${providerInput.key}`,
        { method: "PATCH", requestBody: providerInput },
      ),
    onSuccess: (savedProvider) => {
      queryClient.setQueryData<MessageProviderDefinition[]>(
        queryKeys.messageProviders.list(providerArea),
        (cachedProviders) =>
          cachedProviders?.map((cachedProvider) =>
            cachedProvider.key === savedProvider.key
              ? savedProvider
              : cachedProvider,
          ),
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.messageProviders.all,
      });
    },
  });
}

export function useResetMessageProvider(providerArea: MessageProviderArea) {
  return useProviderMutation((providerKey: string) =>
    requestApi<MessageProviderDefinition>(
      `${toProvidersPath(providerArea)}/${providerKey}/reset`,
      { method: "POST" },
    ),
  );
}

export function useRestoreMessageProvider(providerArea: MessageProviderArea) {
  return useProviderMutation((providerKey: string) =>
    requestApi<MessageProviderDefinition>(
      `${toProvidersPath(providerArea)}/${providerKey}/restore`,
      { method: "POST" },
    ),
  );
}

/** Removes a built-in (restorable) or deletes a custom provider. */
export function useDeleteMessageProvider(providerArea: MessageProviderArea) {
  return useProviderMutation((providerKey: string) =>
    requestApi<null>(`${toProvidersPath(providerArea)}/${providerKey}`, {
      method: "DELETE",
    }),
  );
}

/** One secret credential in plain text, after the UI asked first. */
export function useRevealProviderCredential(providerArea: MessageProviderArea) {
  return useMutation({
    mutationFn: ({
      providerKey,
      credentialName,
    }: {
      providerKey: string;
      credentialName: string;
    }) =>
      requestApi<ProviderCredentialReveal>(
        `${toProvidersPath(providerArea)}/${providerKey}/credentials/${encodeURIComponent(credentialName)}`,
      ),
  });
}

/** The live preview of an unsaved provider; the last result stays while typing. */
export function useMessageProviderPreview(
  providerArea: MessageProviderArea,
  previewRequest: MessageProviderPreviewRequest,
) {
  return useQuery({
    queryKey: queryKeys.messageProviders.preview(providerArea, previewRequest),
    queryFn: ({ signal }) =>
      requestApi<MessageProviderPreview>(
        `${toProvidersPath(providerArea)}/${previewRequest.provider.key}/preview`,
        { method: "POST", requestBody: previewRequest, abortSignal: signal },
      ),
    placeholderData: keepPreviousData,
  });
}
