import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { NameValueRowsEditor } from "@/components/common/name-value-rows-editor";
import { Input } from "@/components/ui/input";
import type { useSendVariables } from "@/features/webhooks/send/use-send-variables";
import { useWebhookVariables } from "@/lib/api/hooks/use-webhook-queries";
import type { WebhookVariable } from "@/lib/api/types";

/** Prompt variables in scope; an endpoint's own one wins over a global one of the same name. */
function selectPromptVariables(
  webhookVariables: WebhookVariable[],
  endpointId: string | null,
): WebhookVariable[] {
  const promptVariables = webhookVariables.filter(
    (webhookVariable) =>
      webhookVariable.kind === "prompt" &&
      (webhookVariable.scope === "global" ||
        webhookVariable.endpoint_id === endpointId),
  );

  return promptVariables.filter(
    (promptVariable) =>
      promptVariable.scope === "endpoint" ||
      !promptVariables.some(
        (otherVariable) =>
          otherVariable.scope === "endpoint" &&
          otherVariable.name === promptVariable.name,
      ),
  );
}

/**
 * One input per Prompt variable, prefilled with its default, and override
 * rows that win for this send only (WH-05.5).
 */
export function SendVariablesFields({
  endpointId,
  sendVariables,
}: {
  endpointId: string | null;
  sendVariables: ReturnType<typeof useSendVariables>;
}) {
  const fieldIdPrefix = React.useId();
  const promptVariables = selectPromptVariables(
    useWebhookVariables().data ?? [],
    endpointId,
  );

  return (
    <div className="grid gap-4">
      {promptVariables.length > 0 && (
        <fieldset className="grid gap-3">
          <legend className="mb-1 text-sm font-medium">Prompt variables</legend>
          {promptVariables.map((promptVariable) => (
            <FormField
              key={promptVariable.id}
              label={`vars.${promptVariable.name}`}
              fieldId={`${fieldIdPrefix}-${promptVariable.name}`}
              hint={promptVariable.description || undefined}
            >
              <Input
                id={`${fieldIdPrefix}-${promptVariable.name}`}
                className="font-mono text-xs"
                value={
                  sendVariables.promptValues[promptVariable.name] ??
                  promptVariable.value
                }
                onChange={(changeEvent) => {
                  sendVariables.setPromptValue(
                    promptVariable.name,
                    changeEvent.target.value,
                  );
                }}
              />
            </FormField>
          ))}
        </fieldset>
      )}
      <NameValueRowsEditor
        legend="Override variables"
        rowLabel="Override"
        namePlaceholder="tenant_id"
        emptyText="None. A value here wins over the endpoint and global value of that name, for this send only."
        rows={sendVariables.overrideRows}
        onChange={sendVariables.setOverrideRows}
      />
    </div>
  );
}
