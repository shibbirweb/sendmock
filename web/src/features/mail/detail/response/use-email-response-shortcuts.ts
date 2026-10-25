import * as React from "react";

import {
  canRespondToEmail,
  type EmailComposerMode,
  hasSeveralRecipients,
} from "@/features/mail/detail/response/email-composer-mode";
import { isTypingInEditableElement } from "@/features/shortcuts/is-typing-in-editable-element";
import type { EmailDetail } from "@/lib/api/types";

/** R replies, Shift+R replies to all, F forwards the open email. */
export function useEmailResponseShortcuts(
  email: EmailDetail | undefined,
  onStartResponse: (composerMode: EmailComposerMode) => void,
) {
  React.useEffect(() => {
    if (email === undefined || !canRespondToEmail(email)) {
      return;
    }

    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
      const hasModifier =
        keyboardEvent.metaKey || keyboardEvent.ctrlKey || keyboardEvent.altKey;
      if (hasModifier || isTypingInEditableElement(keyboardEvent.target)) {
        return;
      }

      const pressedKey = keyboardEvent.key.toLowerCase();
      if (pressedKey === "r" && keyboardEvent.shiftKey) {
        if (hasSeveralRecipients(email)) {
          keyboardEvent.preventDefault();
          onStartResponse("reply_all");
        }
      } else if (pressedKey === "r") {
        keyboardEvent.preventDefault();
        onStartResponse("reply");
      } else if (pressedKey === "f" && !keyboardEvent.shiftKey) {
        keyboardEvent.preventDefault();
        onStartResponse("forward");
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [email, onStartResponse]);
}
