import { FormField } from "@/components/common/form-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mainTwilioAccount } from "@/features/numbers/virtual-numbers/use-virtual-number-form";
import { useTwilioSubaccounts } from "@/lib/api/hooks/use-twilio-account-queries";

/** The Twilio account that owns the number: the main account or a subaccount (SM-22.5). */
export function VirtualNumberAccountField({
  fieldId,
  accountSid,
  onAccountChange,
}: {
  fieldId: string;
  accountSid: string;
  onAccountChange: (accountSid: string) => void;
}) {
  const subaccountsQuery = useTwilioSubaccounts();

  return (
    <FormField
      label="Twilio account"
      fieldId={fieldId}
      hint="Inbound messages to the number carry this account's SID and are signed with its token."
    >
      <Select value={accountSid} onValueChange={onAccountChange}>
        <SelectTrigger id={fieldId} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={mainTwilioAccount}>Main account</SelectItem>
          {(subaccountsQuery.data ?? []).map((subaccount) => (
            <SelectItem
              key={subaccount.account_sid}
              value={subaccount.account_sid}
            >
              {subaccount.friendly_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}
