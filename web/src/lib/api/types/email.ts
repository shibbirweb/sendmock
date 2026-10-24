import type {
  EmailAddress,
  ExtractedData,
  IsoTimestamp,
  PageRequest,
  Ulid,
} from "@/lib/api/types/common";

/** How the message reached MessageHook. */
export type EmailSource =
  | "smtp"
  | "sendmail"
  | "native_api"
  | "sendgrid"
  | "mailgun"
  | "postmark"
  | "resend"
  | "ses"
  | "brevo"
  | "verify";

/** Simulated delivery outcome, null when no outcome was simulated. */
export type EmailDeliveryStatus =
  "delivered" | "deferred" | "bounced" | "complained" | "unsubscribed";

export type EmailAttachment = {
  index: number;
  filename: string;
  content_type: string;
  size_bytes: number;
  content_id: string | null;
  is_inline: boolean;
  download_url: string;
  thumbnail_url: string | null;
};

/** Fields shown in the mail list. */
export type EmailSummary = {
  id: Ulid;
  received_at: IsoTimestamp;
  from: EmailAddress;
  to: EmailAddress[];
  subject: string;
  snippet: string;
  size_bytes: number;
  attachment_count: number;
  is_read: boolean;
  tags: string[];
  source: EmailSource;
  delivery_status: EmailDeliveryStatus | null;
  open_count: number;
  has_otp: boolean;
};

export type EmailTemplateData = {
  template_id: string;
  template_data: Record<string, unknown>;
};

export type EmailDetail = EmailSummary & {
  message_id: string | null;
  cc: EmailAddress[];
  bcc: EmailAddress[];
  reply_to: EmailAddress[];
  envelope_from: string;
  envelope_to: string[];
  headers: Record<string, string[]>;
  text_body: string | null;
  html_body: string | null;
  attachments: EmailAttachment[];
  extracted: ExtractedData;
  opened_at: IsoTimestamp | null;
  smtp_session_id: Ulid | null;
  smtp_auth_user: string | null;
  template: EmailTemplateData | null;
};

export type EmailTimelineKind =
  | "received"
  | "opened"
  | "delivered"
  | "deferred"
  | "bounced"
  | "complained"
  | "unsubscribed"
  | "released"
  | "forwarded"
  | "webhook_sent";

export type EmailTimelineEntry = {
  kind: EmailTimelineKind;
  at: IsoTimestamp;
  detail: string;
};

export type MimePart = {
  part_id: string;
  content_type: string;
  transfer_encoding: string | null;
  charset: string | null;
  size_bytes: number;
  filename: string | null;
  content_id: string | null;
  children: MimePart[];
};

export type EmailListFilters = PageRequest & {
  query?: string;
  from?: string;
  to?: string;
  tag?: string;
  is_unread?: boolean;
  has_attachment?: boolean;
  source?: EmailSource;
};

export type EmailUpdate = {
  is_read?: boolean;
  tags?: string[];
};

export type SimulatedEmailOutcome = {
  event: EmailDeliveryStatus;
  bounce_type?: "hard" | "soft";
};

/** Body of POST /api/v1/send (native HTTP send API). */
export type NativeSendRequest = {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
  tags?: string[];
};
