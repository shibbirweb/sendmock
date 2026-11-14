import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { requestApi, requestApiText } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  TemplateImportRequest,
  TemplateReference,
  TemplateRenderRequest,
  TemplateRevision,
  TemplateUpdate,
  TemplateRenderResult,
  WebhookTemplateDetail,
  WebhookTemplateSummary,
} from "@/lib/api/types";

export function useWebhookTemplate(templateId: string) {
  return useQuery({
    queryKey: queryKeys.webhooks.template(templateId),
    queryFn: ({ signal }) =>
      requestApi<WebhookTemplateDetail>(`/webhooks/templates/${templateId}`, {
        abortSignal: signal,
      }),
  });
}

/** The template rendered against a message or the sample (WH-08.4). */
export function useTemplatePreview(
  templateId: string,
  renderRequest: TemplateRenderRequest,
) {
  return useQuery({
    queryKey: queryKeys.webhooks.templatePreview(templateId, renderRequest),
    queryFn: ({ signal }) =>
      requestApi<TemplateRenderResult>(
        `/webhooks/templates/${templateId}/render`,
        {
          method: "POST",
          requestBody: renderRequest,
          abortSignal: signal,
        },
      ),
    placeholderData: keepPreviousData,
  });
}

function useTemplateMutation<MutationInput, MutationResult>(
  mutationRequest: (mutationInput: MutationInput) => Promise<MutationResult>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: mutationRequest,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.all });
    },
  });
}

export function useCloneTemplate() {
  return useTemplateMutation(
    ({ templateId, cloneName }: { templateId: string; cloneName: string }) =>
      requestApi<WebhookTemplateSummary>(
        `/webhooks/templates/${templateId}/clone`,
        {
          method: "POST",
          requestBody: { name: cloneName },
        },
      ),
  );
}

/** Deletes a custom template; `shouldDetach` lets endpoints that use it keep a copy (WH-09.6). */
export function useDeleteTemplate() {
  return useTemplateMutation(
    ({
      templateId,
      shouldDetach,
    }: {
      templateId: string;
      shouldDetach: boolean;
    }) =>
      requestApi<null>(`/webhooks/templates/${templateId}`, {
        method: "DELETE",
        queryParameters: { endpoints: shouldDetach ? "detach" : undefined },
      }),
  );
}

export function useExportTemplate() {
  return useMutation({
    mutationFn: (templateId: string) =>
      requestApiText(`/webhooks/templates/${templateId}/export`),
  });
}

/** Saves edits to a built-in or custom template (WH-09.7). */
export function useUpdateTemplate() {
  return useTemplateMutation(
    ({
      templateId,
      templateUpdate,
    }: {
      templateId: string;
      templateUpdate: TemplateUpdate;
    }) =>
      requestApi<WebhookTemplateDetail>(`/webhooks/templates/${templateId}`, {
        method: "PATCH",
        requestBody: templateUpdate,
      }),
  );
}

/** Brings an edited built-in back to the shipped default (WH-09.8). */
export function useResetTemplate() {
  return useTemplateMutation((templateId: string) =>
    requestApi<WebhookTemplateDetail>(
      `/webhooks/templates/${templateId}/reset`,
      {
        method: "POST",
      },
    ),
  );
}

export function useCreateTemplate() {
  return useTemplateMutation((templateName: string) =>
    requestApi<WebhookTemplateSummary>("/webhooks/templates", {
      method: "POST",
      requestBody: { name: templateName },
    }),
  );
}

/** Imports a TOML or JSON template file (WH-09.3); a 409 means the id is taken. */
export function useImportTemplate() {
  return useTemplateMutation((importRequest: TemplateImportRequest) =>
    requestApi<WebhookTemplateSummary>("/webhooks/templates/import", {
      method: "POST",
      requestBody: importRequest,
    }),
  );
}

/** The last 20 saved versions of a template (WH-09.5). */
export function useTemplateRevisions(templateId: string) {
  return useQuery({
    queryKey: queryKeys.webhooks.templateRevisions(templateId),
    queryFn: ({ signal }) =>
      requestApi<TemplateRevision[]>(
        `/webhooks/templates/${templateId}/revisions`,
        {
          abortSignal: signal,
        },
      ),
  });
}

export function useRestoreTemplateRevision() {
  return useTemplateMutation(
    ({ templateId, revision }: { templateId: string; revision: number }) =>
      requestApi<WebhookTemplateDetail>(
        `/webhooks/templates/${templateId}/revisions/${revision}/restore`,
        { method: "POST" },
      ),
  );
}

/** Saves an endpoint's template and overrides as a new custom template (WH-09.1). */
export function useSaveEndpointAsTemplate() {
  return useTemplateMutation(
    ({
      endpointId,
      templateName,
    }: {
      endpointId: string;
      templateName: string;
    }) =>
      requestApi<WebhookTemplateSummary>(
        `/webhooks/endpoints/${endpointId}/save-as-template`,
        {
          method: "POST",
          requestBody: { name: templateName },
        },
      ),
  );
}

/** Fields, functions and filters a template can use for these events (WH-07.9). */
export function useTemplateReference(events: string[]) {
  const eventsText = [...events].sort().join(",");

  return useQuery({
    queryKey: queryKeys.webhooks.templateReference(eventsText),
    queryFn: ({ signal }) =>
      requestApi<TemplateReference>("/webhooks/template-reference", {
        queryParameters: { events: eventsText },
        abortSignal: signal,
      }),
    staleTime: 60_000,
  });
}
