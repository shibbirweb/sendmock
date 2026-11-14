import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type EmailComposerMode,
  listOriginalRecipients,
  readReplyRecipient,
} from "@/features/mail/detail/response/email-composer-mode";
import type { EmailResponseFormValues } from "@/features/mail/detail/response/use-email-response-form";
import { useAppSettings } from "@/lib/api/hooks/use-system-queries";
import type { EmailDetail } from "@/lib/api/types";
import { formatEmailAddress } from "@/lib/email/build-response-text";

type EmailResponseFieldsProps = {
  email: EmailDetail;
  composerMode: EmailComposerMode;
  formValues: EmailResponseFormValues;
  onChange: (changedValues: Partial<EmailResponseFormValues>) => void;
};

function ReadOnlyAddresses({ addressText }: { addressText: string }) {
  return <span className="min-w-0 py-1.5 break-words">{addressText}</span>;
}

/** Suggested forward targets, one per inbound domain from Settings. */
function useForwardSuggestions(): string[] {
  const settingsQuery = useAppSettings();

  return (settingsQuery.data?.inbound_email_domains ?? []).map(
    (inboundDomain) => `support@${inboundDomain}`,
  );
}

/** From, To, Cc and Subject rows of the reply / forward composer. */
export function EmailResponseFields({
  email,
  composerMode,
  formValues,
  onChange,
}: EmailResponseFieldsProps) {
  const fieldIdPrefix = React.useId();
  const forwardSuggestions = useForwardSuggestions();
  const isForward = composerMode === "forward";
  const fromAddress = formValues.fromAddress.trim();
  const ccAddresses = listOriginalRecipients(email)
    .filter((recipient) => !fromAddress.includes(recipient.address))
    .map(formatEmailAddress);

  return (
    <div className="grid grid-cols-[4rem_1fr] items-center gap-x-3 gap-y-2 text-sm">
      <Label htmlFor={`${fieldIdPrefix}-from`}>From</Label>
      <Input
        id={`${fieldIdPrefix}-from`}
        list={`${fieldIdPrefix}-from-suggestions`}
        value={formValues.fromAddress}
        onChange={(changeEvent) => {
          onChange({ fromAddress: changeEvent.target.value });
        }}
      />
      <datalist id={`${fieldIdPrefix}-from-suggestions`}>
        {listOriginalRecipients(email).map((recipient) => (
          <option
            key={recipient.address}
            value={formatEmailAddress(recipient)}
          />
        ))}
      </datalist>

      {isForward ? (
        <>
          <Label htmlFor={`${fieldIdPrefix}-to`}>To</Label>
          <Input
            id={`${fieldIdPrefix}-to`}
            list={`${fieldIdPrefix}-to-suggestions`}
            placeholder={forwardSuggestions[0] ?? "support@inbound.app.test"}
            value={formValues.forwardToAddress}
            required
            autoFocus
            onChange={(changeEvent) => {
              onChange({ forwardToAddress: changeEvent.target.value });
            }}
          />
          <datalist id={`${fieldIdPrefix}-to-suggestions`}>
            {forwardSuggestions.map((forwardSuggestion) => (
              <option key={forwardSuggestion} value={forwardSuggestion} />
            ))}
          </datalist>
        </>
      ) : (
        <>
          <span className="text-muted-foreground">To</span>
          <ReadOnlyAddresses
            addressText={formatEmailAddress(readReplyRecipient(email))}
          />
        </>
      )}

      {composerMode === "reply_all" && ccAddresses.length > 0 && (
        <>
          <span className="text-muted-foreground">Cc</span>
          <ReadOnlyAddresses addressText={ccAddresses.join(", ")} />
        </>
      )}

      <Label htmlFor={`${fieldIdPrefix}-subject`}>Subject</Label>
      <Input
        id={`${fieldIdPrefix}-subject`}
        value={formValues.subject}
        onChange={(changeEvent) => {
          onChange({ subject: changeEvent.target.value });
        }}
      />
    </div>
  );
}
