import { XIcon } from "lucide-react";

import { IconButton } from "@/components/common/icon-button";
import { useRecipientDraft } from "@/hooks/use-recipient-draft";
import {
  isEmailAddressText,
  parseEmailAddress,
} from "@/lib/email/email-address-text";
import { cn } from "cn";

type EmailRecipientsInputProps = {
  inputId: string;
  recipients: string[];
  onChange: (nextRecipients: string[]) => void;
  placeholder?: string;
};

function RecipientChip({
  recipientText,
  onRemove,
  onEdit,
}: {
  recipientText: string;
  onRemove: () => void;
  onEdit: () => void;
}) {
  const recipientAddress = parseEmailAddress(recipientText);
  const isValid = isEmailAddressText(recipientText);
  const chipLabel = recipientAddress.name || recipientAddress.address;

  return (
    <li
      title={
        isValid ? recipientText : `${recipientText} is not an email address`
      }
      aria-invalid={!isValid}
      className={cn(
        "flex max-w-full items-center gap-1 rounded-full border bg-muted/40 py-0.5 pr-0.5 pl-2.5 text-xs",
        !isValid && "border-destructive text-destructive",
      )}
      onDoubleClick={onEdit}
    >
      <span className="truncate">{chipLabel}</span>
      <IconButton
        type="button"
        variant="ghost"
        className="size-5 shrink-0 rounded-full"
        label={`Remove ${recipientText}`}
        onClick={onRemove}
      >
        <XIcon className="size-3" />
      </IconButton>
    </li>
  );
}

/**
 * Recipients as chips inside one field, as a mail client's To: type or paste
 * addresses, remove a chip with its button, double-click a chip to change it.
 */
export function EmailRecipientsInput({
  inputId,
  recipients,
  onChange,
  placeholder,
}: EmailRecipientsInputProps) {
  const recipientDraft = useRecipientDraft({ recipients, onChange });
  const hasInvalidRecipient = !recipients.every(isEmailAddressText);

  return (
    <div
      className={cn(
        "flex min-h-8 w-full min-w-0 flex-wrap items-center gap-1 rounded-lg border border-input bg-transparent px-1.5 py-1 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
        hasInvalidRecipient && "border-destructive",
      )}
    >
      {recipients.length > 0 && (
        <ul className="contents">
          {recipients.map((recipientText, recipientIndex) => (
            <RecipientChip
              key={`${recipientIndex}-${recipientText}`}
              recipientText={recipientText}
              onRemove={() => {
                recipientDraft.removeRecipient(recipientIndex);
              }}
              onEdit={() => {
                recipientDraft.editRecipient(recipientIndex);
              }}
            />
          ))}
        </ul>
      )}
      <input
        id={inputId}
        value={recipientDraft.draftText}
        placeholder={recipients.length === 0 ? placeholder : undefined}
        autoComplete="off"
        className="h-6 min-w-32 flex-1 bg-transparent px-1 text-base outline-none placeholder:text-muted-foreground md:text-sm"
        onChange={(changeEvent) => {
          recipientDraft.setDraftText(changeEvent.target.value);
        }}
        onKeyDown={recipientDraft.handleKeyDown}
        onPaste={recipientDraft.handlePaste}
        onBlur={recipientDraft.commitDraft}
      />
    </div>
  );
}
