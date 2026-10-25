import * as React from "react";

import { cn } from "@/lib/utils";

export type RadioCardOption<OptionValue extends string> = {
  value: OptionValue;
  label: string;
  description: string;
  isDisabled?: boolean;
};

/** Radio buttons as bordered cards with a description under each label. */
export function RadioCardGroup<OptionValue extends string>({
  legend,
  options,
  selectedValue,
  onSelect,
  className,
}: {
  legend: string;
  options: RadioCardOption<OptionValue>[];
  selectedValue: OptionValue;
  onSelect: (selectedValue: OptionValue) => void;
  className?: string;
}) {
  const groupName = React.useId();

  return (
    <fieldset className={cn("grid gap-2", className)}>
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      {options.map((option) => {
        const optionId = `${groupName}-${option.value}`;

        return (
          <label
            key={option.value}
            htmlFor={optionId}
            className="flex cursor-pointer items-start gap-2 rounded-md border p-2.5 text-sm has-checked:border-primary has-disabled:cursor-not-allowed has-disabled:opacity-60"
          >
            <input
              id={optionId}
              type="radio"
              name={groupName}
              className="mt-0.5 accent-primary"
              checked={selectedValue === option.value}
              disabled={option.isDisabled}
              onChange={() => {
                onSelect(option.value);
              }}
            />
            <span className="grid gap-0.5">
              <span className="font-medium">{option.label}</span>
              <span className="text-xs text-muted-foreground">
                {option.description}
              </span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
