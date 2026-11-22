import * as React from "react";

import {
  useCreateEmailTemplate,
  useUpdateEmailTemplate,
} from "@/lib/api/hooks/use-email-template-queries";
import type { EmailTemplate } from "@/lib/api/types";

export type EmailTemplateFormValues = {
  id: string;
  subject: string;
  text: string;
  html: string;
};

type FieldErrors = Partial<Record<keyof EmailTemplateFormValues, string>>;

function toFormValues(
  emailTemplate: EmailTemplate | null,
): EmailTemplateFormValues {
  return {
    id: emailTemplate?.id ?? "",
    subject: emailTemplate?.subject ?? "",
    text: emailTemplate?.text ?? "",
    html: emailTemplate?.html ?? "",
  };
}

/** The fields that block saving, with what to fix, as the API checks them. */
export function findTemplateFieldErrors(
  formValues: EmailTemplateFormValues,
): FieldErrors {
  const fieldErrors: FieldErrors = {};
  if (formValues.id.trim() === "") {
    fieldErrors.id = "Enter the provider's template id or name";
  }
  if (formValues.text.trim() === "" && formValues.html.trim() === "") {
    fieldErrors.text = "Write a text or HTML body";
  }
  return fieldErrors;
}

/** The sheet's form: create when `editedTemplate` is null, change it otherwise. */
export function useEmailTemplateForm({
  editedTemplate,
  onSaved,
}: {
  editedTemplate: EmailTemplate | null;
  onSaved: () => void;
}) {
  const [formValues, setFormValues] = React.useState(() =>
    toFormValues(editedTemplate),
  );
  const [hasTriedSaving, setHasTriedSaving] = React.useState(false);
  const createTemplate = useCreateEmailTemplate();
  const updateTemplate = useUpdateEmailTemplate();
  const fieldErrors = findTemplateFieldErrors(formValues);

  const updateFormValues = (
    changedValues: Partial<EmailTemplateFormValues>,
  ) => {
    setFormValues((previousValues) => ({
      ...previousValues,
      ...changedValues,
    }));
  };

  const saveTemplate = () => {
    setHasTriedSaving(true);
    if (Object.keys(fieldErrors).length > 0) {
      return;
    }
    const bodies = {
      subject: formValues.subject,
      text: formValues.text === "" ? null : formValues.text,
      html: formValues.html === "" ? null : formValues.html,
    };
    if (editedTemplate === null) {
      createTemplate.mutate(
        { id: formValues.id.trim(), ...bodies },
        { onSuccess: onSaved },
      );
      return;
    }
    updateTemplate.mutate(
      { templateId: editedTemplate.id, changes: bodies },
      { onSuccess: onSaved },
    );
  };

  return {
    formValues,
    updateFormValues,
    fieldErrors: hasTriedSaving ? fieldErrors : {},
    isSaving: createTemplate.isPending || updateTemplate.isPending,
    saveError: createTemplate.error ?? updateTemplate.error,
    saveTemplate,
  };
}
