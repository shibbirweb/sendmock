import * as React from "react";

/**
 * Marks an item read when it is opened (UI-14.3): a conversation, a push or a
 * captured request. Only on opening, so Mark unread on the open item sticks.
 */
export function useMarkReadOnOpen({
  openItemId,
  isUnread,
  markItemRead,
}: {
  openItemId: string | undefined;
  isUnread: boolean;
  markItemRead: (itemId: string) => void;
}) {
  const lastOpenedItemIdRef = React.useRef<string | undefined>(undefined);

  React.useEffect(() => {
    if (openItemId === undefined || !isUnread) {
      return;
    }
    if (openItemId === lastOpenedItemIdRef.current) {
      return;
    }
    lastOpenedItemIdRef.current = openItemId;
    markItemRead(openItemId);
  }, [openItemId, isUnread, markItemRead]);
}
