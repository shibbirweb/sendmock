import { Link } from "@tanstack/react-router";

import { SmsContactAvatar } from "@/features/sms/sms-contact-avatar";
import { SmsStatusTicks } from "@/features/sms/sms-status-ticks";
import type { SmsThread } from "@/lib/api/types";
import { formatDateTime, formatRelativeTime } from "@/lib/format/format-values";
import { stripChannelPrefix } from "@/lib/sms/format-phone-number";
import { cn } from "@/lib/utils";

/** One conversation: the other party, the latest message and when it came. */
export function SmsThreadListItem({
  smsThread,
  isSelected,
}: {
  smsThread: SmsThread;
  isSelected: boolean;
}) {
  const lastMessage = smsThread.last_message;
  const isLastMessageOutbound = lastMessage.direction === "outbound";

  return (
    <li>
      <Link
        to="/sms/$threadId"
        params={{ threadId: smsThread.thread_id }}
        className={cn(
          "flex gap-3 border-b px-3 py-3 outline-none hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          isSelected && "bg-muted",
        )}
      >
        <SmsContactAvatar channel={smsThread.channel} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-2 text-sm">
            <span className="min-w-0 truncate font-medium">
              {stripChannelPrefix(smsThread.contact_number)}
            </span>
            <time
              dateTime={lastMessage.created_at}
              title={formatDateTime(lastMessage.created_at)}
              className="ml-auto shrink-0 text-xs text-muted-foreground"
            >
              {formatRelativeTime(lastMessage.created_at)}
            </time>
          </span>
          <span className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
            {isLastMessageOutbound && (
              <SmsStatusTicks smsMessage={lastMessage} hasTooltip={false} />
            )}
            <span className="min-w-0 truncate">
              {isLastMessageOutbound && "You: "}
              {lastMessage.body}
            </span>
          </span>
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <span className="min-w-0 truncate">
              via {stripChannelPrefix(smsThread.app_number)}
            </span>
            {smsThread.channel === "whatsapp" && (
              <span className="shrink-0 rounded border px-1 text-[10px] uppercase">
                WhatsApp
              </span>
            )}
            <span className="ml-auto shrink-0">
              {smsThread.message_count} message
              {smsThread.message_count === 1 ? "" : "s"}
            </span>
          </span>
        </span>
      </Link>
    </li>
  );
}
