import { FormField } from "@/components/common/form-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTwilioSubaccounts } from "@/lib/api/hooks/use-twilio-account-queries";

/** Select value for the main Twilio account, which records store as no account. */
export const mainTwilioAccount = "main";

/** The stored owner from the select value: null for the main account. */
export function toStoredAccountSid(accountSid: string): string | null {
  return accountSid === mainTwilioAccount ? null : accountSid;
}

/**
 * The Twilio account that owns a number or a Messaging Service: the main
 * account or a subaccount (SM-22.5, SM-22.10).
 */
export function TwilioAccountField({
  fieldId,
  accountSid,
  hint,
  onAccountChange,
}: {
  fieldId: string;
  accountSid: string;
  hint: string;
  onAccountChange: (accountSid: string) => void;
}) {
  const subaccountsQuery = useTwilioSubaccounts();

  return (
    <FormField label="Twilio account" fieldId={fieldId} hint={hint}>
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
