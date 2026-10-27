import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** A compact labelled picker for one row field of the provider editors. */
export function OptionSelect<OptionValue extends string>({
  ariaLabel,
  value,
  options,
  onChange,
  className,
}: {
  ariaLabel: string;
  value: OptionValue;
  options: { value: OptionValue; label: string }[];
  onChange: (nextValue: OptionValue) => void;
  className?: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(nextValue) => onChange(nextValue as OptionValue)}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        size="sm"
        className={cn("w-full font-mono text-xs", className)}
      >
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
  );
}
