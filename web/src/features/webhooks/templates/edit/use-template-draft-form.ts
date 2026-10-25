import * as React from "react";
import { toast } from "sonner";

import {
  fromNameValueRows,
  type NameValueRow,
  toNameValueRows,
} from "@/components/common/name-value-rows-editor";
import { ApiError } from "@/lib/api/api-client";
import { useUpdateTemplate } from "@/lib/api/hooks/use-webhook-template-queries";
import type {
  HttpMethod,
  TemplateDraft,
  WebhookTemplateDetail,
} from "@/lib/api/types";
import {
  type TemplateDraftFieldErrors,
  validateTemplateDraft,
} from "@/lib/webhooks/validate-template-draft";

export type TemplateDraftFormValues = {
  method: HttpMethod;
  contentType: string;
  headerRows: NameValueRow[];
  bodyTemplate: string;
};

export function toTemplateDraft(
  formValues: TemplateDraftFormValues,
): TemplateDraft {
  return {
    method: formValues.method,
    content_type: formValues.contentType.trim(),
    header_templates: fromNameValueRows(formValues.headerRows),
    body_template: formValues.bodyTemplate,
  };
}

/** Draft state, shape checks and saving for the template Edit form (WH-09.7). */
export function useTemplateDraftForm({
  templateDetail,
  onSaved,
}: {
  templateDetail: WebhookTemplateDetail;
  onSaved: () => void;
}) {
  const updateTemplate = useUpdateTemplate();
  const [formValues, setFormValues] = React.useState<TemplateDraftFormValues>(
    () => ({
      method: templateDetail.method,
      contentType: templateDetail.content_type,
      headerRows: toNameValueRows(templateDetail.header_templates),
      bodyTemplate: templateDetail.body_template,
    }),
  );
  const [fieldErrors, setFieldErrors] =
    React.useState<TemplateDraftFieldErrors>({});

  const updateFormValues = (
    changedValues: Partial<TemplateDraftFormValues>,
  ) => {
    setFormValues((previousValues) => ({
      ...previousValues,
      ...changedValues,
    }));
  };

  const saveTemplate = () => {
    const templateDraft = toTemplateDraft(formValues);
    const validationErrors = validateTemplateDraft(templateDraft);
    setFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    updateTemplate.mutate(
      { templateId: templateDetail.id, templateDraft },
      {
        onSuccess: () => {
          toast("Template saved");
          onSaved();
        },
        onError: (requestError) => {
          toast.error(
            requestError instanceof ApiError
              ? requestError.message
              : "Could not save the template",
          );
        },
      },
    );
  };

  return {
    formValues,
    updateFormValues,
    fieldErrors,
    isSaving: updateTemplate.isPending,
    saveTemplate,
  };
}
