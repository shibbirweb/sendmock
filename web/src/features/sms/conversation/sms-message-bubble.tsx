import * as React from "react";

import { CopyButton } from "@/components/common/copy-button";
import { SmsMessageActions } from "@/features/sms/conversation/sms-message-actions";
import { useSmsOpenOnView } from "@/features/sms/conversation/use-sms-open-on-view";
import { smsApiLabels } from "@/features/sms/sms-labels";
import { SmsStatusTicks } from "@/features/sms/sms-status-ticks";
import type { SmsMessage } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format/format-values";
import { cn } from "@/lib/utils";

const bubbleColoursByKind = {
  inbound: "rounded-bl-sm border bg-muted text-foreground",
  outboundSms: "rounded-br-sm bg-sms-outbound text-sms-outbound-foreground",
  outboundWhatsapp:
    "rounded-br-sm bg-whatsapp-outbound text-whatsapp-outbound-foreground",
};

function readBubbleKind(smsMessage: SmsMessage) {
  if (smsMessage.direction === "inbound") {
    return "inbound";
  }

  return smsMessage.channel === "whatsapp" ? "outboundWhatsapp" : "outboundSms";
}

function formatTimeOfDay(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleTimeString(undefined, {
    timeStyle: "short",
  });
}

/** Facts under a bubble: time, segments and encoding, API, Messaging Service, ticks. */
function SmsMessageMeta({ smsMessage }: { smsMessage: SmsMessage }) {
  const isOutbound = smsMessage.direction === "outbound";

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-1.5 gap-y-0.5 px-1 text-[11px] text-muted-foreground",
        isOutbound && "justify-end",
      )}
    >
      <time
        dateTime={smsMessage.created_at}
        title={formatDateTime(smsMessage.created_at)}
      >
        {formatTimeOfDay(smsMessage.created_at)}
      </time>
      <span aria-hidden="true">·</span>
      <span title="Segments and encoding">
        {smsMessage.segments} segment{smsMessage.segments === 1 ? "" : "s"},{" "}
        {smsMessage.encoding}
      </span>
      {isOutbound && (
        <span className="rounded border px-1 text-[10px] uppercase">
          {smsApiLabels[smsMessage.api]}
        </span>
      )}
      {smsMessage.messaging_service_sid !== null && (
        <span
          className="max-w-32 truncate rounded border px-1 font-mono text-[10px]"
          title={`Messaging Service ${smsMessage.messaging_service_sid}`}
        >
          {smsMessage.messaging_service_sid}
        </span>
      )}
      {isOutbound && <SmsStatusTicks smsMessage={smsMessage} />}
    </div>
  );
}

/** One chat bubble: outbound on the right, inbound on the left. */
export function SmsMessageBubble({ smsMessage }: { smsMessage: SmsMessage }) {
  const bubbleElementRef = React.useRef<HTMLDivElement>(null);
  const isOutbound = smsMessage.direction === "outbound";
  useSmsOpenOnView(smsMessage, bubbleElementRef);

  return (
    <li
      className={cn(
        "group/sms-bubble flex items-center gap-1",
        isOutbound ? "flex-row-reverse pl-8" : "pr-8",
      )}
    >
      <div
        className={cn(
          "flex max-w-[min(32rem,85%)] flex-col gap-1",
          isOutbound ? "items-end" : "items-start",
        )}
      >
        <div
          ref={bubbleElementRef}
          data-sms-direction={smsMessage.direction}
          className={cn(
            "rounded-2xl px-3 py-2 text-sm break-words whitespace-pre-wrap",
            bubbleColoursByKind[readBubbleKind(smsMessage)],
          )}
        >
          {smsMessage.body}
        </div>
        {smsMessage.extracted.otp.map((otpCode) => (
          <div
            key={otpCode}
            className="flex items-center gap-1 rounded-md border bg-background px-2 py-0.5 text-xs"
          >
            <span className="text-muted-foreground">Code</span>
            <span className="font-mono font-semibold tracking-widest">
              {otpCode}
            </span>
            <CopyButton
              copyText={otpCode}
              label={`Copy code ${otpCode}`}
              className="size-6"
            />
          </div>
        ))}
        <SmsMessageMeta smsMessage={smsMessage} />
      </div>
      <SmsMessageActions smsMessage={smsMessage} />
    </li>
  );
}
