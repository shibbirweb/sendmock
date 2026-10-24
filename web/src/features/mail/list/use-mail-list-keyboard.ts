import { useNavigate } from "@tanstack/react-router";
import * as React from "react";

import { isTypingInEditableElement } from "@/features/shortcuts/is-typing-in-editable-element";
import type { EmailSummary } from "@/lib/api/types";

type MailListKeyboardOptions = {
  emails: EmailSummary[];
  selectedEmailId: string | undefined;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  scrollToEmailIndex: (emailIndex: number) => void;
  onDeleteEmail: (emailId: string) => void;
};

/**
 * Mail list shortcuts: J / K open the next or previous email, Enter opens the
 * first one, D deletes the open email and / focuses the search box.
 */
export function useMailListKeyboard({
  emails,
  selectedEmailId,
  searchInputRef,
  scrollToEmailIndex,
  onDeleteEmail,
}: MailListKeyboardOptions) {
  const navigate = useNavigate();

  React.useEffect(() => {
    const openEmailAt = (emailIndex: number) => {
      const targetEmail = emails[emailIndex];
      if (targetEmail === undefined) {
        return;
      }

      scrollToEmailIndex(emailIndex);
      void navigate({
        to: "/mail/$emailId",
        params: { emailId: targetEmail.id },
        search: (previousSearch) => previousSearch,
      });
    };

    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
      const hasModifier =
        keyboardEvent.metaKey || keyboardEvent.ctrlKey || keyboardEvent.altKey;
      if (hasModifier || isTypingInEditableElement(keyboardEvent.target)) {
        return;
      }

      const selectedIndex = emails.findIndex(
        (email) => email.id === selectedEmailId,
      );
      const pressedKey = keyboardEvent.key.toLowerCase();

      if (keyboardEvent.key === "/") {
        keyboardEvent.preventDefault();
        searchInputRef.current?.focus();
      } else if (pressedKey === "j") {
        openEmailAt(Math.min(selectedIndex + 1, emails.length - 1));
      } else if (pressedKey === "k") {
        openEmailAt(Math.max(selectedIndex - 1, 0));
      } else if (keyboardEvent.key === "Enter" && selectedIndex === -1) {
        openEmailAt(0);
      } else if (pressedKey === "d" && selectedEmailId !== undefined) {
        onDeleteEmail(selectedEmailId);
        openEmailAt(Math.min(selectedIndex + 1, emails.length - 1));
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    emails,
    selectedEmailId,
    searchInputRef,
    scrollToEmailIndex,
    onDeleteEmail,
    navigate,
  ]);
}
