import * as React from "react";
import { toast } from "sonner";

import { FormFieldError } from "@/components/common/form-field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api/api-client";
import { useSaveWebhookVariable } from "@/lib/api/hooks/use-webhook-endpoint-queries";
import type { WebhookVariable, WebhookVariableInput } from "@/lib/api/types";
import {
  type WebhookVariableFieldErrors,
  validateWebhookVariableInput,
} from "@/lib/webhooks/validate-webhook-variable";

type EditableVariableKind = "text" | "secret";

/** Inline add or edit form for a text or secret endpoint variable. */
export function EndpointVariableForm({
  endpointId,
  editedVariable,
  existingVariables,
  onDone,
}: {
  endpointId: string;
  editedVariable: WebhookVariable | null;
  /** Every variable except the one being edited, for the unique-name check. */
  existingVariables: WebhookVariable[];
  onDone: () => void;
}) {
  const fieldIdPrefix = React.useId();
  const saveWebhookVariable = useSaveWebhookVariable();
  const [variableName, setVariableName] = React.useState(
    editedVariable?.name ?? "",
  );
  const [variableKind, setVariableKind] = React.useState<EditableVariableKind>(
    editedVariable?.kind === "secret" ? "secret" : "text",
  );
  // A secret is never sent back, so editing one means typing a new value.
  const [variableValue, setVariableValue] = React.useState(
    editedVariable?.kind === "secret" ? "" : (editedVariable?.value ?? ""),
  );
  const [fieldErrors, setFieldErrors] =
    React.useState<WebhookVariableFieldErrors>({});

  const saveVariable = () => {
    const variableInput: WebhookVariableInput = {
      name: variableName.trim(),
      kind: variableKind,
      scope: "endpoint",
      endpoint_id: endpointId,
      value: variableValue,
      random_mode: null,
      description: editedVariable?.description ?? "",
    };
    const validationErrors = validateWebhookVariableInput(
      variableInput,
      existingVariables,
    );
    setFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    saveWebhookVariable.mutate(
      { variableId: editedVariable?.id ?? null, variableInput },
      {
        onSuccess: onDone,
        onError: (requestError) => {
          toast.error(
            requestError instanceof ApiError
              ? requestError.message
              : "Could not save the variable",
          );
        },
      },
    );
  };

  return (
    <div
      role="group"
      aria-label={
        editedVariable === null ? "New variable" : `Edit ${editedVariable.name}`
      }
      className="grid gap-2 rounded-md border p-3"
      onKeyDown={(keyboardEvent) => {
        // The sheet is one form, so Enter here saves the variable, not the endpoint.
        if (
          keyboardEvent.key === "Enter" &&
          keyboardEvent.target instanceof HTMLInputElement
        ) {
          keyboardEvent.preventDefault();
          saveVariable();
        }
      }}
    >
      <div className="grid gap-2 sm:grid-cols-[1fr_7rem]">
        <div className="grid gap-1">
          <Input
            aria-label="Variable name"
            placeholder="tenant_id"
            className="font-mono text-xs"
            value={variableName}
            aria-invalid={fieldErrors.name !== undefined}
            onChange={(changeEvent) => {
              setVariableName(changeEvent.target.value);
            }}
          />
          <FormFieldError errorMessage={fieldErrors.name} />
        </div>
        <Select
          value={variableKind}
          onValueChange={(selectedKind) => {
            setVariableKind(selectedKind as EditableVariableKind);
          }}
        >
          <SelectTrigger aria-label="Variable kind" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="secret">Secret</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1">
        <Input
          id={`${fieldIdPrefix}-value`}
          aria-label="Variable value"
          type={variableKind === "secret" ? "password" : "text"}
          placeholder={variableKind === "secret" ? "New secret value" : "Value"}
          className="font-mono text-xs"
          value={variableValue}
          aria-invalid={fieldErrors.value !== undefined}
          onChange={(changeEvent) => {
            setVariableValue(changeEvent.target.value);
          }}
        />
        <FormFieldError errorMessage={fieldErrors.value} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={saveWebhookVariable.isPending}
          onClick={saveVariable}
        >
          Save variable
        </Button>
      </div>
    </div>
  );
}
