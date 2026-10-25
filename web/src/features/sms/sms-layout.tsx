import { Outlet, useParams } from "@tanstack/react-router";

import { SmsThreadListPanel } from "@/features/sms/threads/sms-thread-list-panel";
import { cn } from "@/lib/utils";

/**
 * Conversations on the left, the selected one on the right. On narrow screens
 * only one pane shows: the list, or the conversation with a back button.
 */
export function SmsLayout() {
  const { threadId: selectedThreadId } = useParams({ strict: false });

  return (
    <div className="flex h-full min-h-0 flex-1">
      <section
        aria-label="Conversation list"
        className={cn(
          "flex min-h-0 w-full flex-col border-r md:w-80 md:shrink-0 xl:w-96",
          selectedThreadId !== undefined && "hidden md:flex",
        )}
      >
        <SmsThreadListPanel selectedThreadId={selectedThreadId} />
      </section>
      <section
        aria-label="Conversation"
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col",
          selectedThreadId === undefined && "hidden md:flex",
        )}
      >
        <Outlet />
      </section>
    </div>
  );
}
