import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { NameValueRowsEditor } from "@/components/common/name-value-rows-editor";
import { RadioCardGroup } from "@/components/common/radio-card-group";
import { TemplatePicker } from "@/features/webhooks/endpoints/sheet/template-picker";
import type { WebhookEndpointFormValues } from "@/features/webhooks/endpoints/sheet/use-webhook-endpoint-form";
import { useWebhookTemplates } from "@/lib/api/hooks/use-webhook-queries";
import type { TemplateMode } from "@/lib/api/types";

/** Template picker, link mode and the overrides layered on top. */
export function EndpointTemplateTab({
  formValues,
  onChange,
}: {
  formValues: WebhookEndpointFormValues;
  onChange: (changedValues: Partial<WebhookEndpointFormValues>) => void;
}) {
  const fieldIdPrefix = React.useId();
  const templatesQuery = useWebhookTemplates();
  const webhookTemplates = templatesQuery.data ?? [];
  const selectedTemplate = webhookTemplates.find(
    (webhookTemplate) => webhookTemplate.id === formValues.templateId,
  );
  const isBuiltinTemplate = selectedTemplate?.source !== "custom";

  return (
    <div className="grid gap-4">
      <FormField
        label="Template"
        fieldId={`${fieldIdPrefix}-template`}
        hint={selectedTemplate?.description}
      >
        <TemplatePicker
          pickerId={`${fieldIdPrefix}-template`}
          webhookTemplates={webhookTemplates}
          selectedTemplateId={formValues.templateId}
          onSelect={(webhookTemplate) => {
            onChange({
              templateId: webhookTemplate.id,
              templateMode:
                webhookTemplate.source === "custom"
                  ? formValues.templateMode
                  : "linked",
            });
          }}
        />
      </FormField>
      {selectedTemplate !== undefined && (
        <p className="text-xs text-muted-foreground">
          Based on {selectedTemplate.name} rev {selectedTemplate.revision}
          {isBuiltinTemplate &&
            ". Built-in and file templates are always linked: clone one to freeze it."}
        </p>
      )}
      <RadioCardGroup<TemplateMode>
        legend="Link mode"
        selectedValue={formValues.templateMode}
        options={[
          {
            value: "linked",
            label: "Linked",
            description: "Follows template updates; overrides go on top.",
          },
          {
            value: "detached",
            label: "Detached",
            description: "A private copy that never changes on its own.",
            isDisabled: isBuiltinTemplate,
          },
        ]}
        onSelect={(templateMode) => {
          onChange({ templateMode });
        }}
      />
      <div className="grid gap-4 rounded-md border p-3">
        <div className="grid gap-0.5">
          <h3 className="text-sm font-medium">Overrides</h3>
          <p className="text-xs text-muted-foreground">
            Added to what the template sends. Values accept {"{{ }}"} templates,
            such as {"{{ vars.tenant_id }}"}.
          </p>
        </div>
        <NameValueRowsEditor
          legend="Extra headers"
          rowLabel="Header"
          namePlaceholder="X-Tenant"
          emptyText="None."
          rows={formValues.headerRows}
          onChange={(headerRows) => {
            onChange({ headerRows });
          }}
        />
        <NameValueRowsEditor
          legend="Extra body fields"
          rowLabel="Field"
          namePlaceholder="environment"
          emptyText="None."
          rows={formValues.fieldRows}
          onChange={(fieldRows) => {
            onChange({ fieldRows });
          }}
        />
      </div>
    </div>
  );
}
