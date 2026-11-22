import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { requestApi } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type { EmailTemplate, EmailTemplateChanges } from "@/lib/api/types";

/** The local email templates provider sends use (EM-26.2). */
export function useEmailTemplates() {
  return useQuery({
    queryKey: queryKeys.emailTemplates,
    queryFn: ({ signal }) =>
      requestApi<EmailTemplate[]>("/emails/templates", { abortSignal: signal }),
  });
}

function useEmailTemplateMutation<Variables>(
  mutationFn: (variables: Variables) => Promise<unknown>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.emailTemplates,
      });
    },
  });
}

export function useCreateEmailTemplate() {
  return useEmailTemplateMutation((emailTemplate: EmailTemplate) =>
    requestApi<EmailTemplate>("/emails/templates", {
      method: "POST",
      requestBody: emailTemplate,
    }),
  );
}

export function useUpdateEmailTemplate() {
  return useEmailTemplateMutation(
    ({
      templateId,
      changes,
    }: {
      templateId: string;
      changes: EmailTemplateChanges;
    }) =>
      requestApi<EmailTemplate>(
        `/emails/templates/${encodeURIComponent(templateId)}`,
        {
          method: "PATCH",
          requestBody: changes,
        },
      ),
  );
}

export function useDeleteEmailTemplate() {
  return useEmailTemplateMutation((templateId: string) =>
    requestApi<void>(`/emails/templates/${encodeURIComponent(templateId)}`, {
      method: "DELETE",
    }),
  );
}
