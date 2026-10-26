import { describe, expect, test } from "bun:test";

import type { SchemaField } from "@/lib/openapi/schema-fields";

import { addBodyField, findBodyProblems, removeBodyField } from "./body-fields";

function buildField(fieldOverrides: Partial<SchemaField>): SchemaField {
  return {
    path: "event",
    name: "event",
    depth: 0,
    typeLabel: "string",
    isRequired: false,
    description: "",
    allowedValues: null,
    defaultValue: undefined,
    example: "bounced",
    ...fieldOverrides,
  };
}

const simulateFields = [
  buildField({ isRequired: true, allowedValues: ["delivered", "bounced"] }),
  buildField({
    path: "bounce_type",
    name: "bounce_type",
    allowedValues: ["hard", "soft"],
  }),
];

describe("playground body fields", () => {
  test("WS-04.5 a field is added with its example and removed again", () => {
    const withField = addBodyField(
      '{"event": "bounced"}',
      "bounce_type",
      "hard",
    );
    expect(JSON.parse(withField)).toEqual({
      event: "bounced",
      bounce_type: "hard",
    });

    expect(JSON.parse(removeBodyField(withField, "event"))).toEqual({
      bounce_type: "hard",
    });
    expect(JSON.parse(addBodyField("", "event", "bounced"))).toEqual({
      event: "bounced",
    });
  });

  test("WS-04.5 invalid JSON is left alone by add and remove", () => {
    expect(addBodyField("{oops", "event", "bounced")).toBe("{oops");
    expect(removeBodyField("{oops", "event")).toBe("{oops");
  });

  test("WS-04.5 unknown, missing and not allowed values are pointed out", () => {
    expect(
      findBodyProblems(
        '{"bounce_type": "medium", "colour": "blue"}',
        simulateFields,
      ),
    ).toEqual([
      "`colour` is not a field of this request; SendMock ignores it.",
      "`event` is required.",
      "`bounce_type` must be one of `hard`, `soft`.",
    ]);
    expect(findBodyProblems("{oops", simulateFields)[0]).toStartWith(
      "The body is not valid JSON",
    );
    expect(findBodyProblems('{"event": "bounced"}', simulateFields)).toEqual(
      [],
    );
  });
});
