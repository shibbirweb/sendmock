import type {
  SmsApi,
  SmsCallbackAttempt,
  SmsChannel,
  SmsDirection,
  SmsMessageDetail,
  SmsStatus,
  SmsStatusChange,
} from "@/lib/api/types";
import { calculateSmsSegments } from "@/lib/sms/calculate-sms-segments";
import {
  createMockUlid,
  createProviderId,
  extractFixtureData,
  minutesAgo,
  minutesAgoInMs,
} from "@/mocks/fixtures/fixture-helpers";
import { buildSmsCallbackAttempt } from "@/mocks/fixtures/sms-callback-builder";

type SmsFixtureSpec = {
  minutesAgo: number;
  direction: SmsDirection;
  appNumber: string;
  contactNumber: string;
  body: string;
  status?: SmsStatus;
  errorCode?: string | null;
  api?: SmsApi;
  channel?: SmsChannel;
  openCount?: number;
  messagingServiceSid?: string | null;
  /** MMS / WhatsApp media; the demo serves a placeholder for each file. */
  media?: { filename: string; contentType: string; sizeBytes: number }[];
  /** The callback for the final status fails once, then the retry succeeds. */
  isCallbackFailingOnce?: boolean;
};

const callbackRetryDelayMs = 30_000;

const outboundStatusSequence: SmsStatus[] = ["queued", "sent", "delivered"];

function buildStatusHistory(smsSpec: SmsFixtureSpec): SmsStatusChange[] {
  if (smsSpec.direction === "inbound") {
    return [
      {
        status: "received",
        at: minutesAgo(smsSpec.minutesAgo),
        error_code: null,
      },
    ];
  }

  const finalStatus = smsSpec.status ?? "delivered";
  const reachedStatuses =
    finalStatus === "delivered"
      ? outboundStatusSequence
      : (["queued", "sent", finalStatus] as SmsStatus[]);

  return reachedStatuses.map((reachedStatus, statusIndex) => ({
    status: reachedStatus,
    at: minutesAgo(smsSpec.minutesAgo - statusIndex * 0.02),
    error_code:
      reachedStatus === finalStatus ? (smsSpec.errorCode ?? null) : null,
  }));
}

/** One callback per status change after the first, as the server sends them. */
function buildCallbackAttempts(
  smsMessage: SmsMessageDetail,
  smsSpec: SmsFixtureSpec,
): SmsCallbackAttempt[] {
  const callbackUrl = smsMessage.status_callback_url;
  if (callbackUrl === null) {
    return [];
  }

  const reportedChanges = smsMessage.status_history.slice(1);

  return reportedChanges.flatMap((statusChange, changeIndex) => {
    const isFinalChange = changeIndex === reportedChanges.length - 1;
    if (!isFinalChange || smsSpec.isCallbackFailingOnce !== true) {
      return [buildSmsCallbackAttempt(smsMessage, callbackUrl, statusChange)];
    }

    const retriedAt = new Date(
      new Date(statusChange.at).getTime() + callbackRetryDelayMs,
    ).toISOString();

    return [
      buildSmsCallbackAttempt(smsMessage, callbackUrl, statusChange, {
        attempt: 1,
        responseStatusCode: 500,
      }),
      buildSmsCallbackAttempt(
        smsMessage,
        callbackUrl,
        { ...statusChange, at: retriedAt },
        {
          attempt: 2,
          responseStatusCode: 204,
        },
      ),
    ];
  });
}

function buildSmsMessage(smsSpec: SmsFixtureSpec): SmsMessageDetail {
  const segmentInfo = calculateSmsSegments(smsSpec.body);
  const isOutbound = smsSpec.direction === "outbound";
  const fromNumber = isOutbound ? smsSpec.appNumber : smsSpec.contactNumber;
  const toNumber = isOutbound ? smsSpec.contactNumber : smsSpec.appNumber;
  const api = smsSpec.api ?? "twilio";
  const openCount = smsSpec.openCount ?? 0;

  const smsMessage: SmsMessageDetail = {
    id: createMockUlid(minutesAgoInMs(smsSpec.minutesAgo)),
    provider_id:
      api === "twilio" ? createProviderId("SM") : createProviderId(""),
    direction: smsSpec.direction,
    channel: smsSpec.channel ?? "sms",
    api,
    from_number: fromNumber,
    to_number: toNumber,
    body: smsSpec.body,
    encoding: segmentInfo.encoding,
    segments: segmentInfo.segmentCount,
    media: [],
    status: isOutbound ? (smsSpec.status ?? "delivered") : "received",
    error_code: smsSpec.errorCode ?? null,
    status_callback_url: isOutbound ? "http://localhost:8000/sms/status" : null,
    messaging_service_sid: smsSpec.messagingServiceSid ?? null,
    account: api === "twilio" ? "AC00000000000000000000000000000000" : null,
    extracted: extractFixtureData(smsSpec.body),
    opened_at: openCount > 0 ? minutesAgo(smsSpec.minutesAgo - 1) : null,
    open_count: openCount,
    reply_webhook: null,
    in_reply_to_sms_id: null,
    created_at: minutesAgo(smsSpec.minutesAgo),
    updated_at: minutesAgo(smsSpec.minutesAgo),
    status_history: buildStatusHistory(smsSpec),
    request_body: isOutbound
      ? { To: toNumber, From: fromNumber, Body: smsSpec.body }
      : null,
    api_request_id: isOutbound
      ? createMockUlid(minutesAgoInMs(smsSpec.minutesAgo))
      : null,
    callback_attempts: [],
    reply_webhook_attempts: [],
  };
  smsMessage.media = (smsSpec.media ?? []).map((mediaSpec, mediaIndex) => ({
    media_index: mediaIndex,
    content_type: mediaSpec.contentType,
    size_bytes: mediaSpec.sizeBytes,
    filename: mediaSpec.filename,
    source_url: null,
    url: `/api/v1/sms/${smsMessage.id}/media/${mediaIndex}`,
  }));
  smsMessage.callback_attempts = buildCallbackAttempts(smsMessage, smsSpec);

  return smsMessage;
}

