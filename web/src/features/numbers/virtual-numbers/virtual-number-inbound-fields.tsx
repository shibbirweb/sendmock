import { InfoIcon } from "lucide-react";
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
import type { VirtualNumberFormValues } from "@/features/numbers/virtual-numbers/use-virtual-number-form";
import {
  useWebhookRules,
  useWebhookTemplates,
} from "@/lib/api/hooks/use-webhook-queries";
import { hasEnabledInboundSmsRule } from "@/features/numbers/virtual-numbers/has-enabled-inbound-sms-rule";
import type { InboundWebhookMethod } from "@/lib/api/types";
import type { VirtualNumberFieldErrors } from "@/lib/numbers/validate-virtual-number";

const inboundMethods: InboundWebhookMethod[] = ["POST", "GET"];

/** Templates that can render an inbound SMS (Twilio, Vonage, native, ...). */
function useInboundSmsTemplates() {
  const templatesQuery = useWebhookTemplates();

  return (templatesQuery.data ?? []).filter(
    (webhookTemplate) =>
      webhookTemplate.events.includes("sms.inbound") &&
      (webhookTemplate.category === "sms-provider" ||
        webhookTemplate.category === "generic"),
  );
}

function useHasInboundSmsRule(): boolean {
  const rulesQuery = useWebhookRules();

  return hasEnabledInboundSmsRule(rulesQuery.data ?? []);
}

/** Reply webhook settings of a number, like a provider console. */
export function VirtualNumberInboundFields({
  formValues,
  fieldErrors,
  onChange,
}: {
  formValues: VirtualNumberFormValues;
  fieldErrors: VirtualNumberFieldErrors;
  onChange: (changedValues: Partial<VirtualNumberFormValues>) => void;
}) {
  const fieldIdPrefix = React.useId();
  const inboundTemplates = useInboundSmsTemplates();
  const hasInboundSmsRule = useHasInboundSmsRule();
  const hasInboundUrl = formValues.inboundUrl.trim() !== "";

  return (
    <fieldset className="grid gap-3 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">
        When a message comes in
      </legend>
      <FormField
        label="Webhook URL"
        fieldId={`${fieldIdPrefix}-url`}
        hint="Leave empty to deliver inbound messages through webhook rules only."
        errorMessage={fieldErrors.inbound_url}
      >
        <Input
          id={`${fieldIdPrefix}-url`}
          placeholder="http://localhost:8000/sms/inbound"
          value={formValues.inboundUrl}
          aria-invalid={fieldErrors.inbound_url !== undefined}
          onChange={(changeEvent) => {
            onChange({ inboundUrl: changeEvent.target.value });
          }}
        />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-[7rem_1fr]">
        <FormField label="Method" fieldId={`${fieldIdPrefix}-method`}>
          <Select
            value={formValues.inboundMethod}
            onValueChange={(selectedMethod) => {
              onChange({
                inboundMethod: selectedMethod as InboundWebhookMethod,
              });
            }}
          >
            <SelectTrigger id={`${fieldIdPrefix}-method`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {inboundMethods.map((inboundMethod) => (
                <SelectItem key={inboundMethod} value={inboundMethod}>
                  {inboundMethod}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Format" fieldId={`${fieldIdPrefix}-format`}>
          <Select
            value={formValues.inboundTemplateId}
            onValueChange={(selectedTemplateId) => {
              onChange({ inboundTemplateId: selectedTemplateId });
            }}
          >
            <SelectTrigger id={`${fieldIdPrefix}-format`} className="w-full">
              <SelectValue placeholder="Choose a format" />
            </SelectTrigger>
            <SelectContent>
              {inboundTemplates.map((inboundTemplate) => (
                <SelectItem key={inboundTemplate.id} value={inboundTemplate.id}>
                  {inboundTemplate.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>
      <FormField
        label="Fallback URL"
        fieldId={`${fieldIdPrefix}-fallback`}
        hint="Called with ErrorCode and ErrorUrl when the webhook URL fails."
        errorMessage={fieldErrors.inbound_fallback_url}
      >
        <Input
          id={`${fieldIdPrefix}-fallback`}
          placeholder="Optional"
          value={formValues.inboundFallbackUrl}
          aria-invalid={fieldErrors.inbound_fallback_url !== undefined}
          onChange={(changeEvent) => {
            onChange({ inboundFallbackUrl: changeEvent.target.value });
          }}
        />
      </FormField>
      {hasInboundUrl && hasInboundSmsRule && (
        <p className="flex gap-1.5 rounded-md bg-muted p-2 text-xs text-muted-foreground">
          <InfoIcon className="mt-px size-3.5 shrink-0" />A webhook rule on
          sms.inbound is also enabled, so inbound messages go to both this URL
          and the rule&apos;s endpoint.
        </p>
      )}
    </fieldset>
  );
}
