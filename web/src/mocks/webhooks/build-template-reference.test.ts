import { describe, expect, test } from "vitest";

import type { TemplateReferenceField } from "@/lib/api/types";
import { createMockDatabase } from "@/mocks/db/mock-database";
import { buildTemplateReference } from "@/mocks/webhooks/build-template-reference";
import {
  supportedFilterNames,
  supportedFunctionNames,
} from "@/mocks/webhooks/render-template-text";

function findField(
  fields: TemplateReferenceField[],
  fieldPath: string,
): TemplateReferenceField | undefined {
  for (const field of fields) {
    if (field.path === fieldPath) {
      return field;
    }
    const childMatch = findField(field.children, fieldPath);
    if (childMatch !== undefined) {
      return childMatch;
    }
  }

  return undefined;
}

describe("buildTemplateReference", () => {
  test("WH-07.9 lists the context groups with types, descriptions and examples", () => {
    const templateReference = buildTemplateReference(
      createMockDatabase("standard"),
      ["email.received"],
    );

    expect(templateReference.fields.map((field) => field.path)).toEqual([
      "event",
      "data",
      "vars",
      "endpoint",
      "delivery",
      "rule",
      "sendmock",
      "request_id",
    ]);
    expect(findField(templateReference.fields, "data.subject")).toMatchObject({
      value_type: "string",
      description: "Email subject.",
      example: "Your verification code",
    });
    expect(
      findField(templateReference.fields, "data.to[0].address")?.description,
    ).toBe("Recipient email address.");
    expect(
      findField(templateReference.fields, "event.created_at")?.value_type,
    ).toBe("timestamp");
    expect(findField(templateReference.fields, "vars.tenant_id")).toMatchObject(
      {
        example: "acme",
        description: "text variable. Tenant sent with every request.",
      },
    );
  });

  test("WH-07.9 the data shape follows the chosen events", () => {
    const smsReference = buildTemplateReference(
      createMockDatabase("standard"),
      ["sms.status"],
    );

    expect(findField(smsReference.fields, "data.status")).toBeDefined();
    expect(findField(smsReference.fields, "data.subject")).toBeUndefined();
  });

  test("WH-07.9 lists exactly the functions and filters templates can use", () => {
    const templateReference = buildTemplateReference(
      createMockDatabase("standard"),
      [],
    );

    expect(
      templateReference.functions.map((helper) => helper.name).sort(),
    ).toEqual([...supportedFunctionNames].sort());
    expect(
      templateReference.filters.map((helper) => helper.name).sort(),
    ).toEqual([...supportedFilterNames].sort());
  });
});
