import { describe, expect, test } from "vitest";

import { buildEmailFixture } from "@/mocks/fixtures/email-fixture-builder";
import {
  buildEmailForwardFields,
  findReceivingAddress,
  findReceivingDomain,
} from "@/mocks/webhooks/email-forward-fields";

function buildInboundEmail(recipientAddresses: string[]) {
  return buildEmailFixture({
    minutesAgo: 1,
    from: { name: "Sam", address: "sam@example.test" },
    to: recipientAddresses.map((recipientAddress) => ({
      name: "",
      address: recipientAddress,
    })),
    subject: "Re: Ticket",
    textBody: "Hi",
  }).email;
}

describe("the mock inbound message-url", () => {
  test("EM-26.6 names the domain that received the email", () => {
    const inboundEmail = buildInboundEmail([
      "support@mg.shop.test",
      "sam@other.test",
    ]);

    expect(findReceivingDomain(inboundEmail)).toBe("mg.shop.test");
    expect(buildEmailForwardFields(inboundEmail).message_url).toBe(
      `http://127.0.0.1:8026/v3/domains/mg.shop.test/messages/${inboundEmail.id}`,
    );
  });

  test("EM-26.6 falls back to inbound when no recipient has a domain", () => {
    const inboundEmail = buildInboundEmail([]);

    expect(findReceivingDomain(inboundEmail)).toBe("inbound");
  });
});

describe("the mock inbound recipient", () => {
  test("EM-25.7 skips a To entry without an address", () => {
    const inboundEmail = buildInboundEmail(["", "office@example.test"]);

    expect(findReceivingAddress(inboundEmail)).toBe("office@example.test");
    expect(buildEmailForwardFields(inboundEmail).recipient).toBe(
      "office@example.test",
    );
  });

  test("EM-25.7 is empty when no recipient has an address", () => {
    expect(findReceivingAddress(buildInboundEmail([]))).toBe("");
  });
});
