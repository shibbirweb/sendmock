import type {
  RecordedHttpRequest,
  SmsCallbackAttempt,
  SmsMessageDetail,
  SmsStatusChange,
} from "@/lib/api/types";
import { createMockUlid } from "@/mocks/fixtures/fixture-helpers";

type SmsCallbackOutcome = {
  attempt: number;
  responseStatusCode: number;
};

/** Twilio posts a form with the message SID, status and error code. */
function buildTwilioCallbackRequest(
  smsMessage: SmsMessageDetail,
  callbackUrl: string,
  statusChange: SmsStatusChange,
): RecordedHttpRequest {
  const formFields = new URLSearchParams({
    MessageSid: smsMessage.provider_id,
    SmsSid: smsMessage.provider_id,
    AccountSid: smsMessage.account ?? "",
    From: smsMessage.from_number,
    To: smsMessage.to_number,
    MessageStatus: statusChange.status,
    SmsStatus: statusChange.status,
    ApiVersion: "2010-04-01",
  });
  if (statusChange.error_code !== null) {
    formFields.set("ErrorCode", statusChange.error_code);
  }

  return {
    method: "POST",
    url: callbackUrl,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "TwilioProxy/1.1",
      "X-Twilio-Signature": btoa(
        `${smsMessage.provider_id}:${statusChange.status}`,
      ).slice(0, 28),
    },
    body: formFields.toString(),
  };
}

/** Other APIs get SendMock's JSON callback. */
function buildJsonCallbackRequest(
  smsMessage: SmsMessageDetail,
  callbackUrl: string,
  statusChange: SmsStatusChange,
): RecordedHttpRequest {
  const callbackPayload = {
    id: smsMessage.provider_id,
    status: statusChange.status,
    error_code: statusChange.error_code,
    from: smsMessage.from_number,
    to: smsMessage.to_number,
  };

  return {
    method: "POST",
    url: callbackUrl,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "SendMock",
    },
    body: JSON.stringify(callbackPayload, null, 2),
  };
}

/** One recorded call to the message's status callback URL for a status change. */
export function buildSmsCallbackAttempt(
  smsMessage: SmsMessageDetail,
  callbackUrl: string,
  statusChange: SmsStatusChange,
  callbackOutcome: SmsCallbackOutcome = {
    attempt: 1,
    responseStatusCode: 204,
  },
): SmsCallbackAttempt {
  const isSuccessful =
    callbackOutcome.responseStatusCode >= 200 &&
    callbackOutcome.responseStatusCode < 300;
  const callbackRequest =
    smsMessage.api === "twilio"
      ? buildTwilioCallbackRequest(smsMessage, callbackUrl, statusChange)
      : buildJsonCallbackRequest(smsMessage, callbackUrl, statusChange);

  return {
    id: createMockUlid(new Date(statusChange.at).getTime()),
    reported_status: statusChange.status,
    attempt: callbackOutcome.attempt,
    request: callbackRequest,
    response: {
      status_code: callbackOutcome.responseStatusCode,
      headers: {
        "Content-Type": "text/plain",
      },
      body: isSuccessful ? "" : "Internal Server Error",
      is_body_truncated: false,
    },
    duration_ms: 30 + callbackOutcome.attempt * 17,
    error_message: isSuccessful
      ? null
      : `Callback URL answered ${callbackOutcome.responseStatusCode}`,
    created_at: statusChange.at,
  };
}
