import type {
  ExtractedData,
  IsoTimestamp,
  PageRequest,
  Ulid,
} from "@/lib/api/types/common";
import type {
  RecordedHttpRequest,
  RecordedHttpResponse,
} from "@/lib/api/types/webhooks";

export type SmsDirection = "outbound" | "inbound";
export type SmsChannel = "sms" | "whatsapp";
export type SmsApi =
  "native" | "twilio" | "vonage" | "plivo" | "messagebird" | "generic";
export type SmsEncoding = "GSM-7" | "UCS-2";
export type SmsStatus =
  "queued" | "sent" | "delivered" | "undelivered" | "failed" | "received";

/** One MMS or WhatsApp media file stored with a message. */
export type SmsMedia = {
  media_index: number;
  content_type: string;
  size_bytes: number | null;
  filename: string | null;
  /** Where the app said to fetch it (`MediaUrl`), null for inline files. */
  source_url: string | null;
  /** SendMock's copy: `/api/v1/sms/{smsId}/media/{mediaIndex}`. */
  url: string;
};

/** An inline file in `media` of a native or simulated inbound send. */
export type InlineSmsMedia = {
  filename: string;
  /** The file bytes, base64 encoded. */
  content: string;
  /** Guessed from the file extension when missing. */
  content_type?: string;
};

export type SmsStatusChange = {
  status: SmsStatus;
  at: IsoTimestamp;
  error_code: string | null;
};

export type SmsMessage = {
  id: Ulid;
  provider_id: string;
  direction: SmsDirection;
  channel: SmsChannel;
  api: SmsApi;
  from_number: string;
  to_number: string;
  body: string;
  encoding: SmsEncoding;
  segments: number;
  media: SmsMedia[];
  status: SmsStatus;
  error_code: string | null;
  status_callback_url: string | null;
  messaging_service_sid: string | null;
  account: string | null;
  extracted: ExtractedData;
  opened_at: IsoTimestamp | null;
  open_count: number;
  /** Inbound only: what the number's reply webhook answered; null when it has none. */
  reply_webhook: SmsReplyWebhookResult | null;
  /** A TwiML reply: the inbound message it answers. */
  in_reply_to_sms_id: Ulid | null;
  created_at: IsoTimestamp;
  updated_at: IsoTimestamp;
};

/** A verb of the TwiML an app answered with (SM-09.7). */
export type TwimlVerb =
  | {
      verb: "Message";
      body: string;
      to: string | null;
      from: string | null;
      status_callback: string | null;
      media_urls: string[];
    }
  | { verb: "Redirect"; url: string };

/** The outcome of an inbound message's reply webhook, for the bubble (SM-09.7). */
export type SmsReplyWebhookResult = {
  /** A Messaging Service set to "Send a webhook", or the number's own URL. */
  target: "messaging_service" | "number";
  outcome: "succeeded" | "failed";
  /** Of the last attempt. */
  status_code: number | null;
  /** Twilio's code for the primary URL's failure, e.g. "11205". */
  error_code: string | null;
  /** The primary failed and the fallback URL answered. */
  used_fallback: boolean;
  /** Messages created from the TwiML. */
  reply_count: number;
};

/** One call to a reply webhook URL, primary or fallback. */
export type SmsReplyWebhookAttempt = {
  id: Ulid;
  is_fallback: boolean;
  request: RecordedHttpRequest;
  response: RecordedHttpResponse | null;
  duration_ms: number | null;
  error_code: string | null;
  error_message: string | null;
  twiml: TwimlVerb[];
  created_at: IsoTimestamp;
};

/** One call to the message's status callback URL, in the provider's format. */
export type SmsCallbackAttempt = {
  id: Ulid;
  reported_status: SmsStatus;
  attempt: number;
  request: RecordedHttpRequest;
  response: RecordedHttpResponse | null;
  duration_ms: number | null;
  error_message: string | null;
  created_at: IsoTimestamp;
};

export type SmsMessageDetail = SmsMessage & {
  status_history: SmsStatusChange[];
  request_body: Record<string, unknown> | null;
  api_request_id: Ulid | null;
  callback_attempts: SmsCallbackAttempt[];
  /** Inbound only, oldest first; every Resend adds attempts. */
  reply_webhook_attempts: SmsReplyWebhookAttempt[];
};

/** A conversation between two numbers. */
export type SmsThread = {
  thread_id: string;
  app_number: string;
  contact_number: string;
  channel: SmsChannel;
  last_message: SmsMessage;
  message_count: number;
  unread_count: number;
};

export type SmsListFilters = PageRequest & {
  query?: string;
  from?: string;
  to?: string;
  status?: SmsStatus;
  direction?: SmsDirection;
  thread_id?: string;
};

/** Body of POST /api/v1/sms (native send). */
export type NativeSmsRequest = {
  from: string;
  to: string;
  body: string;
  status_callback?: string;
  metadata?: Record<string, unknown>;
  /** Public links SendMock downloads, like Twilio's `MediaUrl`. */
  media_urls?: string[];
  media?: InlineSmsMedia[];
};

/** Body of POST /api/v1/sms/inbound (simulate an incoming message). */
export type InboundSmsRequest = {
  from: string;
  to: string;
  body: string;
  channel?: SmsChannel;
  template_id?: string;
  media?: InlineSmsMedia[];
};

/** Body of `POST /sms/{smsId}/status`: a manual status change. */
export type SmsStatusUpdate = {
  status: SmsStatus;
  error_code?: string | null;
};
