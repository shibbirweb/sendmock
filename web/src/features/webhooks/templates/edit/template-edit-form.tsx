import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { FormFieldError } from "@/components/common/form-field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { TemplateMetadataFields } from "@/features/webhooks/templates/edit/template-metadata-fields";
import { CodeEditor } from "@/features/webhooks/templates/reference/code-editor/code-editor";
import type {
  CodeEditorHandle,
  CodeEditorProblem,
} from "@/features/webhooks/templates/reference/code-editor/code-editor-types";
import { TemplateInsertMenu } from "@/features/webhooks/templates/reference/template-insert-menu";
import { TemplateReferencePanel } from "@/features/webhooks/templates/reference/template-reference-panel";
import { TemplateRowsEditor } from "@/features/webhooks/templates/reference/template-rows-editor";
import { TemplatePreview } from "@/features/webhooks/templates/detail/template-preview";
import { useTemplatePreview } from "@/features/webhooks/templates/detail/use-template-preview";
import {
  toTemplateDraft,
  useTemplateDraftForm,
} from "@/features/webhooks/templates/edit/use-template-draft-form";
import { useTemplateReference } from "@/lib/api/hooks/use-webhook-template-queries";
import type { HttpMethod, WebhookTemplateDetail } from "@/lib/api/types";

const templateMethods: HttpMethod[] = ["POST", "PUT", "PATCH", "GET"];

/** Basic template editing with the preview following the draft (WH-09.7). */
export function TemplateEditForm({
  templateDetail,
  onDone,
}: {
  templateDetail: WebhookTemplateDetail;
  onDone: () => void;
}) {
  const fieldIdPrefix = React.useId();
  const { formValues, updateFormValues, fieldErrors, isSaving, saveTemplate } =
    useTemplateDraftForm({ templateDetail, onSaved: onDone });
  const templatePreview = useTemplatePreview(
    templateDetail,
    toTemplateDraft(formValues),
  );
  const renderErrors = templatePreview.previewQuery.data?.errors ?? [];
  const bodyEditorRef = React.useRef<CodeEditorHandle | null>(null);
  const renderProblems = templatePreview.previewQuery.data?.problems;
  const bodyProblems = React.useMemo<CodeEditorProblem[]>(
    () =>
      (renderProblems ?? []).flatMap((renderProblem) =>
        renderProblem.source === "body" &&
        renderProblem.line !== null &&
        renderProblem.column !== null
          ? [
              {
                ...renderProblem,
                line: renderProblem.line,
                column: renderProblem.column,
              },
            ]
          : [],
      ),
    [renderProblems],
  );
  const templateReference = useTemplateReference(
    templateDetail.source === "custom"
      ? formValues.events
      : templateDetail.events,
  ).data;
  const isBuiltin = templateDetail.source === "builtin";

  return (
    <form
      noValidate
      aria-label={`Edit ${templateDetail.name}`}
      className="grid min-w-0 gap-4"
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        saveTemplate();
      }}
    >
      {isBuiltin && (
        <p className="rounded-md border bg-muted/40 p-3 text-xs">
          Your edit replaces this built-in template for every endpoint that uses
          it. Reset to default brings back the shipped version at any time.
        </p>
      )}
      {templateDetail.source === "custom" && (
        <TemplateMetadataFields
          formValues={formValues}
          fieldErrors={fieldErrors}
          onChange={updateFormValues}
        />
      )}
      <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3">
        <FormField
          label="Method"
          fieldId={`${fieldIdPrefix}-method`}
          errorMessage={fieldErrors.method}
        >
          <Select
            value={formValues.method}
            onValueChange={(selectedMethod) => {
              updateFormValues({ method: selectedMethod as HttpMethod });
            }}
          >
            <SelectTrigger id={`${fieldIdPrefix}-method`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {templateMethods.map((templateMethod) => (
                <SelectItem key={templateMethod} value={templateMethod}>
                  {templateMethod}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField
          label="Content type"
          fieldId={`${fieldIdPrefix}-content-type`}
          errorMessage={fieldErrors.content_type}
        >
          <Input
            id={`${fieldIdPrefix}-content-type`}
            className="font-mono text-xs"
            value={formValues.contentType}
            aria-invalid={fieldErrors.content_type !== undefined}
            onChange={(changeEvent) => {
              updateFormValues({ contentType: changeEvent.target.value });
            }}
          />
        </FormField>
      </div>
      <div className="grid gap-1">
        <TemplateRowsEditor
          legend="Header templates"
          rowLabel="Header"
          namePlaceholder="X-Signature"
          emptyText="None besides Content-Type."
          rows={formValues.headerRows}
          templateReference={templateReference}
          onChange={(headerRows) => {
            updateFormValues({ headerRows });
          }}
        />
        <FormFieldError errorMessage={fieldErrors.header_templates} />
      </div>
      <div className="grid min-w-0 items-start gap-3 md:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="grid min-w-0 gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">Body template</span>
            <TemplateInsertMenu
              onInsert={(insertText) => {
                bodyEditorRef.current?.insertText(insertText);
              }}
            />
          </div>
          <CodeEditor
            ariaLabel="Body template"
            language={formValues.contentType.includes("json") ? "json" : "text"}
            minHeightClassName="min-h-80"
            value={formValues.bodyTemplate}
            isInvalid={fieldErrors.body_template !== undefined}
            templateReference={templateReference}
            problems={bodyProblems}
            handleRef={bodyEditorRef}
            onChange={(bodyTemplate) => {
              updateFormValues({ bodyTemplate });
            }}
          />
          <p className="text-xs text-muted-foreground">
            Type {"{{"} to see what you can use, or pick from the reference.
          </p>
          <FormFieldError errorMessage={fieldErrors.body_template} />
        </div>
        <TemplateReferencePanel
          templateReference={templateReference}
          onInsert={(insertText) => {
            bodyEditorRef.current?.insertText(insertText);
          }}
        />
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving || renderErrors.length > 0}>
          Save template
        </Button>
      </div>
      <Separator />
      <TemplatePreview
        templatePreview={templatePreview}
        contentType={formValues.contentType}
      />
    </form>
  );
}
