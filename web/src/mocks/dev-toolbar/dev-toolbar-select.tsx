import * as React from "react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DevToolbarSelectProps<OptionValue extends string> = {
  label: string;
  value: OptionValue;
  options: { value: OptionValue; label: string }[];
  onValueChange: (selectedValue: OptionValue) => void;
};

export function DevToolbarSelect<OptionValue extends string>({
  label,
  value,
  options,
  onValueChange,
}: DevToolbarSelectProps<OptionValue>) {
  const selectId = React.useId();

  return (
    <div className="grid gap-2">
      <Label htmlFor={selectId}>{label}</Label>
      <Select
        value={value}
        onValueChange={(selectedValue) => {
          onValueChange(selectedValue as OptionValue);
        }}
      >
        <SelectTrigger id={selectId} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
