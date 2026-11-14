import { describe, expect, test } from "vitest";

import { listWebhookTargets } from "@/features/webhooks/targets/list-webhook-targets";
import {
  matchesSearch,
  readChosenEndpointIds,
} from "@/features/webhooks/targets/webhook-endpoint-choice";
import type { WebhookEndpoint, WebhookRuleMatchResult } from "@/lib/api/types";

function buildEndpoint(
  endpointId: string,
  endpointName: string,
  isEnabled = true,
): WebhookEndpoint {
  return {
    id: endpointId,
    name: endpointName,
    url: `http://localhost:3000/${endpointId}`,
    is_enabled: isEnabled,
  } as WebhookEndpoint;
}

const webhookEndpoints = [
  buildEndpoint("receipts", "Receipts"),
  buildEndpoint("audit", "Audit log"),
  buildEndpoint("paused", "Paused app", false),
];

const matchResult: WebhookRuleMatchResult = {
  webhook_rules: ["first", "second"].map((ruleId) => ({
    rule_id: ruleId,
    rule_name: `Rule ${ruleId}`,
    endpoint_id: "receipts",
    endpoint_name: "Receipts",
    endpoint_url: "http://localhost:3000/receipts",
  })),
};

describe("listWebhookTargets", () => {
  test("WH-13.2 names each matched endpoint once, in rule order", () => {
    expect(
      listWebhookTargets({
        matchResult,
        chosenEndpointIds: null,
        webhookEndpoints,
      }),
    ).toEqual([
      {
        endpointId: "receipts",
        endpointName: "Receipts",
        endpointUrl: "http://localhost:3000/receipts",
      },
    ]);
  });

  test("WH-13.4 a choice replaces the matches, and none chosen names none", () => {
    expect(
      listWebhookTargets({
        matchResult,
        chosenEndpointIds: ["audit", "deleted"],
        webhookEndpoints,
      }).map((webhookTarget) => webhookTarget.endpointName),
    ).toEqual(["Audit log"]);
    expect(
      listWebhookTargets({
        matchResult,
        chosenEndpointIds: [],
        webhookEndpoints,
      }),
    ).toEqual([]);
  });
});

describe("the webhook picker", () => {
  test("WH-13.4 hands the action the checked enabled endpoints in list order", () => {
    expect(
      readChosenEndpointIds(webhookEndpoints, ["paused", "audit", "receipts"]),
    ).toEqual(["receipts", "audit"]);
  });

  test("WH-13.4 searches endpoints by name or URL", () => {
    const [receiptsEndpoint] = webhookEndpoints;
    if (receiptsEndpoint === undefined) {
      throw new Error("The test needs an endpoint.");
    }

    expect(matchesSearch(receiptsEndpoint, "RECEI")).toBe(true);
    expect(matchesSearch(receiptsEndpoint, "localhost:3000/rec")).toBe(true);
    expect(matchesSearch(receiptsEndpoint, "audit")).toBe(false);
    expect(matchesSearch(receiptsEndpoint, "  ")).toBe(true);
  });
});
