import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { EndpointRequestPreview } from "@/features/webhooks/endpoints/sheet/request/endpoint-request-preview";
import { SendVariablesFields } from "@/features/webhooks/send/send-variables-fields";
import type { useSendToWebhook } from "@/features/webhooks/send/use-send-to-webhook";
import { CodeEditor } from "@/features/webhooks/templates/reference/code-editor/code-editor";
import { useWebhookTemplates } from "@/lib/api/hooks/use-webhook-queries";
import type { WebhookEndpoint } from "@/lib/api/types";

const endpointFormat = "endpoint";

/** Endpoint, format, variables and the preview with Edit body (WH-05.1). */
export function SendToWebhookForm({
  webhookEndpoints,
  sendToWebhook,
}: {
  webhookEndpoints: WebhookEndpoint[];
  sendToWebhook: ReturnType<typeof useSendToWebhook>;
}) {
  const fieldIdPrefix = React.useId();
  const webhookTemplates = useWebhookTemplates().data ?? [];
  const { chosenEndpoint, requestPreview, editedBody } = sendToWebhook;
  const renderedBody = requestPreview.previewQuery.data?.body ?? "";
  const contentType =
    requestPreview.previewQuery.data?.headers["content-type"] ?? "";

  return (
    <div className="grid min-h-0 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="grid content-start gap-4">
        <FormField label="Endpoint" fieldId={`${fieldIdPrefix}-endpoint`}>
          <Select
            value={chosenEndpoint.id}
            onValueChange={sendToWebhook.chooseEndpoint}
          >
            <SelectTrigger id={`${fieldIdPrefix}-endpoint`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {webhookEndpoints.map((webhookEndpoint) => (
                <SelectItem key={webhookEndpoint.id} value={webhookEndpoint.id}>
                  {webhookEndpoint.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField
          label="Format"
          fieldId={`${fieldIdPrefix}-format`}
          hint="A template here is used for this send only."
        >
          <Select
            value={sendToWebhook.templateId ?? endpointFormat}
            onValueChange={(selectedFormat) => {
              sendToWebhook.setTemplateId(
                selectedFormat === endpointFormat ? null : selectedFormat,
              );
            }}
          >
            <SelectTrigger id={`${fieldIdPrefix}-format`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={endpointFormat}>
                As the endpoint sends it
              </SelectItem>
              {webhookTemplates.map((webhookTemplate) => (
                <SelectItem key={webhookTemplate.id} value={webhookTemplate.id}>
                  {webhookTemplate.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <SendVariablesFields
          endpointId={chosenEndpoint.id}
          sendVariables={sendToWebhook.sendVariables}
        />
      </div>
      <div className="grid content-start gap-3">
        <div className="flex items-center gap-2">
          <Switch
            id={`${fieldIdPrefix}-edit-body`}
            checked={editedBody !== null}
            onCheckedChange={(isChecked) => {
              sendToWebhook.setEditedBody(isChecked ? renderedBody : null);
            }}
          />
          <Label htmlFor={`${fieldIdPrefix}-edit-body`}>Edit body</Label>
          {editedBody !== null && (
            <span className="text-xs text-muted-foreground">
              Sent as written.
            </span>
          )}
        </div>
        <EndpointRequestPreview
          requestPreview={requestPreview}
          bodyEditor={
            editedBody === null ? undefined : (
              <CodeEditor
                ariaLabel="Edited body"
                language={contentType.includes("json") ? "json" : "text"}
                minHeightClassName="min-h-48"
                value={editedBody}
                templateReference={undefined}
                onChange={sendToWebhook.setEditedBody}
              />
            )
          }
        />
      </div>
    </div>
  );
}
