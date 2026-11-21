import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { FormFieldError } from "@/components/common/form-field-error";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FollowUpFormValues } from "@/features/http/responses/follow-up-form-values";
import {
  useWebhookEndpoints,
  useWebhookTemplates,
} from "@/lib/api/hooks/use-webhook-queries";

/** A webhook the rule sends after it answers, as a vendor calls back (PL-21.4). */
export function ResponseRuleFollowUpFields({
  followUp,
  errorMessage,
  onChange,
}: {
  followUp: FollowUpFormValues;
  errorMessage: string | undefined;
  onChange: (changedFollowUp: Partial<FollowUpFormValues>) => void;
}) {
  const fieldIdPrefix = React.useId();
  const { data: webhookEndpoints = [] } = useWebhookEndpoints();
  const { data: webhookTemplates = [] } = useWebhookTemplates();

  return (
    <fieldset className="grid gap-4">
      <legend className="mb-1 text-sm font-semibold">Follow-up webhook</legend>
      <div className="flex items-center gap-2">
        <Checkbox
          id={`${fieldIdPrefix}-enabled`}
          checked={followUp.isEnabled}
          onCheckedChange={(checkedState) => {
            onChange({ isEnabled: checkedState === true });
          }}
        />
        <Label htmlFor={`${fieldIdPrefix}-enabled`} className="font-normal">
          Send a webhook after answering
        </Label>
      </div>
      {followUp.isEnabled && (
        <div className="grid gap-4">
          <FormField label="Send to" fieldId={`${fieldIdPrefix}-target`}>
            <Select
              value={followUp.targetKind}
              onValueChange={(targetKind) => {
                onChange({ targetKind: targetKind as "url" | "endpoint" });
              }}
            >
              <SelectTrigger id={`${fieldIdPrefix}-target`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="url">A URL from the request</SelectItem>
                <SelectItem value="endpoint">A webhook endpoint</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          {followUp.targetKind === "url" ? (
            <FormField
              label="URL"
              fieldId={`${fieldIdPrefix}-url`}
              hint="A template, e.g. {{ request.form.StatusCallback }}."
            >
              <Input
                id={`${fieldIdPrefix}-url`}
                className="font-mono text-xs"
                placeholder="{{ request.form.StatusCallback }}"
                value={followUp.url}
                onChange={(changeEvent) => {
                  onChange({ url: changeEvent.target.value });
                }}
              />
            </FormField>
          ) : (
            <FormField label="Endpoint" fieldId={`${fieldIdPrefix}-endpoint`}>
              <Select
                value={followUp.endpointId}
                onValueChange={(endpointId) => {
                  onChange({ endpointId });
                }}
              >
                <SelectTrigger
                  id={`${fieldIdPrefix}-endpoint`}
                  className="w-full"
                >
                  <SelectValue placeholder="Choose an endpoint" />
                </SelectTrigger>
                <SelectContent>
                  {webhookEndpoints.map((webhookEndpoint) => (
                    <SelectItem
                      key={webhookEndpoint.id}
                      value={webhookEndpoint.id}
                    >
                      {webhookEndpoint.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}
          <div className="grid grid-cols-[minmax(0,1fr)_8rem] items-start gap-3">
            <FormField
              label="Template"
              fieldId={`${fieldIdPrefix}-template`}
              hint="Vendor templates sign as the vendor does."
            >
              <Select
                value={followUp.templateId}
                onValueChange={(templateId) => {
                  onChange({ templateId });
                }}
              >
                <SelectTrigger
                  id={`${fieldIdPrefix}-template`}
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {webhookTemplates.map((webhookTemplate) => (
                    <SelectItem
                      key={webhookTemplate.id}
                      value={webhookTemplate.id}
                    >
                      {webhookTemplate.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="After (ms)" fieldId={`${fieldIdPrefix}-delay`}>
              <Input
                id={`${fieldIdPrefix}-delay`}
                inputMode="numeric"
                className="font-mono"
                value={followUp.delayMs}
                onChange={(changeEvent) => {
                  onChange({ delayMs: changeEvent.target.value });
                }}
              />
            </FormField>
          </div>
        </div>
      )}
      <FormFieldError errorMessage={errorMessage} />
    </fieldset>
  );
}
