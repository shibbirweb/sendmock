import { BellIcon, BellOffIcon } from "lucide-react";

import { IconButton } from "@/components/common/icon-button";
import { ListActionToolbar } from "@/components/common/list-action-toolbar";
import type { CheckedItems } from "@/hooks/use-checked-items";
import { ImportEmailDialog } from "@/features/mail/list/import-email-dialog";
import { useMailNotifications } from "@/features/mail/list/use-mail-notifications";
import type { EmailListFilters } from "@/lib/api/types";

const emailNoun = { one: "email", many: "emails" };

type MailListToolbarProps = {
  /** The list's current search; notifications only come for emails that fit it. */
  emailFilters: EmailListFilters;
  loadedEmailCount: number;
  totalEmailCount: number;
  checkedEmails: CheckedItems;
  onMarkCheckedRead: (isRead: boolean) => void;
  onDeleteChecked: () => void;
  /** A search or filter is on, so the delete removes only the matching emails. */
  isFiltered: boolean;
  projectKey: string | undefined;
  onDeleteAll: () => void;
};

/** The shared list toolbar plus Mail's own tools: notifications and Import. */
export function MailListToolbar({
  emailFilters,
  loadedEmailCount,
  totalEmailCount,
  checkedEmails,
  onMarkCheckedRead,
  onDeleteChecked,
  isFiltered,
  projectKey,
  onDeleteAll,
}: MailListToolbarProps) {
  const { isSupported, isEnabled, toggleNotifications } =
    useMailNotifications(emailFilters);

  return (
    <ListActionToolbar
      itemNoun={emailNoun}
      loadedItemCount={loadedEmailCount}
      totalItemCount={totalEmailCount}
      checkedItemCount={checkedEmails.checkedItemCount}
      onToggleAllChecked={checkedEmails.setAllItemsChecked}
      onMarkCheckedRead={() => {
        onMarkCheckedRead(true);
      }}
      onMarkCheckedUnread={() => {
        onMarkCheckedRead(false);
      }}
      onDeleteChecked={onDeleteChecked}
      isFiltered={isFiltered}
      projectKey={projectKey}
      onDeleteAll={onDeleteAll}
    >
      {isSupported && (
        <IconButton
          variant="ghost"
          aria-pressed={isEnabled}
          label={
            isEnabled ? "Turn off notifications" : "Notify me about new emails"
          }
          onClick={() => {
            void toggleNotifications();
          }}
        >
          {isEnabled ? <BellIcon /> : <BellOffIcon />}
        </IconButton>
      )}
      <ImportEmailDialog />
    </ListActionToolbar>
  );
}
