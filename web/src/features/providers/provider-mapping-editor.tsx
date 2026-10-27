import { PlusIcon, Trash2Icon } from "lucide-react";

import { FormFieldError } from "@/components/common/form-field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OptionSelect } from "@/features/providers/option-select";
import {
  errorKinds,
  messagePartsByArea,
  validationChecks,
} from "@/features/providers/provider-options";
import type { MessageProviderForm } from "@/features/providers/use-message-provider-form";
import type {
  ProviderFieldMapping,
  ProviderValidationRule,
} from "@/lib/api/types";

/** Where each message part is read from, and the checks on a send. */
export function ProviderMappingEditor({
  providerForm,
}: {
  providerForm: MessageProviderForm;
}) {
  const { providerArea, providerInput, fieldErrors, updateInput } =
    providerForm;
  const partOptions = messagePartsByArea[providerArea].map((part) => ({
    value: part,
    label: part,
  }));
  const { field_mapping: fieldMapping, validation_rules: validationRules } =
    providerInput;
  const changeMapping = (
    mappingIndex: number,
    changedFields: Partial<ProviderFieldMapping>,
  ) => {
    updateInput({
      field_mapping: fieldMapping.map((mappingRow, candidateIndex) =>
        candidateIndex === mappingIndex
          ? { ...mappingRow, ...changedFields }
          : mappingRow,
      ),
    });
  };
  const changeRule = (
    ruleIndex: number,
    changedFields: Partial<ProviderValidationRule>,
  ) => {
    updateInput({
      validation_rules: validationRules.map((validationRule, candidateIndex) =>
        candidateIndex === ruleIndex
          ? { ...validationRule, ...changedFields }
          : validationRule,
      ),
    });
  };

  return (
    <div className="grid gap-5">
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Field mapping</legend>
        <p className="text-xs text-muted-foreground">
          A JSON path (
          <code className="font-mono">personalizations[*].to[*].email</code>
          ), a form field (<code className="font-mono">To</code>) or{" "}
          <code className="font-mono">h:*</code> for every field with a prefix.
          Anything unmapped is kept as metadata.
        </p>
        {fieldMapping.map((mappingRow, mappingIndex) => (
          <div
            key={mappingIndex}
            className="grid grid-cols-[9rem_minmax(0,1fr)_auto] items-center gap-2"
          >
            <OptionSelect
              ariaLabel={`Mapping ${mappingIndex + 1} part`}
              value={mappingRow.part}
              options={partOptions}
              onChange={(part) => changeMapping(mappingIndex, { part })}
            />
            <Input
              aria-label={`Mapping ${mappingIndex + 1} source`}
              className="h-7 font-mono text-xs"
              value={mappingRow.source}
              onChange={(changeEvent) =>
                changeMapping(mappingIndex, {
                  source: changeEvent.target.value,
                })
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove mapping ${mappingIndex + 1}`}
              onClick={() =>
                updateInput({
                  field_mapping: fieldMapping.filter(
                    (_mappingRow, candidateIndex) =>
                      candidateIndex !== mappingIndex,
                  ),
                })
              }
            >
              <Trash2Icon />
            </Button>
          </div>
        ))}
        <FormFieldError errorMessage={fieldErrors.field_mapping} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="justify-self-start"
          onClick={() =>
            updateInput({
              field_mapping: [...fieldMapping, { part: "to", source: "" }],
            })
          }
        >
          <PlusIcon />
          Map a part
        </Button>
      </fieldset>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Checks on a send</legend>
        {validationRules.map((validationRule, ruleIndex) => (
          <div
            key={ruleIndex}
            className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[8rem_9rem_5rem_minmax(0,1fr)_auto]"
          >
            <OptionSelect
              ariaLabel={`Check ${ruleIndex + 1} part`}
              value={validationRule.part}
              options={partOptions}
              onChange={(part) => changeRule(ruleIndex, { part })}
            />
            <OptionSelect
              ariaLabel={`Check ${ruleIndex + 1} kind`}
              value={validationRule.check}
              options={validationChecks.map(({ check, label }) => ({
                value: check,
                label,
              }))}
              onChange={(check) => changeRule(ruleIndex, { check })}
            />
            <Input
              aria-label={`Check ${ruleIndex + 1} max length`}
              type="number"
              className="h-7 text-xs"
              disabled={validationRule.check !== "max_length"}
              value={validationRule.max_length ?? ""}
              onChange={(changeEvent) =>
                changeRule(ruleIndex, {
                  max_length:
                    changeEvent.target.value === ""
                      ? null
                      : Number(changeEvent.target.value),
                })
              }
            />
            <OptionSelect
              ariaLabel={`Check ${ruleIndex + 1} error`}
              value={validationRule.error_kind}
              options={errorKinds.map(({ kind, label }) => ({
                value: kind,
                label,
              }))}
              onChange={(errorKind) =>
                changeRule(ruleIndex, { error_kind: errorKind })
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove check ${ruleIndex + 1}`}
              onClick={() =>
                updateInput({
                  validation_rules: validationRules.filter(
                    (_validationRule, candidateIndex) =>
                      candidateIndex !== ruleIndex,
                  ),
                })
              }
            >
              <Trash2Icon />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="justify-self-start"
          onClick={() =>
            updateInput({
              validation_rules: [
                ...validationRules,
                {
                  part: "to",
                  check: "required",
                  max_length: null,
                  error_kind: "missing_field",
                },
              ],
            })
          }
        >
          <PlusIcon />
          Add check
        </Button>
      </fieldset>
    </div>
  );
}
