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
  AppEventType,
  HttpMethod,
  TemplateDraft,
  TemplateUpdate,
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
  /** Only sent for custom templates (WH-09.9). */
  name: string;
  description: string;
  events: AppEventType[];
  requiredVariables: string[];
};

export type TemplateFormFieldErrors = TemplateDraftFieldErrors & {
  name?: string;
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

function toTemplateUpdate(
  formValues: TemplateDraftFormValues,
  isCustomTemplate: boolean,
): TemplateUpdate {
  const templateDraft = toTemplateDraft(formValues);
  if (!isCustomTemplate) {
    return templateDraft;
  }

  return {
    ...templateDraft,
    name: formValues.name,
    description: formValues.description,
    events: formValues.events,
    required_variables: formValues.requiredVariables,
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
      name: templateDetail.name,
      description: templateDetail.description,
      events: templateDetail.events,
      requiredVariables: templateDetail.required_variables,
    }),
  );
  const [fieldErrors, setFieldErrors] = React.useState<TemplateFormFieldErrors>(
    {},
  );

  const updateFormValues = (
    changedValues: Partial<TemplateDraftFormValues>,
  ) => {
    setFormValues((previousValues) => ({
      ...previousValues,
      ...changedValues,
    }));
  };

  const saveTemplate = () => {
    const isCustomTemplate = templateDetail.source === "custom";
    const templateDraft = toTemplateDraft(formValues);
    const validationErrors: TemplateFormFieldErrors =
      validateTemplateDraft(templateDraft);
    if (isCustomTemplate && formValues.name.trim() === "") {
      validationErrors.name = "Enter a name";
    }
    setFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    updateTemplate.mutate(
      {
        templateId: templateDetail.id,
        templateUpdate: toTemplateUpdate(formValues, isCustomTemplate),
      },
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
