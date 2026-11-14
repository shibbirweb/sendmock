import { describe, expect, test } from "vitest";

import { listUnboundedTraffic } from "./list-unbounded-traffic";

describe("listUnboundedTraffic", () => {
  test("PL-08.4 a limit of 0 with no age limit is unbounded", () => {
    expect(
      listUnboundedTraffic({
        max_emails: 0,
        max_sms: 1000,
        max_age_days: null,
      }),
    ).toEqual(["emails"]);
    expect(
      listUnboundedTraffic({ max_emails: 0, max_sms: 0, max_age_days: null }),
    ).toEqual(["emails", "SMS"]);
  });

  test("PL-08.4 an age limit or fixed counts bound the traffic", () => {
    expect(
      listUnboundedTraffic({ max_emails: 0, max_sms: 0, max_age_days: 7 }),
    ).toEqual([]);
    expect(
      listUnboundedTraffic({
        max_emails: 1000,
        max_sms: 1000,
        max_age_days: null,
      }),
    ).toEqual([]);
  });
});
