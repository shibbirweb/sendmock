import { describe, expect, test } from "vitest";

import type { TemplateReference } from "@/lib/api/types";
import {
  describeTemplateValue,
  findTemplateTokenAt,
} from "@/lib/webhooks/describe-template-value";

const templateReference: TemplateReference = {
  fields: [
    {
      path: "data",
      name: "data",
      value_type: "object",
      description: "The message.",
      example: null,
      children: [
        {
          path: "data.subject",
          name: "subject",
          value_type: "string",
          description: "Email subject.",
          example: "Your verification code",
          children: [],
        },
      ],
    },
  ],
  functions: [
    {
      name: "now_unix",
      signature: "now_unix()",
      description: "Seconds since 1970.",
      example: "1792900000",
    },
  ],
  filters: [],
};

describe("findTemplateTokenAt", () => {
  test("WH-07.14 finds the value under the cursor inside {{ }}", () => {
    expect(findTemplateTokenAt('"s": "{{ data.subject }}"', 14)).toEqual({
      tokenText: "data.subject",
      startIndex: 9,
      endIndex: 21,
    });
  });

  test("ignores text outside an expression", () => {
    expect(findTemplateTokenAt('"subject": {{ data.subject }}', 3)).toBeNull();
    expect(findTemplateTokenAt("{{ a }} after", 10)).toBeNull();
  });
});

describe("describeTemplateValue", () => {
  test("WH-07.14 describes a hovered value with its example", () => {
    expect(describeTemplateValue(templateReference, "data.subject")).toEqual({
      label: "data.subject",
      detail: "string",
      description: "Email subject.",
      example: "Your verification code",
    });
  });

  test("describes a helper by name and nothing for unknown text", () => {
    expect(describeTemplateValue(templateReference, "now_unix")?.detail).toBe(
      "now_unix()",
    );
    expect(describeTemplateValue(templateReference, "nope")).toBeNull();
  });
});
