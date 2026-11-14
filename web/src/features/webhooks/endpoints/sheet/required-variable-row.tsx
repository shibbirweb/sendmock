import * as React from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSaveWebhookVariable } from "@/lib/api/hooks/use-webhook-endpoint-queries";
import type { RequiredVariableState } from "@/lib/webhooks/find-required-variables";
import { isSecretVariableName } from "@/lib/webhooks/validate-webhook-variable";

/** One variable the template needs: where it is set, or an input to set it (WH-01.6). */
export function RequiredVariableRow({
  endpointId,
  requiredVariable,
}: {
  endpointId: string;
  requiredVariable: RequiredVariableState;
}) {
  const saveWebhookVariable = useSaveWebhookVariable();
  const [variableValue, setVariableValue] = React.useState("");
  const isSecret = isSecretVariableName(requiredVariable.variableName);

  const saveRequiredVariable = () => {
    if (variableValue.trim() === "") {
      return;
    }

    saveWebhookVariable.mutate(
      {
        variableId: null,
        variableInput: {
          name: requiredVariable.variableName,
          kind: isSecret ? "secret" : "text",
          scope: "endpoint",
          endpoint_id: endpointId,
          value: variableValue,
          random_mode: null,
          description: "Needed by the template.",
        },
      },
      {
        onError: () => {
          toast.error("Could not save the variable");
        },
      },
    );
  };

  return (
    <li
      data-testid="required-variable"
      className="grid gap-2 rounded-md border p-2.5 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
    >
      <span className="flex min-w-0 items-center gap-2">
        <code className="truncate font-mono text-xs">
          {requiredVariable.variableName}
        </code>
        {requiredVariable.source === "missing" && (
          <Badge variant="destructive">Missing</Badge>
        )}
        {requiredVariable.source === "global" && (
          <Badge variant="secondary">Set globally</Badge>
        )}
        {requiredVariable.source === "endpoint" && (
          <Badge variant="outline">Set</Badge>
        )}
      </span>
      {requiredVariable.source === "missing" && (
        <div className="flex gap-2">
          <Input
            aria-label={`Value for ${requiredVariable.variableName}`}
            type={isSecret ? "password" : "text"}
            placeholder={isSecret ? "Secret value" : "Value"}
            className="h-8 w-44 font-mono text-xs"
            value={variableValue}
            onChange={(changeEvent) => {
              setVariableValue(changeEvent.target.value);
            }}
            onKeyDown={(keyboardEvent) => {
              // The sheet is one form, so Enter here must not save the endpoint.
              if (keyboardEvent.key === "Enter") {
                keyboardEvent.preventDefault();
                saveRequiredVariable();
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            disabled={saveWebhookVariable.isPending}
            onClick={saveRequiredVariable}
          >
            Set
          </Button>
        </div>
      )}
    </li>
  );
}
