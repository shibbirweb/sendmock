import { useNavigate } from "@tanstack/react-router";
import * as React from "react";

import { useListKeyboardShortcuts } from "@/features/shortcuts/use-list-keyboard-shortcuts";
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
  const emailIds = React.useMemo(
    () => emails.map((email) => email.id),
    [emails],
  );

  const openEmailAt = React.useCallback(
    (emailIndex: number) => {
      const targetEmailId = emailIds[emailIndex];
      if (targetEmailId === undefined) {
        return;
      }

      scrollToEmailIndex(emailIndex);
      void navigate({
        to: "/mail/$emailId",
        params: { emailId: targetEmailId },
        search: (previousSearch) => previousSearch,
      });
    },
    [emailIds, scrollToEmailIndex, navigate],
  );

  useListKeyboardShortcuts({
    itemIds: emailIds,
    selectedItemId: selectedEmailId,
    searchInputRef,
    onOpenItemAt: openEmailAt,
    onDeleteSelectedItem: onDeleteEmail,
  });
}
