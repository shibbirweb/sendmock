import { faker } from "@faker-js/faker";

import type {
  EmailAddress,
  EmailAttachment,
  EmailDeliveryStatus,
  EmailDetail,
  EmailSource,
  EmailTemplateData,
  EmailTimelineEntry,
} from "@/lib/api/types";
import {
  createMockUlid,
  extractFixtureData,
  minutesAgo,
  minutesAgoInMs,
} from "@/mocks/fixtures/fixture-helpers";

export type EmailFixtureSpec = {
  minutesAgo: number;
  from: EmailAddress;
  to: EmailAddress[];
  subject: string;
  textBody?: string | null;
  htmlBody?: string | null;
  source?: EmailSource;
  tags?: string[];
  isRead?: boolean;
  attachments?: Omit<
    EmailAttachment,
    "index" | "download_url" | "thumbnail_url"
  >[];
  deliveryStatus?: EmailDeliveryStatus | null;
  template?: EmailTemplateData | null;
  openCount?: number;
};

export type EmailFixture = {
  email: EmailDetail;
  timeline: EmailTimelineEntry[];
};

function stripHtml(htmlBody: string): string {
  return htmlBody
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildAttachments(
  emailId: string,
  attachmentSpecs: EmailFixtureSpec["attachments"] = [],
): EmailAttachment[] {
  return attachmentSpecs.map((attachmentSpec, attachmentIndex) => ({
    ...attachmentSpec,
    index: attachmentIndex,
    download_url: `/api/v1/emails/${emailId}/attachments/${attachmentIndex}`,
    thumbnail_url: attachmentSpec.content_type.startsWith("image/")
      ? `/api/v1/emails/${emailId}/parts/${attachmentIndex}/thumbnail`
      : null,
  }));
}

function buildTimeline(
  emailSpec: EmailFixtureSpec,
  receivedAt: string,
): EmailTimelineEntry[] {
  const timeline: EmailTimelineEntry[] = [
    {
      kind: "received",
      at: receivedAt,
      detail: `Received via ${emailSpec.source ?? "smtp"}`,
    },
  ];

  if (emailSpec.deliveryStatus) {
    timeline.push({
      kind: emailSpec.deliveryStatus,
      at: minutesAgo(Math.max(emailSpec.minutesAgo - 1, 0)),
      detail: `Simulated ${emailSpec.deliveryStatus}`,
    });
  }

  if ((emailSpec.openCount ?? 0) > 0) {
    timeline.push({
      kind: "opened",
      at: minutesAgo(Math.max(emailSpec.minutesAgo - 2, 0)),
      detail: `Opened ${emailSpec.openCount} time(s)`,
    });
  }

  return timeline;
}

/** Turns a short spec into a complete EmailDetail plus its timeline. */
export function buildEmailFixture(emailSpec: EmailFixtureSpec): EmailFixture {
  const emailId = createMockUlid(minutesAgoInMs(emailSpec.minutesAgo));
  const receivedAt = minutesAgo(emailSpec.minutesAgo);
  const htmlBody = emailSpec.htmlBody ?? null;
  const textBody =
    emailSpec.textBody === undefined && htmlBody !== null
      ? stripHtml(htmlBody)
      : (emailSpec.textBody ?? null);
  const searchableText = `${textBody ?? ""} ${htmlBody ?? ""}`;
  const extracted = extractFixtureData(searchableText);
  const attachments = buildAttachments(emailId, emailSpec.attachments);
  const openCount = emailSpec.openCount ?? 0;

  const email: EmailDetail = {
    id: emailId,
    received_at: receivedAt,
    message_id: `<${faker.string.alphanumeric(16)}@${emailSpec.from.address.split("@")[1] ?? "app.test"}>`,
    from: emailSpec.from,
    to: emailSpec.to,
    cc: [],
    bcc: [],
    reply_to: [],
    envelope_from: emailSpec.from.address,
    envelope_to: emailSpec.to.map((recipient) => recipient.address),
    subject: emailSpec.subject,
    snippet: (textBody ?? "").slice(0, 200),
    size_bytes:
      searchableText.length +
      attachments.reduce(
        (totalSize, attachment) => totalSize + attachment.size_bytes,
        0,
      ),
    attachment_count: attachments.length,
    is_read: emailSpec.isRead ?? false,
    tags: emailSpec.tags ?? [],
    source: emailSpec.source ?? "smtp",
    delivery_status: emailSpec.deliveryStatus ?? null,
    open_count: openCount,
    has_otp: extracted.otp.length > 0,
    headers: {
      From: [`${emailSpec.from.name} <${emailSpec.from.address}>`],
      To: emailSpec.to.map((recipient) => recipient.address),
      Subject: [emailSpec.subject],
      Date: [new Date(receivedAt).toUTCString()],
      "MIME-Version": ["1.0"],
    },
    text_body: textBody,
    html_body: htmlBody,
    attachments,
    extracted,
    opened_at:
      openCount > 0 ? minutesAgo(Math.max(emailSpec.minutesAgo - 2, 0)) : null,
    smtp_session_id:
      emailSpec.source === "smtp" || emailSpec.source === undefined
        ? createMockUlid(minutesAgoInMs(emailSpec.minutesAgo))
        : null,
    smtp_auth_user: null,
    template: emailSpec.template ?? null,
  };

  return { email, timeline: buildTimeline(emailSpec, receivedAt) };
}

/** Random everyday emails, used to fill lists and the large data set. */
export function generateRandomEmailSpecs(
  emailCount: number,
): EmailFixtureSpec[] {
  return Array.from({ length: emailCount }, (_, emailIndex) => {
    const senderName = faker.company.name();
    const recipientName = faker.person.fullName();

    return {
      minutesAgo: 90 + emailIndex * 37,
      from: {
        name: senderName,
        address: `no-reply@${faker.internet.domainWord()}.test`,
      },
      to: [
        {
          name: recipientName,
          address: faker.internet
            .email({ provider: "example.com" })
            .toLowerCase(),
        },
      ],
      subject: faker.helpers.arrayElement([
        `Your ${faker.commerce.product()} order has shipped`,
        `Weekly digest: ${faker.company.catchPhrase()}`,
        `Invitation: ${faker.company.buzzPhrase()}`,
        `Receipt #${faker.string.numeric(6)}`,
      ]),
      textBody: faker.lorem.paragraphs(2),
      isRead: faker.datatype.boolean({ probability: 0.7 }),
    };
  });
}
