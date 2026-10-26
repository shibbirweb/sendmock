import { PlusIcon, Trash2Icon } from "lucide-react";

import { FormFieldError } from "@/components/common/form-field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OptionSelect } from "@/features/providers/option-select";
import {
  httpMethods,
  operationKindsByArea,
  requestFormats,
} from "@/features/providers/provider-options";
import type { MessageProviderForm } from "@/features/providers/use-message-provider-form";
import type { ProviderOperation } from "@/lib/api/types";

/** The requests the provider answers: kind, method, path and format. */
export function ProviderOperationsEditor({
  providerForm,
}: {
  providerForm: MessageProviderForm;
}) {
  const { providerArea, providerInput, fieldErrors, updateInput } =
    providerForm;
  const operations = providerInput.operations;
  const changeOperation = (
    operationIndex: number,
    changedFields: Partial<ProviderOperation>,
  ) => {
    updateInput({
      operations: operations.map((operation, candidateIndex) =>
        candidateIndex === operationIndex
          ? { ...operation, ...changedFields }
          : operation,
      ),
    });
  };

  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">Requests it answers</legend>
      <p className="text-xs text-muted-foreground">
        The paths as the provider's API has them; use{" "}
        <code className="font-mono">{"{name}"}</code> for a part that changes,
        like <code className="font-mono">{"/v3/{domain}/messages"}</code>.
      </p>
      {operations.map((operation, operationIndex) => (
        <div
          key={operationIndex}
          className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[9rem_6rem_minmax(0,1fr)_7rem_auto]"
        >
          <OptionSelect
            ariaLabel={`Request ${operationIndex + 1} kind`}
            value={operation.kind}
            options={operationKindsByArea[providerArea].map(
              ({ kind, label }) => ({ value: kind, label }),
            )}
            onChange={(kind) => changeOperation(operationIndex, { kind })}
          />
          <OptionSelect
            ariaLabel={`Request ${operationIndex + 1} method`}
            value={operation.method}
            options={httpMethods.map((method) => ({
              value: method,
              label: method,
            }))}
            onChange={(method) => changeOperation(operationIndex, { method })}
          />
          <Input
            aria-label={`Request ${operationIndex + 1} path`}
            className="col-span-2 h-7 font-mono text-xs sm:col-span-1"
            value={operation.path}
            onChange={(changeEvent) =>
              changeOperation(operationIndex, {
                path: changeEvent.target.value,
              })
            }
          />
          <OptionSelect
            ariaLabel={`Request ${operationIndex + 1} format`}
            value={operation.request_format}
            options={requestFormats.map(({ format, label }) => ({
              value: format,
              label,
            }))}
            onChange={(requestFormat) =>
              changeOperation(operationIndex, {
                request_format: requestFormat,
              })
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove request ${operationIndex + 1}`}
            onClick={() =>
              updateInput({
                operations: operations.filter(
                  (_operation, candidateIndex) =>
                    candidateIndex !== operationIndex,
                ),
              })
            }
          >
            <Trash2Icon />
          </Button>
        </div>
      ))}
      <FormFieldError errorMessage={fieldErrors.operations} />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="justify-self-start"
        onClick={() =>
          updateInput({
            operations: [
              ...operations,
              {
                kind: "send",
                method: "POST",
                path: "/",
                request_format: "json",
              },
            ],
          })
        }
      >
        <PlusIcon />
        Add request
      </Button>
    </fieldset>
  );
}
