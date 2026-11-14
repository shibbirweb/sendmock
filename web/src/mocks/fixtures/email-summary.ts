import type { EmailDetail, EmailSummary } from "@/lib/api/types";

/** The email as lists and `email.received` events carry it, as the server sends it. */
export function toEmailSummary(email: EmailDetail): EmailSummary {
  return {
    id: email.id,
    received_at: email.received_at,
    from: email.from,
    to: email.to,
    subject: email.subject,
    snippet: email.snippet,
    size_bytes: email.size_bytes,
    attachment_count: email.attachment_count,
    is_read: email.is_read,
    tags: email.tags,
    source: email.source,
    delivery_status: email.delivery_status,
    open_count: email.open_count,
    has_otp: email.has_otp,
    direction: email.direction,
    response_kind: email.response_kind,
    project: email.project,
  };
}
