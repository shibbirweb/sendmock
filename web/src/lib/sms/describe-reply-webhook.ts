import type { SmsReplyWebhookResult } from "@/lib/api/types";

/** Twilio's names for reply webhook failures (04-sms, Errors). */
export const replyWebhookErrorNames: Record<string, string> = {
  "11200": "HTTP retrieval failure",
  "11205": "HTTP connection failure",
  "12100": "Document parse failure",
  "12300": "Invalid Content-Type",
};

function describeErrorCode(errorCode: string | null): string {
  return errorCode === null
    ? "unknown error"
    : `${errorCode} ${replyWebhookErrorNames[errorCode] ?? "error"}`;
}

/**
 * The line under an inbound bubble (SM-09.7): "Reply webhook 200, 1 TwiML
 * reply", "Fallback 200 after 11205", "Reply webhook failed: 11205 HTTP
 * connection failure", or "Rules only" without a reply webhook.
 */
export function describeReplyWebhook(
  replyWebhook: SmsReplyWebhookResult | null,
): string {
  if (replyWebhook === null) {
    return "Rules only";
  }
  if (replyWebhook.outcome === "failed") {
    return `Reply webhook failed: ${describeErrorCode(replyWebhook.error_code)}`;
  }
  const answeredBy = replyWebhook.used_fallback
    ? `Fallback ${replyWebhook.status_code ?? ""} after ${replyWebhook.error_code ?? "an error"}`
    : `Reply webhook ${replyWebhook.status_code ?? ""}`;
  const replyText =
    replyWebhook.reply_count === 0
      ? ""
      : `, ${replyWebhook.reply_count} TwiML ${replyWebhook.reply_count === 1 ? "reply" : "replies"}`;

  return `${answeredBy.trim()}${replyText}`;
}
