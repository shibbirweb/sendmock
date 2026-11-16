import * as React from "react";

import { useMarkReadOnOpen } from "@/hooks/use-mark-read-on-open";
import { useUpdateSmsThread } from "@/lib/api/hooks/use-sms-queries";
import type { SmsThread } from "@/lib/api/types";

/** Opening a conversation marks it read, as opening an email does (UI-14.3). */
export function useMarkThreadReadOnOpen(openThread: SmsThread | undefined) {
  const { mutate: updateSmsThread } = useUpdateSmsThread();
  const markThreadRead = React.useCallback(
    (threadId: string) => {
      updateSmsThread({ threadId, isRead: true });
    },
    [updateSmsThread],
  );

  useMarkReadOnOpen({
    openItemId: openThread?.thread_id,
    isUnread: (openThread?.unread_count ?? 0) > 0,
    markItemRead: markThreadRead,
  });
}
