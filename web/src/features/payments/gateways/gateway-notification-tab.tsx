import type * as React from "react";

import { FormFieldError } from "@/components/common/form-field-error";
import { RadioCardGroup } from "@/components/common/radio-card-group";
import { Input } from "@/components/ui/input";
import type { PaymentGatewayForm } from "@/features/payments/gateways/use-payment-gateway-form";
import { CodeEditor } from "@/features/webhooks/templates/reference/code-editor/code-editor";
import type { CodeEditorHandle } from "@/features/webhooks/templates/reference/code-editor/code-editor-types";
import { TemplateRowsEditor } from "@/features/webhooks/templates/reference/template-rows-editor";
import type { PaymentEventType } from "@/lib/api/types";

function EventNamesTable({ gatewayForm }: { gatewayForm: PaymentGatewayForm }) {
  const { gatewayInput, updateInput } = gatewayForm;

  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1 text-sm font-medium">Event names</legend>
      <p className="text-xs text-muted-foreground">
        This gateway&apos;s name for each event, read as{" "}
        <code className="font-mono">{"{{ event.name }}"}</code>. Leave one blank
        and nothing is sent for it.
      </p>
      <div className="grid gap-1.5">
        {(Object.keys(gatewayInput.event_names) as PaymentEventType[]).map(
          (eventType) => (
            <label
              key={eventType}
              className="grid grid-cols-[13rem_1fr] items-center gap-2 text-xs"
            >
              <code className="font-mono text-muted-foreground">
                {eventType}
              </code>
              <Input
                aria-label={`Event name for ${eventType}`}
                className="h-8 font-mono text-xs"
                placeholder="not sent"
                value={gatewayInput.event_names[eventType]}
                onChange={(changeEvent) =>
                  updateInput({
                    event_names: {
                      ...gatewayInput.event_names,
                      [eventType]: changeEvent.target.value,
                    },
                  })
                }
              />
            </label>
          ),
        )}
      </div>
    </fieldset>
  );
}

/** Content type, event names, the body template and header templates (PY-12.2). */
export function GatewayNotificationTab({
  gatewayForm,
  bodyEditorRef,
}: {
  gatewayForm: PaymentGatewayForm;
  bodyEditorRef: React.RefObject<CodeEditorHandle | null>;
}) {
  const { gatewayInput, fieldErrors, updateInput } = gatewayForm;
  const templateReference = gatewayForm.previewQuery.data?.reference;
  const bodyErrors = gatewayForm.templateErrors.filter(
    (templateError) => templateError.part === "Notification body",
  );

  return (
    <div className="grid content-start gap-5">
      <RadioCardGroup<"json" | "form">
        legend="Content type"
        className="sm:grid-cols-2"
        selectedValue={gatewayInput.notification_content_type}
        options={[
          {
            value: "json",
            label: "JSON",
            description: "application/json (Stripe, PayPal, bKash).",
          },
          {
            value: "form",
            label: "Form",
            description:
              "application/x-www-form-urlencoded; write the body as name=value&... (SSLCommerz IPN).",
          },
        ]}
        onSelect={(contentType) =>
          updateInput({ notification_content_type: contentType })
        }
      />
      <EventNamesTable gatewayForm={gatewayForm} />
      <div className="grid gap-1.5">
        <span className="text-sm font-medium">Body template</span>
        <CodeEditor
          ariaLabel="Notification body template"
          language={
            gatewayInput.notification_content_type === "json" ? "json" : "text"
          }
          value={gatewayInput.notification_body}
          templateReference={templateReference}
          handleRef={bodyEditorRef}
          isInvalid={bodyErrors.length > 0}
          minHeightClassName="min-h-56"
          onChange={(notificationBody) =>
            updateInput({ notification_body: notificationBody })
          }
        />
        {bodyErrors.map((bodyError) => (
          <FormFieldError
            key={bodyError.message}
            errorMessage={bodyError.message}
          />
        ))}
      </div>
      <TemplateRowsEditor
        legend="Header templates"
        rowLabel="Header"
        namePlaceholder="x-signature"
        emptyText="No extra headers; the content type is set for you."
        rows={gatewayInput.notification_headers.map(
          (headerTemplate, rowIndex) => ({
            rowId: rowIndex,
            rowName: headerTemplate.name,
            rowValue: headerTemplate.template,
          }),
        )}
        templateReference={templateReference}
        onChange={(nextRows) =>
          updateInput({
            notification_headers: nextRows.map((headerRow) => ({
              name: headerRow.rowName,
              template: headerRow.rowValue,
            })),
          })
        }
      />
      <FormFieldError errorMessage={fieldErrors.notification_headers} />
    </div>
  );
}
