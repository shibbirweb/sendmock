import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMessageProviders } from "@/lib/api/hooks/use-message-provider-queries";
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
const pickerOptionsByKind: Partial<Record<RuleValueKind, string[]>> = {
  boolean: ["true", "false"],
  "sms-status": smsStatusOptions,
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
  // The SMS API picker lists the native API and every SMS provider (docs/plan/22).
  const smsProviders = useMessageProviders("sms").data ?? [];
  const smsApiOptions: SmsApi[] = [
    "native",
    ...smsProviders
      .filter((smsProvider) => !smsProvider.is_removed)
      .map((smsProvider) => smsProvider.key),
  ];
  const pickerOptions =
    valueKind === "sms-api" ? smsApiOptions : pickerOptionsByKind[valueKind];
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
