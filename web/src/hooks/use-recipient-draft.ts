import * as React from "react";

import {
  parseEmailAddress,
  splitAddressList,
} from "@/lib/email/email-address-text";

/** Keys that turn the typed address into a chip, as in a mail client. */
const commitKeys = new Set(["Enter", "Tab", ",", ";"]);

function hasOpenQuote(draftText: string): boolean {
  return (draftText.match(/(?<!\\)"/g) ?? []).length % 2 === 1;
}

function readAddressKey(recipientText: string): string {
  return parseEmailAddress(recipientText).address.toLowerCase();
}

/**
 * The text being typed in a recipient field and the keys that edit the list:
 * Enter, Tab, a comma or a semicolon (outside a quoted name), leaving the
 * field or pasting add addresses; Backspace in an empty field takes the last
 * one back to edit.
 */
export function useRecipientDraft({
  recipients,
  onChange,
}: {
  recipients: string[];
  onChange: (nextRecipients: string[]) => void;
}) {
  const [draftText, setDraftText] = React.useState("");

  const addRecipients = (addressListText: string) => {
    const knownKeys = new Set(recipients.map(readAddressKey));
    const addedRecipients = splitAddressList(addressListText).filter(
      (recipientText) => {
        const addressKey = readAddressKey(recipientText);
        if (knownKeys.has(addressKey)) {
          return false;
        }
        knownKeys.add(addressKey);
        return true;
      },
    );
    if (addedRecipients.length > 0) {
      onChange([...recipients, ...addedRecipients]);
    }
    setDraftText("");
  };

  const removeRecipient = (removedIndex: number) => {
    onChange(
      recipients.filter((_, recipientIndex) => recipientIndex !== removedIndex),
    );
  };

  /** Puts a chip back into the field to change it. */
  const editRecipient = (editedIndex: number) => {
    const editedText = recipients[editedIndex] ?? "";
    const remainingRecipients = recipients.filter(
      (_, recipientIndex) => recipientIndex !== editedIndex,
    );
    if (draftText.trim() !== "") {
      remainingRecipients.push(...splitAddressList(draftText));
    }
    onChange(remainingRecipients);
    setDraftText(editedText);
  };

  const handleKeyDown = (
    keyboardEvent: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    const isDraftEmpty = draftText.trim() === "";
    if (commitKeys.has(keyboardEvent.key)) {
      const isSeparatorInName =
        keyboardEvent.key !== "Enter" &&
        keyboardEvent.key !== "Tab" &&
        hasOpenQuote(draftText);
      if (isSeparatorInName || (isDraftEmpty && keyboardEvent.key === "Tab")) {
        return;
      }
      keyboardEvent.preventDefault();
      addRecipients(draftText);
      return;
    }
    if (
      keyboardEvent.key === "Backspace" &&
      draftText === "" &&
      recipients.length > 0
    ) {
      keyboardEvent.preventDefault();
      editRecipient(recipients.length - 1);
    }
  };

  const handlePaste = (
    clipboardEvent: React.ClipboardEvent<HTMLInputElement>,
  ) => {
    const pastedText = clipboardEvent.clipboardData.getData("text");
    if (splitAddressList(pastedText).length > 1) {
      clipboardEvent.preventDefault();
      addRecipients(`${draftText},${pastedText}`);
    }
  };

  return {
    draftText,
    setDraftText,
    commitDraft: () => {
      addRecipients(draftText);
    },
    removeRecipient,
    editRecipient,
    handleKeyDown,
    handlePaste,
  };
}
