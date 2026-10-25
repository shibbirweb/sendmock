import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DockerHostHint } from "@/features/webhooks/endpoints/docker-host-hint";
import type { WebhookEndpointFormValues } from "@/features/webhooks/endpoints/sheet/use-webhook-endpoint-form";
import type { HttpMethod } from "@/lib/api/types";
import type { WebhookEndpointFieldErrors } from "@/lib/webhooks/validate-webhook-endpoint";

const endpointMethods: HttpMethod[] = ["POST", "PUT", "PATCH", "GET"];

/** Name, method, URL, timeout and the enabled switch. */
export function EndpointGeneralTab({
  formValues,
  fieldErrors,
  onChange,
}: {
  formValues: WebhookEndpointFormValues;
  fieldErrors: WebhookEndpointFieldErrors;
  onChange: (changedValues: Partial<WebhookEndpointFormValues>) => void;
}) {
  const fieldIdPrefix = React.useId();

  return (
    <div className="grid gap-4">
      <FormField
        label="Name"
        fieldId={`${fieldIdPrefix}-name`}
        errorMessage={fieldErrors.name}
      >
        <Input
          id={`${fieldIdPrefix}-name`}
          placeholder="Laravel inbound mail"
          value={formValues.name}
          aria-invalid={fieldErrors.name !== undefined}
          onChange={(changeEvent) => {
            onChange({ name: changeEvent.target.value });
          }}
        />
      </FormField>
      <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3">
        <FormField label="Method" fieldId={`${fieldIdPrefix}-method`}>
          <Select
            value={formValues.method}
            onValueChange={(selectedMethod) => {
              onChange({ method: selectedMethod as HttpMethod });
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
          errorMessage={fieldErrors.url}
        >
          <Input
            id={`${fieldIdPrefix}-url`}
            placeholder="http://localhost:8000/webhooks/sendmock"
            className="font-mono text-xs"
            value={formValues.url}
            aria-invalid={fieldErrors.url !== undefined}
            onChange={(changeEvent) => {
              onChange({ url: changeEvent.target.value });
            }}
          />
        </FormField>
      </div>
      <DockerHostHint
        endpointUrl={formValues.url}
        onUseDockerHost={(dockerHostUrl) => {
          onChange({ url: dockerHostUrl });
        }}
      />
      <FormField
        label="Timeout (seconds)"
        fieldId={`${fieldIdPrefix}-timeout`}
        hint="1 to 60 seconds. A slower answer counts as a timeout and is retried."
        errorMessage={fieldErrors.timeout_ms}
      >
        <Input
          id={`${fieldIdPrefix}-timeout`}
          inputMode="numeric"
          className="w-28"
          value={formValues.timeoutSeconds}
          aria-invalid={fieldErrors.timeout_ms !== undefined}
          onChange={(changeEvent) => {
            onChange({ timeoutSeconds: changeEvent.target.value });
          }}
        />
      </FormField>
      <div className="flex items-center justify-between gap-3 rounded-md border p-3">
        <div className="grid gap-0.5">
          <Label htmlFor={`${fieldIdPrefix}-enabled`}>Enabled</Label>
          <p className="text-xs text-muted-foreground">
            A disabled endpoint keeps its rules but receives nothing.
          </p>
        </div>
        <Switch
          id={`${fieldIdPrefix}-enabled`}
          checked={formValues.isEnabled}
          onCheckedChange={(isEnabled) => {
            onChange({ isEnabled });
          }}
        />
      </div>
    </div>
  );
}
