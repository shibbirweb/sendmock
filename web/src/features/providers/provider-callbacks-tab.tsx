import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { Input } from "@/components/ui/input";
import { OptionSelect } from "@/features/providers/option-select";
import {
  smsOutcomes,
  statusesByArea,
} from "@/features/providers/provider-options";
import type { MessageProviderForm } from "@/features/providers/use-message-provider-form";
import { useWebhookTemplates } from "@/lib/api/hooks/use-webhook-queries";

const noTemplate = "none";

/** One input per key of a name map; an empty value is left out. */
function NameMapInputs({
  legend,
  hint,
  keys,
  names,
  onChange,
}: {
  legend: string;
  hint: string;
  keys: string[];
  names: Record<string, string>;
  onChange: (nextNames: Record<string, string>) => void;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {keys.map((nameKey) => (
          <label key={nameKey} className="grid gap-1 text-xs">
            <span className="font-mono text-muted-foreground">{nameKey}</span>
            <Input
              className="h-7 font-mono text-xs"
              value={names[nameKey] ?? ""}
              onChange={(changeEvent) => {
                const otherNames = Object.fromEntries(
                  Object.entries(names).filter(
                    ([candidateKey]) => candidateKey !== nameKey,
                  ),
                );
                const nextValue = changeEvent.target.value;
                onChange(
                  nextValue === ""
                    ? otherNames
                    : { ...otherNames, [nameKey]: nextValue },
                );
              }}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** The callback template, the status names and, for SMS, the error codes. */
export function ProviderCallbacksTab({
  providerForm,
}: {
  providerForm: MessageProviderForm;
}) {
  const fieldIdPrefix = React.useId();
  const { providerArea, providerInput, updateInput } = providerForm;
  const webhookTemplates = (useWebhookTemplates().data ?? []).filter(
    (webhookTemplate) =>
      webhookTemplate.category ===
        (providerArea === "email" ? "email-provider" : "sms-provider") ||
      webhookTemplate.category === "custom",
  );

  return (
    <div className="grid content-start gap-5">
      <FormField
        label="Callback template"
        fieldId={`${fieldIdPrefix}-template`}
        hint="The webhook template its status callbacks and inbound messages are sent with; edit it in Webhooks > Templates."
      >
        <OptionSelect
          ariaLabel="Callback template"
          value={providerInput.callback_template_key ?? noTemplate}
          options={[
            { value: noTemplate, label: "None: send no callbacks" },
            ...webhookTemplates.map((webhookTemplate) => ({
              value: webhookTemplate.id,
              label: webhookTemplate.name,
            })),
          ]}
          onChange={(templateKey) =>
            updateInput({
              callback_template_key:
                templateKey === noTemplate ? null : templateKey,
            })
          }
        />
      </FormField>
      <NameMapInputs
        legend="Status names"
        hint="The provider's name for each SendMock status, as its callbacks and fetch answers show it."
        keys={statusesByArea[providerArea]}
        names={providerInput.status_names}
        onChange={(statusNames) => updateInput({ status_names: statusNames })}
      />
      {providerArea === "sms" && (
        <NameMapInputs
          legend="Error codes"
          hint="The provider's error code for each outcome, so the magic test numbers fail with its own codes. Leave one empty to use none."
          keys={smsOutcomes}
          names={providerInput.outcome_error_codes}
          onChange={(outcomeErrorCodes) =>
            updateInput({ outcome_error_codes: outcomeErrorCodes })
          }
        />
      )}
    </div>
  );
}
