import { describe, expect, test } from "vitest";

import {
  buildForwardedMessageBlock,
  formatEmailAddress,
  quoteOriginalEmail,
} from "@/lib/email/build-response-text";

const originalEmail = {
  from: { name: "Acme App", address: "no-reply@acme.test" },
  to: [{ name: "", address: "rahim@example.com" }],
  subject: "Reset your password",
  received_at: "2026-10-25T10:00:00.000Z",
  text_body: "Hi Rahim,\nClick the link to reset.",
  snippet: "Hi Rahim,",
};

describe("formatEmailAddress", () => {
  test("shows the name when there is one", () => {
    expect(formatEmailAddress(originalEmail.from)).toBe(
      "Acme App <no-reply@acme.test>",
    );
    expect(formatEmailAddress(originalEmail.to[0]!)).toBe("rahim@example.com");
  });
});

describe("quoteOriginalEmail", () => {
  test("EM-17.1 quotes every line below an On ... wrote: line", () => {
    expect(quoteOriginalEmail(originalEmail)).toBe(
      [
        "On Sun, 25 Oct 2026 10:00:00 GMT, Acme App <no-reply@acme.test> wrote:",
        "> Hi Rahim,",
        "> Click the link to reset.",
      ].join("\n"),
    );
  });

  test("falls back to the snippet when there is no text part", () => {
    expect(quoteOriginalEmail({ ...originalEmail, text_body: null })).toContain(
      "> Hi Rahim,",
    );
  });
});

describe("buildForwardedMessageBlock", () => {
  test("EM-17.4 lists the original From, Date, Subject and To above its text", () => {
    expect(buildForwardedMessageBlock(originalEmail)).toBe(
      [
        "---------- Forwarded message ---------",
        "From: Acme App <no-reply@acme.test>",
        "Date: Sun, 25 Oct 2026 10:00:00 GMT",
        "Subject: Reset your password",
        "To: rahim@example.com",
        "",
        "Hi Rahim,",
        "Click the link to reset.",
      ].join("\n"),
    );
  });
});
