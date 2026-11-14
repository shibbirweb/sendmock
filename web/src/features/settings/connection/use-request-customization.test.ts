import { describe, expect, test } from "vitest";

import { addBodyField } from "@/features/settings/connection/use-request-customization";

const validBodyState = {
  bodyText: '{\n  "to": "+8801700000000"\n}',
  lastValidBody: { to: "+8801700000000" },
  isInvalid: false,
};

describe("addBodyField", () => {
  test("PL-05.7 adds an optional field with its example value", () => {
    const nextState = addBodyField(validBodyState, "metadata", {
      order_id: 42,
    });

    expect(nextState.lastValidBody).toEqual({
      to: "+8801700000000",
      metadata: { order_id: 42 },
    });
    expect(nextState.bodyText).toContain('"order_id": 42');
  });

  test("leaves an invalid body alone", () => {
    const invalidState = { ...validBodyState, bodyText: "{", isInvalid: true };

    expect(addBodyField(invalidState, "metadata", {})).toBe(invalidState);
  });
});
