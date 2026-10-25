import type { SmsApi, SmsStatus } from "@/lib/api/types";

/** Short names for the API a message was sent through. */
export const smsApiLabels: Record<SmsApi, string> = {
  native: "Native",
  twilio: "Twilio",
  vonage: "Vonage",
  plivo: "Plivo",
  messagebird: "MessageBird",
  generic: "Generic",
};

/** Status names, plus "read" for delivered messages that fired `sms.opened`. */
export const smsStatusLabels: Record<SmsStatus | "read", string> = {
  queued: "Queued",
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
  undelivered: "Undelivered",
  failed: "Failed",
  received: "Received",
};

/** Twilio's descriptions for the delivery error codes SendMock simulates. */
const twilioErrorDescriptions: Record<string, string> = {
  "21211": "Invalid 'To' phone number",
  "21408": "Permission to send an SMS has not been enabled for the region",
  "21610": "Attempt to send to unsubscribed recipient",
  "21612": "The 'To' phone number is not currently reachable via SMS",
  "21614": "'To' number is not a valid mobile number",
  "30001": "Queue overflow",
  "30002": "Account suspended",
  "30003": "Unreachable destination handset",
  "30004": "Message blocked",
  "30005": "Unknown destination handset",
  "30006": "Landline or unreachable carrier",
  "30007": "Message filtered",
  "30008": "Unknown error",
};

/** "30003 Unreachable destination handset", or just the code when unknown. */
export function describeSmsErrorCode(errorCode: string): string {
  const errorDescription = twilioErrorDescriptions[errorCode] ?? null;

  return errorDescription === null
    ? `Error ${errorCode}`
    : `${errorCode} ${errorDescription}`;
}
