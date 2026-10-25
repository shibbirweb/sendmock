import type {
  EmailAddress,
  ExtractedData,
  IsoTimestamp,
  PageRequest,
  Ulid,
} from "@/lib/api/types/common";

/** How the message reached SendMock. */
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
  | "verify"
  | "simulated";

/** `outbound`: mail your app sent; `inbound`: mail coming in to your app. */
export type EmailDirection = "outbound" | "inbound";

/** How the recipient answered an email your app sent. */
export type EmailResponseKind = "reply" | "forward";

/** Points from an original email to a reply or forward, or back. */
export type EmailResponseLink = {
  kind: EmailResponseKind;
  email_id: Ulid;
  subject: string;
  from: EmailAddress;
  received_at: IsoTimestamp;
};

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
  direction: EmailDirection;
  /** Set on inbound emails made by Reply or Forward, for the list icon. */
  response_kind: EmailResponseKind | null;
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
  /** On a reply or forward: the original email it answers. */
  response_to: EmailResponseLink | null;
  /** On an original: the replies and forwards made from it, oldest first. */
  responses: EmailResponseLink[];
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
  | "replied"
  | "forwarded_by_recipient"
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
  direction?: EmailDirection;
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

/** Body of POST /api/v1/emails/{emailId}/reply (simulate the recipient replying). */
export type EmailReplyRequest = {
  body: string;
  from?: string;
  subject?: string;
  reply_all?: boolean;
  include_original?: boolean;
};

/** Body of POST /api/v1/emails/{emailId}/forward (simulate the recipient forwarding). */
export type EmailForwardRequest = {
  to: string;
  body?: string;
  from?: string;
  subject?: string;
  include_original?: boolean;
  include_attachments?: boolean;
};
