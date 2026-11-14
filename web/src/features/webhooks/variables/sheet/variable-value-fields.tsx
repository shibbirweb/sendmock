import { FormField } from "@/components/common/form-field";
import { RadioCardGroup } from "@/components/common/radio-card-group";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { TemplateTextField } from "@/features/webhooks/templates/reference/template-text-field";
import type { VariableFormValues } from "@/features/webhooks/variables/sheet/use-variable-form";
import type { TemplateReference } from "@/lib/api/types";
import type { WebhookVariableFieldErrors } from "@/lib/webhooks/validate-webhook-variable";

type ValueFieldProps = {
  fieldId: string;
  formValues: VariableFormValues;
  fieldErrors: WebhookVariableFieldErrors;
  templateReference: TemplateReference | undefined;
  isEditingSecret: boolean;
  onChange: (changedValues: Partial<VariableFormValues>) => void;
};

const valueLabelsByKind: Record<
  VariableFormValues["kind"],
  { label: string; hint?: string }
> = {
  text: { label: "Value" },
  number: { label: "Number" },
  boolean: { label: "Value" },
  json: { label: "JSON", hint: "An object or a list, checked as you type." },
  secret: {
    label: "Secret",
    hint: "Masked everywhere and never shown again after saving.",
  },
  dynamic: {
    label: "Path or expression",
    hint: "Read from the event; type to see what is available.",
  },
  random: {
    label: "Generator",
    hint: "A function such as random_string(16); type to see them all.",
  },
  computed: {
    label: "Template",
    hint: "Combine other values, e.g. {{ vars.tenant_id }}-{{ vars.nonce }}.",
  },
  prompt: {
    label: "Default value",
    hint: "Asked for on manual sends; automatic sends use this default.",
  },
};

function ValueControl({
  fieldId,
  formValues,
  fieldErrors,
  templateReference,
  isEditingSecret,
  onChange,
}: ValueFieldProps) {
  const isInvalid = fieldErrors.value !== undefined;
  const updateValue = (value: string) => {
    onChange({ value });
  };

  switch (formValues.kind) {
    case "boolean":
      return (
        <div className="flex items-center gap-2">
          <Switch
            id={fieldId}
            checked={formValues.value === "true"}
            onCheckedChange={(isChecked) => {
              updateValue(String(isChecked));
            }}
          />
          <span className="font-mono text-xs">{formValues.value}</span>
        </div>
      );
    case "secret":
      return (
        <Input
          id={fieldId}
          type="password"
          autoComplete="off"
          className="font-mono text-xs"
          placeholder={
            isEditingSecret
              ? "Leave empty to keep the current secret"
              : "sk_live_..."
          }
          value={formValues.value}
          aria-invalid={isInvalid}
          onChange={(changeEvent) => {
            updateValue(changeEvent.target.value);
          }}
        />
      );
    case "dynamic":
    case "random":
    case "computed":
    case "json":
      return (
        <TemplateTextField
          fieldId={fieldId}
          value={formValues.value}
          isMultiline={
            formValues.kind === "json" || formValues.kind === "computed"
          }
          rows={formValues.kind === "json" ? 6 : 3}
          isExpression={
            formValues.kind === "dynamic" || formValues.kind === "random"
          }
          templateReference={
            formValues.kind === "json" ? undefined : templateReference
          }
          isInvalid={isInvalid}
          onChange={updateValue}
        />
      );
    default:
      return (
        <Input
          id={fieldId}
          inputMode={formValues.kind === "number" ? "decimal" : undefined}
          className="font-mono text-xs"
          value={formValues.value}
          aria-invalid={isInvalid}
          onChange={(changeEvent) => {
            updateValue(changeEvent.target.value);
          }}
        />
      );
  }
}

/** The value fields for the chosen kind (WH-07.12), and Per send / Fixed for Random (WH-07.13). */
export function VariableValueFields(valueFieldProps: ValueFieldProps) {
  const { formValues, fieldErrors, fieldId, onChange } = valueFieldProps;
  const { label, hint } = valueLabelsByKind[formValues.kind];

  return (
    <div className="grid gap-4">
      <FormField
        label={label}
        fieldId={fieldId}
        hint={hint}
        errorMessage={fieldErrors.value}
      >
        <ValueControl {...valueFieldProps} />
      </FormField>
      {formValues.kind === "random" && (
        <RadioCardGroup<VariableFormValues["randomMode"]>
          legend="When to generate"
          selectedValue={formValues.randomMode}
          options={[
            {
              value: "per_send",
              label: "Per send",
              description: "A new value for every delivery; retries reuse it.",
            },
            {
              value: "fixed",
              label: "Fixed",
              description: "Generated once when saved; Regenerate changes it.",
            },
          ]}
          onSelect={(randomMode) => {
            onChange({ randomMode });
          }}
        />
      )}
    </div>
  );
}
