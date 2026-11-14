import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  blankPreset,
  type useComposer,
} from "@/features/webhooks/composer/use-composer";
import { endpointMethods } from "@/features/webhooks/endpoints/sheet/endpoint-general-tab";
import { useWebhookTemplates } from "@/lib/api/hooks/use-webhook-queries";
import type { HttpMethod, WebhookEndpoint } from "@/lib/api/types";

/** Where the composed request goes and what it starts from (WH-05.3). */
export function ComposerTargetFields({
  webhookEndpoints,
  composer,
}: {
  webhookEndpoints: WebhookEndpoint[];
  composer: ReturnType<typeof useComposer>;
}) {
  const fieldIdPrefix = React.useId();
  const webhookTemplates = useWebhookTemplates().data ?? [];
  const { formValues, targetEndpoint } = composer;

  return (
    <div className="grid gap-4">
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <FormField
          label="Send to"
          fieldId={`${fieldIdPrefix}-endpoint`}
          hint="Its secret signs the request."
        >
          <Select
            value={targetEndpoint?.id ?? ""}
            onValueChange={composer.setTargetEndpointId}
          >
            <SelectTrigger id={`${fieldIdPrefix}-endpoint`} className="w-full">
              <SelectValue placeholder="Pick an endpoint" />
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
          label="Preset"
          fieldId={`${fieldIdPrefix}-preset`}
          hint="A template fills the method, headers and body, ready to edit."
        >
          <Select
            value={composer.presetId}
            onValueChange={composer.applyPreset}
          >
            <SelectTrigger id={`${fieldIdPrefix}-preset`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={blankPreset}>Blank</SelectItem>
              {webhookTemplates.map((webhookTemplate) => (
                <SelectItem key={webhookTemplate.id} value={webhookTemplate.id}>
                  {webhookTemplate.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>
      <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-start gap-3">
        <FormField label="Method" fieldId={`${fieldIdPrefix}-method`}>
          <Select
            value={formValues.method}
            onValueChange={(selectedMethod) => {
              composer.updateFormValues({
                method: selectedMethod as HttpMethod,
              });
            }}
          >
            <SelectTrigger id={`${fieldIdPrefix}-method`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {endpointMethods.map((endpointMethod) => (
                <SelectItem key={endpointMethod} value={endpointMethod}>
                  {endpointMethod}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField
          label="URL"
          fieldId={`${fieldIdPrefix}-url`}
          hint="Leave empty to use the endpoint's URL."
          errorMessage={composer.fieldErrors.url}
        >
          <Input
            id={`${fieldIdPrefix}-url`}
            className="font-mono text-xs"
            placeholder={targetEndpoint?.url ?? "http://localhost:8000/hooks"}
            value={formValues.url}
            aria-invalid={composer.fieldErrors.url !== undefined}
            onChange={(changeEvent) => {
              composer.updateFormValues({ url: changeEvent.target.value });
            }}
          />
        </FormField>
      </div>
    </div>
  );
}
