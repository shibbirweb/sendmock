import { describe, expect, test } from "vitest";

import {
  type RuleMessage,
  readMessageField,
} from "@/lib/webhooks/rule-filter/read-message-field";

describe("readMessageField", () => {
  const storedMessage: RuleMessage = {
    messageKind: "fields",
    fieldValues: { subject: ["Your receipt"], "header:X-Tenant": ["acme"] },
    storedMessage: null,
  };

  test("WH-13.1 given fields win over the stored message's, headers without case", () => {
    const givenFields: RuleMessage = {
      messageKind: "fields",
      fieldValues: { subject: ["Your invoice"], "header:X-Plan": ["pro"] },
      storedMessage,
    };

    expect(readMessageField(givenFields, "subject")).toEqual(["Your invoice"]);
    expect(readMessageField(givenFields, "header:x-plan")).toEqual(["pro"]);
    expect(readMessageField(givenFields, "header:x-tenant")).toEqual(["acme"]);
  });

  test("WH-13.1 a field neither given nor stored is missing", () => {
    const givenFields: RuleMessage = {
      messageKind: "fields",
      fieldValues: { to: ["sam@example.test"] },
      storedMessage: null,
    };

    expect(readMessageField(givenFields, "to")).toEqual(["sam@example.test"]);
    expect(readMessageField(givenFields, "subject")).toBeNull();
  });
});
