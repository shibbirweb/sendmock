import { describe, expect, test } from "vitest";

import {
  canSendResponse,
  listDefaultReplyRecipients,
} from "@/features/mail/detail/response/email-composer-mode";
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
  toRecipients: ["support@shop.test"],
  ccRecipients: [],
  subject: "Re: Your receipt",
};

describe("canSendResponse", () => {
  test("EM-22.1 a reply can be sent as prefilled and a forward needs an address", () => {
    expect(canSendResponse("reply", formValues)).toBe(true);
    expect(canSendResponse("reply_all", formValues)).toBe(true);
    expect(canSendResponse("forward", formValues)).toBe(false);
    expect(
      canSendResponse("forward", {
        ...formValues,
        forwardToAddress: "support@inbound.app.test",
      }),
    ).toBe(true);
  });

  test("EM-17.7 a reply needs a To and only addresses in To and Cc", () => {
    expect(canSendResponse("reply", { ...formValues, toRecipients: [] })).toBe(
      false,
    );
    expect(
      canSendResponse("reply", { ...formValues, ccRecipients: ["ops"] }),
    ).toBe(false);
    expect(
      canSendResponse("reply", {
        ...formValues,
        toRecipients: ['"Pat Lee, Jr" <pat@example.test>', "ann@example.test"],
      }),
    ).toBe(true);
  });
});

describe("listDefaultReplyRecipients", () => {
  test("EM-22.3 a reply starts at the Reply-To, and reply all copies the others but not the sender", () => {
    expect(listDefaultReplyRecipients(originalEmail, "reply")).toEqual({
      toRecipients: ["support@shop.test"],
      ccRecipients: [],
    });
    expect(
      listDefaultReplyRecipients(originalEmail, "reply_all").ccRecipients,
    ).toEqual(["lee@example.test", "kim@example.test"]);
  });
});

describe("buildIncomingEmailPreview", () => {
  test("EM-22.3 a reply arrives at its To with the subject and sender", () => {
    expect(buildIncomingEmailPreview("reply", formValues)).toEqual({
      to: ["support@shop.test"],
      cc: [],
      headers: { subject: "Re: Your receipt", from: "Sam <sam@example.test>" },
    });
  });

  test("EM-17.7 the preview follows the edited To and Cc and skips what is not an address", () => {
    expect(
      buildIncomingEmailPreview("reply_all", {
        ...formValues,
        toRecipients: ['"Pat Lee, Jr" <pat@example.test>', "draft"],
        ccRecipients: ["ops@shop.test"],
      }),
    ).toMatchObject({ to: ["pat@example.test"], cc: ["ops@shop.test"] });
  });

  test("EM-22.3 a forward goes to its To address once it has one, case kept for captured groups", () => {
    expect(buildIncomingEmailPreview("forward", formValues).to).toEqual([]);
    expect(
      buildIncomingEmailPreview("forward", {
        ...formValues,
        forwardToAddress: "Help <Help@Inbound.app.test>",
      }).to,
    ).toEqual(["Help@Inbound.app.test"]);
  });
});
