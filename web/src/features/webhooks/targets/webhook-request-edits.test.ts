import { describe, expect, test } from "vitest";

import {
  findRequestEdit,
  replaceRequestEdit,
  toWebhookChoice,
} from "@/features/webhooks/targets/webhook-request-edits";
import type { WebhookRequestEdit } from "@/lib/api/types";

function buildEdit(endpointId: string, body: string): WebhookRequestEdit {
  return { endpoint_id: endpointId, event_type: "email.bounced", body };
}

describe("replaceRequestEdit", () => {
  test("WH-14.3 keeps one edit per endpoint and Reset removes it", () => {
    const firstEdits = replaceRequestEdit(
      [],
      "receipts",
      buildEdit("receipts", "first"),
    );
    const secondEdits = replaceRequestEdit(
      firstEdits,
      "receipts",
      buildEdit("receipts", "second"),
    );
    const resetEdits = replaceRequestEdit(secondEdits, "receipts", null);

    expect(secondEdits).toEqual([buildEdit("receipts", "second")]);
    expect(findRequestEdit(secondEdits, "receipts")?.body).toBe("second");
    expect(resetEdits).toEqual([]);
  });
});

describe("toWebhookChoice", () => {
  test("WH-14.4 sends the edits of the endpoints the action sends to", () => {
    const webhookChoice = toWebhookChoice({
      chosenEndpointIds: ["receipts"],
      targetEndpointIds: ["receipts"],
      requestEdits: [
        buildEdit("receipts", "edited"),
        buildEdit("audit", "stale"),
      ],
    });

    expect(webhookChoice).toEqual({
      webhook_endpoint_ids: ["receipts"],
      webhook_requests: [buildEdit("receipts", "edited")],
    });
  });

  test("WH-14.4 leaves both fields out while the rules decide and nothing is edited", () => {
    expect(
      toWebhookChoice({
        chosenEndpointIds: null,
        targetEndpointIds: ["receipts"],
        requestEdits: [],
      }),
    ).toEqual({});
  });

  test("WH-14.4 sends an edit of a rule match without choosing endpoints", () => {
    expect(
      toWebhookChoice({
        chosenEndpointIds: null,
        targetEndpointIds: ["receipts"],
        requestEdits: [buildEdit("receipts", "edited")],
      }),
    ).toEqual({ webhook_requests: [buildEdit("receipts", "edited")] });
  });
});
