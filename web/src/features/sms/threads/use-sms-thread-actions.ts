import { useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { toast } from "sonner";

import { countItems } from "@/components/common/list-action-toolbar";
import { useCheckedItems } from "@/hooks/use-checked-items";
import { useSelectedProjectKey } from "@/hooks/use-selected-project";
import {
  useDeleteAllSms,
  useDeleteSmsThread,
  useUpdateSmsThread,
} from "@/lib/api/hooks/use-sms-queries";
import type { SmsThread } from "@/lib/api/types";

export const conversationNoun = { one: "conversation", many: "conversations" };

/**
 * What the SMS list toolbar does (UI-14): mark or delete the ticked
 * conversations, and delete all of them or the ones the filter shows.
 */
export function useSmsThreadActions({
  visibleThreads,
  selectedThreadId,
  selectionResetKey,
  isFiltered,
}: {
  visibleThreads: SmsThread[];
  selectedThreadId: string | undefined;
  selectionResetKey: string;
  isFiltered: boolean;
}) {
  const navigate = useNavigate();
  const projectKey = useSelectedProjectKey();
  const visibleThreadIds = React.useMemo(
    () => visibleThreads.map((smsThread) => smsThread.thread_id),
    [visibleThreads],
  );
  const checkedThreads = useCheckedItems(
    visibleThreadIds,
    `${selectionResetKey}|${projectKey ?? ""}`,
  );
  const updateSmsThread = useUpdateSmsThread();
  const deleteSmsThread = useDeleteSmsThread();
  const deleteAllSms = useDeleteAllSms();

  // The open conversation is gone, so the right pane goes back to the list.
  const leaveDeletedConversation = (deletedThreadIds: string[]) => {
    if (
      selectedThreadId !== undefined &&
      deletedThreadIds.includes(selectedThreadId)
    ) {
      void navigate({ to: "/sms", search: (previousSearch) => previousSearch });
    }
  };

  return {
    checkedThreads,
    projectKey,
    markCheckedThreads: (isRead: boolean) => {
      checkedThreads.runForCheckedItems((threadId) => {
        updateSmsThread.mutate({ threadId, isRead });
      });
    },
    deleteCheckedThreads: () => {
      const deletedThreadIds = [...checkedThreads.checkedItemIds];
      checkedThreads.runForCheckedItems((threadId) => {
        deleteSmsThread.mutate(threadId);
      });
      leaveDeletedConversation(deletedThreadIds);
      toast(`${countItems(deletedThreadIds.length, conversationNoun)} deleted`);
    },
    deleteAllThreads: () => {
      if (isFiltered) {
        visibleThreadIds.forEach((threadId) => {
          deleteSmsThread.mutate(threadId);
        });
      } else {
        deleteAllSms.mutate(projectKey);
      }
      leaveDeletedConversation(visibleThreadIds);
    },
  };
}
