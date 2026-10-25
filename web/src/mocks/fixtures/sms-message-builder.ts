import type {
  SmsApi,
  SmsChannel,
  SmsDirection,
  SmsMessageDetail,
} from "@/lib/api/types";
import { calculateSmsSegments } from "@/lib/sms/calculate-sms-segments";
import {
  createMockUlid,
  createProviderId,
  extractFixtureData,
} from "@/mocks/fixtures/fixture-helpers";

type NewSmsMessageSpec = {
  direction: SmsDirection;
  channel: SmsChannel;
  api: SmsApi;
  fromNumber: string;
  toNumber: string;
  body: string;
  statusCallbackUrl?: string | null;
};

/**
 * A message as the server stores it the moment it arrives: outbound starts
 * `queued` (the delivery simulation moves it on), inbound is `received`.
 */
export function buildNewSmsMessage(
  smsSpec: NewSmsMessageSpec,
): SmsMessageDetail {
  const segmentInfo = calculateSmsSegments(smsSpec.body);
  const createdAt = new Date().toISOString();
  const isOutbound = smsSpec.direction === "outbound";
  const initialStatus = isOutbound ? "queued" : "received";

  return {
    id: createMockUlid(),
    provider_id: createProviderId("SM"),
    direction: smsSpec.direction,
    channel: smsSpec.channel,
    api: smsSpec.api,
    from_number: smsSpec.fromNumber,
    to_number: smsSpec.toNumber,
    body: smsSpec.body,
    encoding: segmentInfo.encoding,
    segments: segmentInfo.segmentCount,
    media_urls: [],
    status: initialStatus,
    error_code: null,
    status_callback_url: smsSpec.statusCallbackUrl ?? null,
    messaging_service_sid: null,
    account:
      smsSpec.api === "twilio" ? "AC00000000000000000000000000000000" : null,
    extracted: extractFixtureData(smsSpec.body),
    opened_at: null,
    open_count: 0,
    created_at: createdAt,
    updated_at: createdAt,
    status_history: [
      {
        status: initialStatus,
        at: createdAt,
        error_code: null,
      },
    ],
    request_body: isOutbound
      ? {
          To: smsSpec.toNumber,
          From: smsSpec.fromNumber,
          Body: smsSpec.body,
        }
      : null,
    api_request_id: isOutbound ? createMockUlid() : null,
    callback_attempts: [],
  };
}
