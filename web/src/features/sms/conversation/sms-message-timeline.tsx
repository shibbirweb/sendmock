import * as React from "react";

import { groupSmsByDay } from "@/features/sms/conversation/group-sms-by-day";
import { SmsMessageBubble } from "@/features/sms/conversation/sms-message-bubble";
import type { SmsMessage } from "@/lib/api/types";

/**
 * The scrolling chat area with day separators. It starts at the newest
 * message and follows new ones as they arrive.
 */
export function SmsMessageTimeline({
  smsMessagesOldestFirst,
}: {
  smsMessagesOldestFirst: SmsMessage[];
}) {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const renderedMessageCountRef = React.useRef(0);
  const dayGroups = React.useMemo(
    () => groupSmsByDay(smsMessagesOldestFirst),
    [smsMessagesOldestFirst],
  );

  React.useLayoutEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const messageCount = smsMessagesOldestFirst.length;
    if (
      scrollContainer === null ||
      messageCount <= renderedMessageCountRef.current
    ) {
      renderedMessageCountRef.current = messageCount;
      return;
    }

    renderedMessageCountRef.current = messageCount;
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
  }, [smsMessagesOldestFirst.length]);

  return (
    <div
      ref={scrollContainerRef}
      className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6"
    >
      {dayGroups.map((dayGroup) => (
        <section
          key={dayGroup.dayKey}
          aria-label={dayGroup.dayLabel}
          className="grid gap-3 pb-3"
        >
          <h3 className="sticky top-0 z-10 justify-self-center rounded-full border bg-background px-2.5 py-0.5 text-xs text-muted-foreground">
            {dayGroup.dayLabel}
          </h3>
          <ol className="grid gap-3">
            {dayGroup.smsMessages.map((smsMessage) => (
              <SmsMessageBubble key={smsMessage.id} smsMessage={smsMessage} />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
