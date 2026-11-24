import * as React from "react";

import { EmailRecipientsInput } from "@/components/common/email-recipients-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type EmailComposerMode,
  listOriginalRecipients,
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

/** Suggested forward targets, one per inbound domain from Settings. */
function useForwardSuggestions(): string[] {
  const settingsQuery = useAppSettings();

  return (settingsQuery.data?.inbound_email_domains ?? []).map(
    (inboundDomain) => `support@${inboundDomain}`,
  );
}

/**
 * From, To, Cc and Subject rows of the reply / forward composer; a reply's To
 * and Cc are editable recipient fields (EM-17.7).
 */
export function EmailResponseFields({
  email,
  composerMode,
  formValues,
  onChange,
}: EmailResponseFieldsProps) {
  const fieldIdPrefix = React.useId();
  const forwardSuggestions = useForwardSuggestions();
  const isForward = composerMode === "forward";
  const [isCcShown, setIsCcShown] = React.useState(
    formValues.ccRecipients.length > 0,
  );

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
          <Label htmlFor={`${fieldIdPrefix}-to`}>To</Label>
          <div className="flex min-w-0 items-start gap-1">
            <EmailRecipientsInput
              inputId={`${fieldIdPrefix}-to`}
              recipients={formValues.toRecipients}
              placeholder="support@shop.test"
              onChange={(toRecipients) => {
                onChange({ toRecipients });
              }}
            />
            {!isCcShown && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsCcShown(true);
                }}
              >
                Cc
              </Button>
            )}
          </div>
        </>
      )}

      {!isForward && isCcShown && (
        <>
          <Label htmlFor={`${fieldIdPrefix}-cc`}>Cc</Label>
          <EmailRecipientsInput
            inputId={`${fieldIdPrefix}-cc`}
            recipients={formValues.ccRecipients}
            onChange={(ccRecipients) => {
              onChange({ ccRecipients });
            }}
          />
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
