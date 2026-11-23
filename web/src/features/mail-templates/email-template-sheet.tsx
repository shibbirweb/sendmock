import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useEmailTemplateForm } from "@/features/mail-templates/use-email-template-form";
import type { EmailTemplate } from "@/lib/api/types";

function EmailTemplateForm({
  editedTemplate,
  onDone,
  onDelete,
}: {
  editedTemplate: EmailTemplate | null;
  onDone: () => void;
  onDelete: (emailTemplate: EmailTemplate) => void;
}) {
  const fieldIdPrefix = React.useId();
  const {
    formValues,
    updateFormValues,
    fieldErrors,
    isSaving,
    saveError,
    saveTemplate,
  } = useEmailTemplateForm({ editedTemplate, onSaved: onDone });

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        saveTemplate();
      }}
    >
      <div className="grid gap-4 overflow-y-auto px-4">
        <FormField
          label="Template id or name"
          fieldId={`${fieldIdPrefix}-id`}
          hint="As your app sends it: SendGrid's d-..., Postmark's number or alias, Mailgun's template name."
          errorMessage={fieldErrors.id}
        >
          <Input
            id={`${fieldIdPrefix}-id`}
            value={formValues.id}
            disabled={editedTemplate !== null}
            onChange={(changeEvent) =>
              updateFormValues({ id: changeEvent.target.value })
            }
          />
        </FormField>
        <FormField
          label="Subject"
          fieldId={`${fieldIdPrefix}-subject`}
          hint="Used when the send gives none; reads the template data as {{ first_name }}."
        >
          <Input
            id={`${fieldIdPrefix}-subject`}
            value={formValues.subject}
            onChange={(changeEvent) =>
              updateFormValues({ subject: changeEvent.target.value })
            }
          />
        </FormField>
        <FormField
          label="Text body"
          fieldId={`${fieldIdPrefix}-text`}
          errorMessage={fieldErrors.text}
        >
          <Textarea
            id={`${fieldIdPrefix}-text`}
            rows={6}
            value={formValues.text}
            onChange={(changeEvent) =>
              updateFormValues({ text: changeEvent.target.value })
            }
          />
        </FormField>
        <FormField label="HTML body" fieldId={`${fieldIdPrefix}-html`}>
          <Textarea
            id={`${fieldIdPrefix}-html`}
            rows={6}
            className="font-mono text-xs"
            value={formValues.html}
            onChange={(changeEvent) =>
              updateFormValues({ html: changeEvent.target.value })
            }
          />
        </FormField>
        {saveError !== null && (
          <p role="alert" className="text-sm text-destructive">
            {saveError.message}
          </p>
        )}
      </div>
      <SheetFooter className="flex-row justify-between">
        {editedTemplate !== null ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => onDelete(editedTemplate)}
          >
            Delete
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={isSaving}>
          Save
        </Button>
      </SheetFooter>
    </form>
  );
}

/** The sheet that adds a template, or changes or deletes one (EM-26.2). */
export function EmailTemplateSheet({
  isOpen,
  editedTemplate,
  onClose,
  onDelete,
}: {
  isOpen: boolean;
  editedTemplate: EmailTemplate | null;
  onClose: () => void;
  onDelete: (emailTemplate: EmailTemplate) => void;
}) {
  return (
    <Sheet
      open={isOpen}
      onOpenChange={(isSheetOpen) => {
        if (!isSheetOpen) {
          onClose();
        }
      }}
    >
      <SheetContent className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {editedTemplate === null ? "New template" : editedTemplate.id}
          </SheetTitle>
          <SheetDescription>
            A provider send that names this template gets its subject and
            bodies, rendered from the send&apos;s template data.
          </SheetDescription>
        </SheetHeader>
        {isOpen && (
          <EmailTemplateForm
            key={editedTemplate?.id ?? "new"}
            editedTemplate={editedTemplate}
            onDone={onClose}
            onDelete={onDelete}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
