import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/** A labelled on / off setting with a short explanation. */
export function SettingsSwitchRow({
  label,
  description,
  isChecked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  isChecked: boolean;
  onCheckedChange: (isChecked: boolean) => void;
}) {
  const switchId = React.useId();

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="grid gap-0.5">
        <Label htmlFor={switchId}>{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch
        id={switchId}
        checked={isChecked}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

/** A whole-number setting; an empty box is reported as null. */
export function SettingsNumberField({
  label,
  hint,
  errorMessage,
  value,
  unitLabel,
  placeholder,
  onValueChange,
}: {
  label: string;
  hint?: string;
  errorMessage?: string;
  value: number | null;
  unitLabel?: string;
  placeholder?: string;
  onValueChange: (nextValue: number | null) => void;
}) {
  const fieldId = React.useId();

  return (
    <FormField
      label={label}
      fieldId={fieldId}
      hint={hint}
      errorMessage={errorMessage}
    >
      <div className="flex items-center gap-2">
        <Input
          id={fieldId}
          type="number"
          inputMode="numeric"
          className="w-36"
          value={value ?? ""}
          placeholder={placeholder}
          aria-invalid={errorMessage !== undefined}
          onChange={(changeEvent) => {
            const enteredText = changeEvent.target.value;
            onValueChange(enteredText === "" ? null : Number(enteredText));
          }}
        />
        {unitLabel !== undefined && (
          <span className="text-sm text-muted-foreground">{unitLabel}</span>
        )}
      </div>
    </FormField>
  );
}
