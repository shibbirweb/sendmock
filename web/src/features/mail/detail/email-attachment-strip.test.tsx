import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { EmailAttachmentStrip } from "@/features/mail/detail/email-attachment-strip";
import type { EmailAttachment } from "@/lib/api/types";

const invoiceAttachment: EmailAttachment = {
  index: 0,
  filename: "invoice.pdf",
  content_type: "application/pdf",
  size_bytes: 2048,
  content_id: null,
  is_inline: false,
  download_url: "/api/v1/emails/01JEMAIL/attachments/0",
  thumbnail_url: null,
};

const logoAttachment: EmailAttachment = {
  index: 1,
  filename: "logo.png",
  content_type: "image/png",
  size_bytes: 512,
  content_id: "logo",
  is_inline: true,
  download_url: "/api/v1/emails/01JEMAIL/attachments/1",
  thumbnail_url: "/api/v1/emails/01JEMAIL/attachments/1/thumbnail",
};

describe("EmailAttachmentStrip", () => {
  test("EM-04.9 lists every attachment under the message with a download link", () => {
    render(
      <EmailAttachmentStrip
        attachments={[invoiceAttachment, logoAttachment]}
      />,
    );
    const attachmentList = screen.getByRole("region", { name: "Attachments" });

    expect(attachmentList).toHaveTextContent("2 attachments");
    const invoiceLink = within(attachmentList).getByRole("link", {
      name: "Download invoice.pdf",
    });
    expect(invoiceLink).toHaveAttribute("download", "invoice.pdf");
    expect(invoiceLink.getAttribute("href")).toContain(
      "/emails/01JEMAIL/attachments/0",
    );
    expect(
      within(attachmentList).getByRole("link", { name: "Download logo.png" }),
    ).toHaveTextContent("inline");
  });

  test("EM-04.9 shows nothing for an email without attachments", () => {
    const { container } = render(<EmailAttachmentStrip attachments={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
