import * as React from "react";

import { RadioCardGroup } from "@/components/common/radio-card-group";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EndpointFieldsBody } from "@/features/webhooks/endpoints/sheet/request/endpoint-fields-body";
import { EndpointRawBody } from "@/features/webhooks/endpoints/sheet/request/endpoint-raw-body";
import { EndpointRequestPreview } from "@/features/webhooks/endpoints/sheet/request/endpoint-request-preview";
import { EndpointTemplateBody } from "@/features/webhooks/endpoints/sheet/request/endpoint-template-body";
import { useEndpointRequestPreview } from "@/features/webhooks/endpoints/sheet/request/use-endpoint-request-preview";
import {
  toEndpointInput,
  type WebhookEndpointFormValues,
} from "@/features/webhooks/endpoints/sheet/use-webhook-endpoint-form";
import type { CodeEditorProblem } from "@/features/webhooks/templates/reference/code-editor/code-editor-types";
import { TemplateRowsEditor } from "@/features/webhooks/templates/reference/template-rows-editor";
import { useTemplateReference } from "@/lib/api/hooks/use-webhook-template-queries";
import { useWebhookTemplates } from "@/lib/api/hooks/use-webhook-queries";
import type { EndpointBodyMode, RenderMode } from "@/lib/api/types";
import type { WebhookEndpointFieldErrors } from "@/lib/webhooks/validate-webhook-endpoint";

const bodyModes: { value: EndpointBodyMode; label: string }[] = [
  {
    value: "template",
    label: "Template",
  },
  {
    value: "fields",
    label: "Fields",
  },
  {
    value: "raw",
    label: "Raw",
  },
  {
    value: "none",
    label: "None",
  },
];

/** Events a non-template body can see, for suggestions and hover. */
const anyMessageEvents = ["email.received", "sms.inbound"];

/**
 * The request an endpoint sends (WH-07.14): query params, headers, body
 * mode and render mode, with the live preview under it (WH-07.15).
 */
export function EndpointRequestTab({
  formValues,
  fieldErrors,
  savedEndpointId,
  onChange,
}: {
  formValues: WebhookEndpointFormValues;
  fieldErrors: WebhookEndpointFieldErrors;
  savedEndpointId: string | null;
  onChange: (changedValues: Partial<WebhookEndpointFormValues>) => void;
}) {
  const selectedTemplate = useWebhookTemplates().data?.find(
    (webhookTemplate) => webhookTemplate.id === formValues.templateId,
  );
  const templateReference = useTemplateReference(
    formValues.bodyMode === "template" && selectedTemplate !== undefined
      ? selectedTemplate.events
      : anyMessageEvents,
  ).data;
  const requestPreview = useEndpointRequestPreview(
    toEndpointInput(formValues),
    savedEndpointId,
  );
  const previewProblems = requestPreview.previewQuery.data?.problems;
  const editorProblems = React.useMemo<CodeEditorProblem[]>(
    () =>
      (previewProblems ?? []).flatMap((renderProblem) =>
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
    [previewProblems],
  );

  return (
    <div className="grid gap-5">
      <TemplateRowsEditor
        legend="Query params"
        rowLabel="Query param"
        namePlaceholder="ref"
        emptyText="None. Added to the URL, URL-encoded."
        rows={formValues.queryRows}
        templateReference={templateReference}
        onChange={(queryRows) => {
          onChange({ queryRows });
        }}
      />
      <TemplateRowsEditor
        legend="Headers"
        rowLabel="Header"
        namePlaceholder="X-Tenant"
        emptyText="None besides Content-Type and the signature headers."
        rows={formValues.headerRows}
        templateReference={templateReference}
        onChange={(headerRows) => {
          onChange({ headerRows });
        }}
      />
      <fieldset className="grid gap-3">
        <legend className="mb-1 text-sm font-medium">Body</legend>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          aria-label="Body mode"
          className="justify-self-start"
          value={formValues.bodyMode}
          onValueChange={(selectedMode) => {
            if (selectedMode !== "") {
              onChange({ bodyMode: selectedMode as EndpointBodyMode });
            }
          }}
        >
          {bodyModes.map((bodyMode) => (
            <ToggleGroupItem
              key={bodyMode.value}
              value={bodyMode.value}
              className="px-3"
            >
              {bodyMode.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {formValues.bodyMode === "template" && (
          <EndpointTemplateBody
            formValues={formValues}
            savedEndpointId={savedEndpointId}
            onChange={onChange}
          />
        )}
        {formValues.bodyMode === "fields" && (
          <EndpointFieldsBody
            formValues={formValues}
            errorMessage={fieldErrors.body_fields}
            templateReference={templateReference}
            onChange={onChange}
          />
        )}
        {formValues.bodyMode === "raw" && (
          <EndpointRawBody
            formValues={formValues}
            contentTypeError={fieldErrors.raw_content_type}
            templateReference={templateReference}
            editorProblems={editorProblems}
            onChange={onChange}
          />
        )}
        {formValues.bodyMode === "none" && (
          <p className="text-xs text-muted-foreground">
            The request is sent without a body.
          </p>
        )}
      </fieldset>
      <RadioCardGroup<RenderMode>
        legend="Rendering"
        className="sm:grid-cols-2"
        selectedValue={formValues.renderMode}
        options={[
          {
            value: "strict",
            label: "Strict",
            description:
              "An undefined value stops the delivery as render failed.",
          },
          {
            value: "lenient",
            label: "Lenient",
            description: "An undefined value renders empty, with a warning.",
          },
        ]}
        onSelect={(renderMode) => {
          onChange({ renderMode });
        }}
      />
      <Separator />
      <EndpointRequestPreview requestPreview={requestPreview} />
    </div>
  );
}
