import { describe, expect, test } from "vitest";

import { buildExactAddressPattern } from "@/lib/inbound-routes/escape-route-pattern";
import { matchRouteFilter } from "@/lib/inbound-routes/match-route-filter";

function matchesRecipient(pattern: string, recipient: string): boolean {
  return matchRouteFilter(
    { kind: "match_recipient", pattern },
    { recipients: [recipient], headers: {} },
  ).isMatch;
}

describe("buildExactAddressPattern", () => {
  test("EM-22.4 takes the address itself and nothing like it", () => {
    const pattern = buildExactAddressPattern(" reply+42@reply.app.test ");

    expect(pattern).toBe("^reply\\+42@reply\\.app\\.test$");
    expect(matchesRecipient(pattern, "reply+42@reply.app.test")).toBe(true);
    expect(matchesRecipient(pattern, "replyy42@reply.app.test")).toBe(false);
    expect(matchesRecipient(pattern, "reply+42@reply-app.test")).toBe(false);
    expect(matchesRecipient(pattern, "reply+42@reply.app.test.evil")).toBe(
      false,
    );
  });
});
