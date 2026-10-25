import { Link } from "@tanstack/react-router";
import {
  CircleAlertIcon,
  CornerDownRightIcon,
  WebhookIcon,
} from "lucide-react";

import type { SmsMessage } from "@/lib/api/types";
import { describeReplyWebhook } from "@/lib/sms/describe-reply-webhook";
import { cn } from "@/lib/utils";

/** Under an inbound bubble: what its reply webhook answered, opening the drawer (SM-09.7). */
export function SmsReplyWebhookLine({
  smsMessage,
}: {
  smsMessage: SmsMessage;
}) {
  const replyWebhook = smsMessage.reply_webhook;
  const hasFailed = replyWebhook?.outcome === "failed";
  const StatusIcon = hasFailed ? CircleAlertIcon : WebhookIcon;

  return (
    <Link
      from="/sms/$threadId"
      to="."
      search={{ message: smsMessage.id }}
      data-testid="reply-webhook-result"
      className={cn(
        "flex items-center gap-1 rounded-sm px-1 text-[11px] hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        hasFailed ? "text-destructive" : "text-muted-foreground",
      )}
    >
      <StatusIcon aria-hidden="true" className="size-3" />
      {describeReplyWebhook(replyWebhook)}
    </Link>
  );
}

/** On a reply created from TwiML: a badge that scrolls to the message it answers. */
export function TwimlReplyBadge({
  inReplyToSmsId,
}: {
  inReplyToSmsId: string;
}) {
  return (
    <button
      type="button"
      className="flex items-center gap-1 rounded border px-1 text-[10px] uppercase hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      title="Created from the app's TwiML; go to the message it answers"
      onClick={() => {
        const answeredBubble = document.getElementById(`sms-${inReplyToSmsId}`);
        answeredBubble?.scrollIntoView({ block: "center", behavior: "smooth" });
        answeredBubble?.focus({ preventScroll: true });
      }}
    >
      <CornerDownRightIcon aria-hidden="true" className="size-3" />
      TwiML reply
    </button>
  );
}
