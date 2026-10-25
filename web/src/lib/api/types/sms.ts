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
  media_urls: string[];
  status: SmsStatus;
  error_code: string | null;
  status_callback_url: string | null;
  messaging_service_sid: string | null;
  account: string | null;
  extracted: ExtractedData;
  opened_at: IsoTimestamp | null;
  open_count: number;
  created_at: IsoTimestamp;
  updated_at: IsoTimestamp;
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
};

/** Body of POST /api/v1/sms/inbound (simulate an incoming message). */
export type InboundSmsRequest = {
  from: string;
  to: string;
  body: string;
  channel?: SmsChannel;
  template_id?: string;
};
