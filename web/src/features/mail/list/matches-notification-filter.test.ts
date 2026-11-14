import { describe, expect, test } from "vitest";

import { matchesNotificationFilter } from "./matches-notification-filter";

const newEmail = {
  subject: "Reset your password",
  from: { name: "Shop", address: "no-reply@shop.test" },
  to: [{ name: "", address: "sam@my-feature.test" }],
  tags: ["auth"],
  attachment_count: 0,
};

describe("matchesNotificationFilter", () => {
  test("EM-16.1 every new email notifies while no filter is set", () => {
    expect(matchesNotificationFilter(newEmail, {})).toBe(true);
  });

  test("EM-16.1 a filter lets only matching emails notify", () => {
    expect(
      matchesNotificationFilter(newEmail, { to: "*@my-feature.test" }),
    ).toBe(true);
    expect(matchesNotificationFilter(newEmail, { to: "*@other.test" })).toBe(
      false,
    );
    expect(matchesNotificationFilter(newEmail, { from: "shop" })).toBe(true);
    expect(matchesNotificationFilter(newEmail, { tag: "billing" })).toBe(false);
    expect(matchesNotificationFilter(newEmail, { query: "reset" })).toBe(true);
    expect(matchesNotificationFilter(newEmail, { query: "invoice" })).toBe(
      false,
    );
    expect(matchesNotificationFilter(newEmail, { has_attachment: true })).toBe(
      false,
    );
  });
});
