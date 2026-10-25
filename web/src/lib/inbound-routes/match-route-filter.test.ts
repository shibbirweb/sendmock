import { describe, expect, test } from "vitest";

import {
  fillCapturedGroups,
  findPatternError,
  matchRouteFilter,
} from "@/lib/inbound-routes/match-route-filter";
import {
  toActionExpression,
  toRouteExpression,
} from "@/lib/inbound-routes/route-expressions";

const ticketReply = {
  recipients: ["support@acme.test", "Reply+T-1042@reply.app.test"],
  headers: { Subject: ["Re: Your ticket #1042"] },
};

describe("inbound route filters", () => {
  test("WH-12.7 match_recipient checks each recipient from the start and captures named groups", () => {
    expect(
      matchRouteFilter(
        {
          kind: "match_recipient",
          pattern: "reply\\+(?P<token>[\\w-]+)@reply\\.app\\.test",
        },
        ticketReply,
      ),
    ).toEqual({
      isMatch: true,
      matchedValue: "Reply+T-1042@reply.app.test",
      capturedGroups: { token: "T-1042" },
    });
    expect(
      matchRouteFilter(
        { kind: "match_recipient", pattern: "acme\\.test" },
        ticketReply,
      ),
    ).toEqual({ isMatch: false });
  });

  test("WH-12.7 match_header reads the named header in any case; catch_all takes everything", () => {
    expect(
      matchRouteFilter(
        { kind: "match_header", header_name: "subject", pattern: ".*ticket" },
        ticketReply,
      ),
    ).toMatchObject({ isMatch: true, matchedValue: "Re: Your ticket #1042" });
    expect(matchRouteFilter({ kind: "catch_all" }, ticketReply)).toMatchObject({
      isMatch: true,
    });
  });

  test("WH-12.7 captured groups fill actions; bad patterns are named", () => {
    expect(
      fillCapturedGroups("http://localhost:8000/tickets/\\g<token>", {
        token: "T-1042",
      }),
    ).toBe("http://localhost:8000/tickets/T-1042");
    expect(findPatternError("reply+(")).toBe("Not a valid regular expression");
    expect(findPatternError("")).toBe("Enter a pattern");
  });

  test("WH-12.7 filters and actions are written in Mailgun syntax", () => {
    expect(
      toRouteExpression({
        kind: "match_recipient",
        pattern: "reply\\+(?P<token>.+)@reply.app.test",
      }),
    ).toBe('match_recipient("reply\\+(?P<token>.+)@reply.app.test")');
    expect(
      toRouteExpression({
        kind: "match_header",
        header_name: "subject",
        pattern: '.*"urgent"',
      }),
    ).toBe('match_header("subject", ".*\\"urgent\\"")');
    expect(toRouteExpression({ kind: "catch_all" })).toBe("catch_all()");
    expect(
      toActionExpression({
        kind: "store",
        notify_url: "http://localhost:8000/stored",
      }),
    ).toBe('store(notify="http://localhost:8000/stored")');
    expect(toActionExpression({ kind: "store", notify_url: null })).toBe(
      "store()",
    );
    expect(toActionExpression({ kind: "stop" })).toBe("stop()");
  });
});
