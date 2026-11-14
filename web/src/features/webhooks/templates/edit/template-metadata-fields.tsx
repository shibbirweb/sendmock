import * as React from "react";

import { ChipListInput } from "@/components/common/chip-list-input";
import { FormField } from "@/components/common/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  TemplateDraftFormValues,
  TemplateFormFieldErrors,
} from "@/features/webhooks/templates/edit/use-template-draft-form";
import { RuleEventsPicker } from "@/features/webhooks/rules/editor/rule-events-picker";

/** Name, description, events and required variables of a custom template (WH-09.9). */
export function TemplateMetadataFields({
  formValues,
  fieldErrors,
  onChange,
}: {
  formValues: TemplateDraftFormValues;
  fieldErrors: TemplateFormFieldErrors;
  onChange: (changedValues: Partial<TemplateDraftFormValues>) => void;
}) {
  const fieldIdPrefix = React.useId();

  return (
    <fieldset className="grid gap-4 rounded-md border p-3">
      <legend className="px-1 text-sm font-medium">Template details</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          label="Name"
          fieldId={`${fieldIdPrefix}-name`}
          errorMessage={fieldErrors.name}
        >
          <Input
            id={`${fieldIdPrefix}-name`}
            value={formValues.name}
            aria-invalid={fieldErrors.name !== undefined}
            onChange={(changeEvent) => {
              onChange({ name: changeEvent.target.value });
            }}
          />
        </FormField>
        <FormField label="Description" fieldId={`${fieldIdPrefix}-description`}>
          <Input
            id={`${fieldIdPrefix}-description`}
            value={formValues.description}
            onChange={(changeEvent) => {
              onChange({ description: changeEvent.target.value });
            }}
          />
        </FormField>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${fieldIdPrefix}-variables`}>
          Variables this template needs
        </Label>
        <p className="text-xs text-muted-foreground">
          Endpoints using it are asked for these; names with token, secret, key
          or password are stored as secrets.
        </p>
        <ChipListInput
          inputId={`${fieldIdPrefix}-variables`}
          values={formValues.requiredVariables}
          placeholder="tenant_id"
          onChange={(requiredVariables) => {
            onChange({ requiredVariables });
          }}
        />
      </div>
      <div className="grid gap-1.5">
        <span className="text-sm font-medium">Events it fits</span>
        <RuleEventsPicker
          pickerId={`${fieldIdPrefix}-events`}
          selectedEvents={formValues.events}
          onChange={(events) => {
            onChange({ events });
          }}
        />
      </div>
    </fieldset>
  );
}
