import { Link } from "@tanstack/react-router";

import { ListRowCheckbox } from "@/components/common/list-row-checkbox";
import { SmsContactAvatar } from "@/features/sms/sms-contact-avatar";
import { describeMediaOnlyMessage } from "@/features/sms/media/sms-media-urls";
import { SmsStatusTicks } from "@/features/sms/sms-status-ticks";
import type { SmsThread } from "@/lib/api/types";
import { formatDateTime, formatRelativeTime } from "@/lib/format/format-values";
import { stripChannelPrefix } from "@/lib/sms/format-phone-number";
import { cn } from "@/lib/utils";

/** One conversation: the other party, the latest message and when it came. */
export function SmsThreadListItem({
  smsThread,
  isSelected,
  isChecked,
  isAnyChecked,
  onCheckedChange,
}: {
  smsThread: SmsThread;
  isSelected: boolean;
  isChecked: boolean;
  isAnyChecked: boolean;
  onCheckedChange: (isChecked: boolean) => void;
}) {
  const lastMessage = smsThread.last_message;
  const isLastMessageOutbound = lastMessage.direction === "outbound";
  const isUnread = smsThread.unread_count > 0;
  const contactLabel = stripChannelPrefix(smsThread.contact_number);

  return (
    <li
      className={cn(
        "group/list-row flex items-start gap-2 border-b pl-3 hover:bg-muted/60",
        isSelected && "bg-muted",
      )}
    >
      <div className="flex w-4 shrink-0 flex-col items-center gap-2 pt-3.5">
        <ListRowCheckbox
          itemLabel={`conversation with ${contactLabel}`}
          isChecked={isChecked}
          isAnyChecked={isAnyChecked}
          onCheckedChange={onCheckedChange}
        />
        {isUnread && (
          <span
            role="img"
            aria-label="Unread"
            className="size-2 rounded-full bg-primary"
          />
        )}
      </div>
      <Link
        to="/sms/$threadId"
        params={{ threadId: smsThread.thread_id }}
        className="flex min-w-0 flex-1 gap-3 py-3 pr-3 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <SmsContactAvatar channel={smsThread.channel} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-2 text-sm">
            <span
              className={cn(
                "min-w-0 truncate",
                isUnread ? "font-semibold" : "font-medium",
              )}
            >
              {contactLabel}
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
              {lastMessage.body === "" && lastMessage.media.length > 0
                ? describeMediaOnlyMessage(lastMessage.media)
                : lastMessage.body}
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