const supportLine = "+15550001111";
const alertsLine = "+15550002222";
const whatsappLine = "whatsapp:+15550003333";

const smsFixtureSpecs: SmsFixtureSpec[] = [
  {
    minutesAgo: 0.5,
    direction: "outbound",
    appNumber: supportLine,
    contactNumber: "+8801700000000",
    body: "Your Acme verification code is 482913. It expires in 10 minutes.",
    openCount: 1,
  },
  {
    minutesAgo: 4,
    direction: "outbound",
    appNumber: supportLine,
    contactNumber: "+8801711111111",
    body: "আপনার Acme যাচাইকরণ কোড 739201। কোডটি ১০ মিনিটের মধ্যে ব্যবহার করুন। এই কোড কারও সাথে শেয়ার করবেন না।",
    // Sent through the demo's custom provider (docs/plan/22).
    api: "sslwireless",
  },
  {
    minutesAgo: 9,
    direction: "outbound",
    appNumber: alertsLine,
    contactNumber: "+14155550123",
    body: "Acme alert: your scheduled export finished. 1,204 rows were exported to reports/october.csv. Download it within 7 days from the Exports page in your dashboard, or reply STOP to stop these alerts.",
    api: "vonage",
  },
  {
    minutesAgo: 12,
    direction: "outbound",
    appNumber: supportLine,
    contactNumber: "+15005550101",
    body: "Your order #10293 has shipped.",
    status: "undelivered",
    errorCode: "30003",
  },
  {
    minutesAgo: 13,
    direction: "outbound",
    appNumber: supportLine,
    contactNumber: "+15005550104",
    body: "Reminder: your appointment is tomorrow at 10:00.",
    status: "failed",
    errorCode: "30008",
    messagingServiceSid: "MG00000000000000000000000000000001",
    isCallbackFailingOnce: true,
  },
  {
    minutesAgo: 20,
    direction: "outbound",
    appNumber: alertsLine,
    contactNumber: "+447700900123",
    body: "Acme: reply YES to confirm your booking for Thursday.",
  },
  {
    minutesAgo: 18,
    direction: "inbound",
    appNumber: alertsLine,
    contactNumber: "+447700900123",
    body: "YES",
  },
  {
    minutesAgo: 17,
    direction: "outbound",
    appNumber: alertsLine,
    contactNumber: "+447700900123",
    body: "Booked for Thursday. Show this code at the door.",
    media: [
      {
        filename: "booking-qr.png",
        contentType: "image/png",
        sizeBytes: 24_118,
      },
      {
        filename: "booking.pdf",
        contentType: "application/pdf",
        sizeBytes: 96_512,
      },
    ],
  },
  {
    minutesAgo: 30,
    direction: "outbound",
    appNumber: alertsLine,
    contactNumber: "+61400000000",
    body: "Acme weekly tips: try keyboard shortcuts in the dashboard.",
  },
  {
    minutesAgo: 29,
    direction: "inbound",
    appNumber: alertsLine,
    contactNumber: "+61400000000",
    body: "STOP",
  },
  {
    minutesAgo: 40,
    direction: "outbound",
    appNumber: whatsappLine,
    contactNumber: "whatsapp:+8801722222222",
    body: "Hi Karim, your Acme order is out for delivery today.",
    channel: "whatsapp",
    openCount: 1,
  },
  {
    minutesAgo: 39,
    direction: "inbound",
    appNumber: whatsappLine,
    contactNumber: "whatsapp:+8801722222222",
    body: "Thanks! Can you deliver after 5pm?",
    channel: "whatsapp",
  },
  {
    minutesAgo: 38,
    direction: "inbound",
    appNumber: whatsappLine,
    contactNumber: "whatsapp:+8801722222222",
    body: "This is the gate, please leave it with the guard.",
    channel: "whatsapp",
    media: [
      { filename: "gate.jpg", contentType: "image/jpeg", sizeBytes: 182_430 },
    ],
  },
];

export function buildStandardSmsFixtures(): SmsMessageDetail[] {
  return smsFixtureSpecs.map(buildSmsMessage);
}
