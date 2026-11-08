import type { SmsMessageDetail, TwimlVerb } from "@/lib/api/types";
import type { MockDatabase } from "@/mocks/db/mock-database";
import { buildNewSmsMessage } from "@/mocks/fixtures/sms-message-builder";
import { type FetchOutcome, fetchTwiml } from "@/mocks/sms-replies/fetch-twiml";
import {
  type ReplyWebhookTarget,
  resolveReplyWebhookTarget,
} from "@/mocks/sms-replies/resolve-reply-webhook-target";

/** One inbound message can trigger at most this many TwiML fetches (04-sms). */
const maxTwimlFetches = 10;

type ReplyDatabase = Pick<
  MockDatabase,
  "virtualNumbers" | "messagingServices" | "smsMessages"
>;

/** The fields Twilio posts for an incoming message. */
function buildTwilioFields(
  inboundMessage: SmsMessageDetail,
  messagingServiceSid: string | null,
): Record<string, string> {
  const twilioFields: Record<string, string> = {
    MessageSid: inboundMessage.provider_id,
    SmsSid: inboundMessage.provider_id,
    SmsMessageSid: inboundMessage.provider_id,
    AccountSid: "AC00000000000000000000000000000000",
    ...(messagingServiceSid === null
      ? {}
      : { MessagingServiceSid: messagingServiceSid }),
    From: inboundMessage.from_number,
    To: inboundMessage.to_number,
    Body: inboundMessage.body,
    NumMedia: String(inboundMessage.media.length),
    NumSegments: String(inboundMessage.segments),
    ApiVersion: "2010-04-01",
  };
  inboundMessage.media.forEach((mediaItem, mediaIndex) => {
    twilioFields[`MediaUrl${mediaIndex}`] = mediaItem.url;
    twilioFields[`MediaContentType${mediaIndex}`] = mediaItem.content_type;
  });
  if (inboundMessage.channel === "whatsapp") {
    twilioFields.ProfileName = "WhatsApp user";
    twilioFields.WaId = inboundMessage.from_number.replace(/\D/g, "");
  }

  return twilioFields;
}

/** Primary, then the fallback with `ErrorCode` and `ErrorUrl` when it fails. */
function fetchWithFallback(
  replyTarget: ReplyWebhookTarget,
  twilioFields: Record<string, string>,
  createdAtMs: number,
): FetchOutcome[] {
  const primaryOutcome = fetchTwiml(
    replyTarget.url,
    replyTarget.method,
    twilioFields,
    false,
    createdAtMs,
  );
  if (primaryOutcome.isSucceeded || replyTarget.fallbackUrl === null) {
    return [primaryOutcome];
  }

  return [
    primaryOutcome,
    fetchTwiml(
      replyTarget.fallbackUrl,
      replyTarget.method,
      {
        ...twilioFields,
        ErrorCode: primaryOutcome.attempt.error_code ?? "11200",
        ErrorUrl: replyTarget.url,
      },
      true,
      createdAtMs + 1,
    ),
  ];
}

function buildReply(
  inboundMessage: SmsMessageDetail,
  messageVerb: Extract<TwimlVerb, { verb: "Message" }>,
): SmsMessageDetail {
  return {
    ...buildNewSmsMessage({
      direction: "outbound",
      channel: inboundMessage.channel,
      api: "twilio",
      fromNumber: messageVerb.from ?? inboundMessage.to_number,
      toNumber: messageVerb.to ?? inboundMessage.from_number,
      body: messageVerb.body,
      statusCallbackUrl: messageVerb.status_callback,
    }),
    in_reply_to_sms_id: inboundMessage.id,
  };
}

/**
 * Sends an inbound message to its reply webhook (SM-09.7): records every
 * attempt, follows `<Redirect>` up to 10 fetches, sets the result shown under
 * the bubble, and stores each `<Message>` as a TwiML reply in the thread.
 * Returns the replies, so the caller can simulate their delivery.
 */
export function runReplyWebhook(
  mockDatabase: ReplyDatabase,
  inboundMessage: SmsMessageDetail,
  nowMs: number = Date.now(),
): SmsMessageDetail[] {
  const replyTarget = resolveReplyWebhookTarget(mockDatabase, inboundMessage);
  if (replyTarget === null) {
    inboundMessage.reply_webhook = null;
    return [];
  }
  const messagingServiceSid =
    mockDatabase.virtualNumbers.find(
      (virtualNumber) =>
        virtualNumber.number ===
        inboundMessage.to_number.replace(/^whatsapp:/, ""),
    )?.messaging_service_sid ?? null;
  const twilioFields = buildTwilioFields(inboundMessage, messagingServiceSid);
  const fetchOutcomes = fetchWithFallback(replyTarget, twilioFields, nowMs);
  const pendingVerbs = [...(fetchOutcomes.at(-1)?.verbs ?? [])];
  const replies: SmsMessageDetail[] = [];
  while (pendingVerbs.length > 0) {
    const twimlVerb = pendingVerbs.shift();
    if (twimlVerb?.verb === "Message") {
      replies.push(buildReply(inboundMessage, twimlVerb));
    } else if (
      twimlVerb?.verb === "Redirect" &&
      fetchOutcomes.length < maxTwimlFetches
    ) {
      const redirectOutcome = fetchTwiml(
        twimlVerb.url,
        "POST",
        twilioFields,
        false,
        nowMs + fetchOutcomes.length,
      );
      fetchOutcomes.push(redirectOutcome);
      pendingVerbs.unshift(...redirectOutcome.verbs);
    }
  }
  const lastOutcome = fetchOutcomes.at(-1);
  const primaryAttempt = fetchOutcomes[0]?.attempt;
  inboundMessage.reply_webhook_attempts.push(
    ...fetchOutcomes.map((fetchOutcome) => fetchOutcome.attempt),
  );
  inboundMessage.reply_webhook = {
    target: replyTarget.target,
    outcome: lastOutcome?.isSucceeded === true ? "succeeded" : "failed",
    status_code: lastOutcome?.attempt.response?.status_code ?? null,
    error_code: primaryAttempt?.error_code ?? null,
    used_fallback:
      lastOutcome?.attempt.is_fallback === true && lastOutcome.isSucceeded,
    reply_count: replies.length,
  };
  mockDatabase.smsMessages.unshift(...[...replies].reverse());

  return replies;
}
