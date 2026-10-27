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
/**
 * The API a message was sent through: `native`, or the key of the SMS provider
 * (`twilio`, or a custom provider's key; docs/plan/22).
 * @example "twilio"
 */
export type SmsApi = string;
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
  /**
   * The file name, e.g. `photo.jpg`.
   * @example "photo.jpg"
   */
  filename: string;
  /**
   * The file bytes, base64 encoded.
   * @example "/9j/4AAQSkZJRgABAQ"
   */
  content: string;
  /**
   * Guessed from the file extension when missing.
   * @example "image/jpeg"
   */
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
  /**
   * The sender: an E.164 number or an alphanumeric sender ID.
   * @example "+15550001111"
   */
  from: string;
  /**
   * The recipient, an E.164 number; `whatsapp:+...` sends over WhatsApp.
   * @example "+8801700000000"
   */
  to: string;
  /**
   * The message text. Its length and characters decide the segments and the encoding (GSM-7 or UCS-2).
   * @example "Your code is 482913"
   */
  body: string;
  /**
   * Your app's URL that receives each status change (queued, sent, delivered, failed).
   * @example "http://localhost:3000/sms/status"
   */
  status_callback?: string;
  /**
   * Any JSON you want stored with the message and echoed in its events.
   * @example {"user_id": 42}
   */
  metadata?: Record<string, unknown>;
  /**
   * Public links SendMock downloads, like Twilio's `MediaUrl`.
   * @example ["https://example.test/receipt.png"]
   */
  media_urls?: string[];
  /**
   * Files sent inline as MMS media, base64 encoded.
   */
  media?: InlineSmsMedia[];
};

/** Body of POST /api/v1/sms/inbound (simulate an incoming message). */
export type InboundSmsRequest = {
  /**
   * Who texts your app: the user's number.
   * @example "+8801700000000"
   */
  from: string;
  /**
   * Your app's number that receives it, usually a virtual number.
   * @example "+15550001111"
   */
  to: string;
  /**
   * The message text.
   * @example "STOP"
   */
  body: string;
  /**
   * `sms` (default) or `whatsapp`.
   * @example "sms"
   */
  channel?: SmsChannel;
  /**
   * The payload template for the inbound webhook, instead of the number's (e.g. `twilio.inbound_sms`).
   * @example "twilio.inbound_sms"
   */
  template_id?: string;
  /**
   * Files sent with the message, as MMS or WhatsApp media.
   */
  media?: InlineSmsMedia[];
};

/** Body of `POST /sms/{smsId}/status`: a manual status change. */
export type SmsStatusUpdate = {
  /**
   * The new status; fires the status callback and the matching event.
   * @example "delivered"
   */
  status: SmsStatus;
  /**
   * A Twilio error code for `failed` or `undelivered`, e.g. `30003` (unreachable).
   * @example "30003"
   */
  error_code?: string | null;
};
