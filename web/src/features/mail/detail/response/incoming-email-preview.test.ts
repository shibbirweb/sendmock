import { describe, expect, test } from "vitest";

import { canSendResponse } from "@/features/mail/detail/response/email-composer-mode";
import { buildIncomingEmailPreview } from "@/features/mail/detail/response/incoming-email-preview";
import type { EmailDetail } from "@/lib/api/types";

const originalEmail = {
  from: { name: "Shop", address: "shop@example.test" },
  reply_to: [{ name: "", address: "support@shop.test" }],
  to: [
    { name: "Sam", address: "sam@example.test" },
    { name: "", address: "lee@example.test" },
  ],
  cc: [{ name: "", address: "kim@example.test" }],
} as EmailDetail;

const formValues = {
  fromAddress: "Sam <sam@example.test>",
  forwardToAddress: "",
  subject: "Re: Your receipt",
};

describe("canSendResponse", () => {
  test("EM-22.1 a reply can always be sent and a forward needs an address", () => {
    expect(canSendResponse("reply", "")).toBe(true);
    expect(canSendResponse("reply_all", "")).toBe(true);
    expect(canSendResponse("forward", "")).toBe(false);
    expect(canSendResponse("forward", "support@inbound.app.test")).toBe(true);
  });
});

describe("buildIncomingEmailPreview", () => {
  test("EM-22.3 a reply arrives at the Reply-To with the subject and sender", () => {
    expect(
      buildIncomingEmailPreview(originalEmail, "reply", formValues),
    ).toEqual({
      to: ["support@shop.test"],
      cc: [],
      headers: { subject: "Re: Your receipt", from: "Sam <sam@example.test>" },
    });
  });

  test("EM-22.3 reply all copies the other recipients but not the sender", () => {
    expect(
      buildIncomingEmailPreview(originalEmail, "reply_all", formValues).cc,
    ).toEqual(["lee@example.test", "kim@example.test"]);
  });

  test("EM-22.3 a forward goes to its To address once it has one, case kept for captured groups", () => {
    expect(
      buildIncomingEmailPreview(originalEmail, "forward", formValues).to,
    ).toEqual([]);
    expect(
      buildIncomingEmailPreview(originalEmail, "forward", {
        ...formValues,
        forwardToAddress: "Help <Help@Inbound.app.test>",
      }).to,
    ).toEqual(["Help@Inbound.app.test"]);
  });
});
