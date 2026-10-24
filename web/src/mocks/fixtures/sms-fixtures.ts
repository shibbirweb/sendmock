import type {
  SmsApi,
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
};

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

function buildSmsMessage(smsSpec: SmsFixtureSpec): SmsMessageDetail {
  const segmentInfo = calculateSmsSegments(smsSpec.body);
  const isOutbound = smsSpec.direction === "outbound";
  const fromNumber = isOutbound ? smsSpec.appNumber : smsSpec.contactNumber;
  const toNumber = isOutbound ? smsSpec.contactNumber : smsSpec.appNumber;
  const api = smsSpec.api ?? "twilio";
  const openCount = smsSpec.openCount ?? 0;

  return {
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
    media_urls: [],
    status: isOutbound ? (smsSpec.status ?? "delivered") : "received",
    error_code: smsSpec.errorCode ?? null,
    status_callback_url: isOutbound ? "http://localhost:8000/sms/status" : null,
    messaging_service_sid: smsSpec.messagingServiceSid ?? null,
    account: api === "twilio" ? "AC00000000000000000000000000000000" : null,
    extracted: extractFixtureData(smsSpec.body),
    opened_at: openCount > 0 ? minutesAgo(smsSpec.minutesAgo - 1) : null,
    open_count: openCount,
    created_at: minutesAgo(smsSpec.minutesAgo),
    updated_at: minutesAgo(smsSpec.minutesAgo),
    status_history: buildStatusHistory(smsSpec),
    request_body: isOutbound
      ? { To: toNumber, From: fromNumber, Body: smsSpec.body }
      : null,
    api_request_id: isOutbound
      ? createMockUlid(minutesAgoInMs(smsSpec.minutesAgo))
      : null,
  };
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
];

export function buildStandardSmsFixtures(): SmsMessageDetail[] {
  return smsFixtureSpecs.map(buildSmsMessage);
}
