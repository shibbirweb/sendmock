import { describe, expect, test } from "vitest";

import type { ProviderMessagePart } from "@/lib/api/types";
import { fillPartsFromRawMessage } from "@/mocks/providers/fill-raw-message-parts";

const rawMessage =
  'From: "Shop, Inc" <shop@example.test>\r\nTo: sam@example.test\r\nSubject: Raw\r\n from SES\r\n\r\nHello';

describe("fillPartsFromRawMessage", () => {
  test("EM-08.1 the raw message fills the parts the request leaves out", () => {
    const partValues = new Map<ProviderMessagePart, string[]>([
      ["raw", [btoa(rawMessage)]],
      ["to", ["ops@example.test"]],
      ["subject", []],
    ]);

    fillPartsFromRawMessage(partValues);

    expect(partValues.get("from")).toEqual(["shop@example.test"]);
    expect(partValues.get("to")).toEqual(["ops@example.test"]);
    expect(partValues.get("subject")).toEqual(["Raw from SES"]);
    expect(partValues.get("text")).toEqual(["Hello"]);
  });

  test("leaves the parts alone when the raw part is not base64", () => {
    const partValues = new Map<ProviderMessagePart, string[]>([
      ["raw", ["not base64!"]],
    ]);

    fillPartsFromRawMessage(partValues);

    expect(partValues.get("from")).toBeUndefined();
  });
});
