import { ChevronRightIcon, RotateCwIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RecordedExchange } from "@/features/sms/drawer/recorded-exchange";
import { ApiError } from "@/lib/api/api-client";
import { useResendReplyWebhook } from "@/lib/api/hooks/use-sms-queries";
import type {
  SmsMessageDetail,
  SmsReplyWebhookAttempt,
  TwimlVerb,
} from "@/lib/api/types";
import { formatDateTime } from "@/lib/format/format-values";
import {
  describeReplyWebhook,
  replyWebhookErrorNames,
} from "@/lib/sms/describe-reply-webhook";

function TwimlVerbList({ twimlVerbs }: { twimlVerbs: TwimlVerb[] }) {
  if (twimlVerbs.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No TwiML verbs: no reply was sent.
      </p>
    );
  }

  return (
    <ol aria-label="Parsed TwiML" className="grid gap-1.5 text-xs">
      {twimlVerbs.map((twimlVerb, verbIndex) => (
        <li key={verbIndex} className="rounded-md border bg-muted/30 p-2">
          <span className="font-mono font-medium">
            &lt;{twimlVerb.verb}&gt;
          </span>{" "}
          {twimlVerb.verb === "Message" ? (
            <>
              {twimlVerb.body}
              <span className="block text-muted-foreground">
                {twimlVerb.to !== null && `to ${twimlVerb.to} `}
                {twimlVerb.from !== null && `from ${twimlVerb.from} `}
                {twimlVerb.status_callback !== null &&
                  `statusCallback ${twimlVerb.status_callback} `}
                {twimlVerb.media_urls.length > 0 &&
                  `${twimlVerb.media_urls.length} media`}
              </span>
            </>
          ) : (
            <span className="font-mono">{twimlVerb.url}</span>
          )}
        </li>
      ))}
    </ol>
  );
}

function ReplyWebhookAttemptRow({
  replyAttempt,
}: {
  replyAttempt: SmsReplyWebhookAttempt;
}) {
  const hasFailed = replyAttempt.error_code !== null;

  return (
    <li>
      <details className="group/attempt rounded-md border" open={hasFailed}>
        <summary className="flex list-none flex-wrap items-center gap-2 px-3 py-2 text-sm [&::-webkit-details-marker]:hidden">
          <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-open/attempt:rotate-90 motion-reduce:transition-none" />
          <span className="font-medium">
            {replyAttempt.is_fallback ? "Fallback URL" : "Primary URL"}
          </span>
          <Badge variant={hasFailed ? "destructive" : "secondary"}>
            {hasFailed
              ? `${replyAttempt.error_code} ${replyWebhookErrorNames[replyAttempt.error_code ?? ""] ?? ""}`.trim()
              : (replyAttempt.response?.status_code ?? "OK")}
          </Badge>
          <span className="ml-auto text-xs text-muted-foreground">
            {formatDateTime(replyAttempt.created_at)}
          </span>
        </summary>
        {replyAttempt.error_message !== null && (
          <p className="border-t px-3 py-2 text-xs text-destructive">
            {replyAttempt.error_message}
          </p>
        )}
        <RecordedExchange
          request={replyAttempt.request}
          response={replyAttempt.response}
        />
        <div className="grid gap-1.5 border-t px-3 py-3">
          <h4 className="text-xs font-medium">TwiML</h4>
          <TwimlVerbList twimlVerbs={replyAttempt.twiml} />
        </div>
      </details>
    </li>
  );
}

/** Where an inbound message's reply webhook went, every attempt, and Resend (SM-09.7). */
export function SmsReplyWebhookPanel({
  smsMessage,
}: {
  smsMessage: SmsMessageDetail;
}) {
  const resendReplyWebhook = useResendReplyWebhook();
  const replyWebhook = smsMessage.reply_webhook;

  return (
    <div className="grid gap-3" data-testid="reply-webhook-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="grid gap-0.5">
          <p className="text-sm font-medium">
            {describeReplyWebhook(replyWebhook)}
          </p>
          <p className="text-xs text-muted-foreground">
            {replyWebhook === null
              ? "The number has no inbound URL, so only webhook rules on sms.inbound receive it."
              : replyWebhook.target === "messaging_service"
                ? "Sent to the Messaging Service's request URL."
                : "Sent to the number's inbound URL."}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={replyWebhook === null || resendReplyWebhook.isPending}
          onClick={() => {
            resendReplyWebhook.mutate(smsMessage.id, {
              onSuccess: () => toast("Reply webhook sent again"),
              onError: (requestError) => {
                toast.error(
                  requestError instanceof ApiError
                    ? requestError.message
                    : "Could not resend the reply webhook",
                );
              },
            });
          }}
        >
          <RotateCwIcon />
          Resend reply webhook
        </Button>
      </div>
      {smsMessage.reply_webhook_attempts.length > 0 && (
        <ol aria-label="Reply webhook attempts" className="grid gap-2">
          {[...smsMessage.reply_webhook_attempts]
            .reverse()
            .map((replyAttempt) => (
              <ReplyWebhookAttemptRow
                key={replyAttempt.id}
                replyAttempt={replyAttempt}
              />
            ))}
        </ol>
      )}
    </div>
  );
}
