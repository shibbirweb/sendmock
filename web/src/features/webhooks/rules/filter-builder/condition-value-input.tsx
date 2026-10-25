import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SmsApi, SmsStatus } from "@/lib/api/types";
import type { RuleValueKind } from "@/lib/webhooks/rule-filter/rule-fields";

const smsStatusOptions: SmsStatus[] = [
  "queued",
  "sent",
  "delivered",
  "undelivered",
  "failed",
  "received",
];
const smsApiOptions: SmsApi[] = [
  "native",
  "twilio",
  "vonage",
  "plivo",
  "messagebird",
  "generic",
];

const pickerOptionsByKind: Partial<Record<RuleValueKind, string[]>> = {
  boolean: ["true", "false"],
  "sms-status": smsStatusOptions,
  "sms-api": smsApiOptions,
};

/** The value control that fits the field: text, a number or a fixed list. */
export function ConditionValueInput({
  valueKind,
  value,
  ariaLabel,
  isInvalid,
  onChange,
}: {
  valueKind: RuleValueKind;
  value: string;
  ariaLabel: string;
  isInvalid: boolean;
  onChange: (nextValue: string) => void;
}) {
  const pickerOptions = pickerOptionsByKind[valueKind];
  if (pickerOptions !== undefined) {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          aria-label={ariaLabel}
          aria-invalid={isInvalid}
          className="w-full"
        >
          <SelectValue placeholder="Pick a value" />
        </SelectTrigger>
        <SelectContent>
          {pickerOptions.map((pickerOption) => (
            <SelectItem key={pickerOption} value={pickerOption}>
              {pickerOption}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Input
      aria-label={ariaLabel}
      aria-invalid={isInvalid}
      inputMode={valueKind === "number" ? "numeric" : undefined}
      placeholder={valueKind === "number" ? "1" : "value"}
      className="font-mono text-xs"
      value={value}
      onChange={(changeEvent) => {
        onChange(changeEvent.target.value);
      }}
    />
  );
}
