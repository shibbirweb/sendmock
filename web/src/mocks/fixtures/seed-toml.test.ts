import { describe, expect, test } from "vitest";

import { createMockDatabase } from "@/mocks/db/mock-database";
import { buildSeedToml, validateSeedToml } from "@/mocks/fixtures/seed-toml";

describe("buildSeedToml", () => {
  test("PL-04.2 writes secrets as ENV references, never literally", () => {
    const seedToml = buildSeedToml(createMockDatabase("standard"));

    expect(seedToml).toContain("[[webhook.endpoints]]");
    expect(seedToml).toMatch(/secret = "\$\{[A-Z0-9_]+_SECRET\}"/);
    expect(seedToml).not.toContain("whsec_");
  });

  test("PL-04.4 an exported seed validates cleanly", () => {
    const validation = validateSeedToml(
      buildSeedToml(createMockDatabase("standard")),
    );

    expect(validation.errors).toEqual([]);
    expect(validation.summary).toContainEqual({
      item_kind: "Virtual number",
      item_count: 3,
    });
  });
});

describe("validateSeedToml", () => {
  test("PL-04.5 reports errors with their line numbers", () => {
    const validation = validateSeedToml(
      [
        "[[numbers]]",
        'number = "+15550001111',
        "label = Support",
        "[[unknown.things]]",
        "just text",
      ].join("\n"),
    );

    expect(validation.is_valid).toBe(false);
    expect(validation.errors).toEqual([
      { line: 2, message: "A string is missing its closing quote" },
      { line: 3, message: "Put text values in double quotes" },
      { line: 4, message: "Unknown section [[unknown.things]]" },
      { line: 5, message: "Expected key = value" },
    ]);
  });
});

describe("saved deliveries in the seed export", () => {
  test("WH-10.3 exports saved deliveries without signature headers", () => {
    const mockDatabase = createMockDatabase("standard");
    const firstSaved = mockDatabase.savedDeliveries[0];
    if (firstSaved === undefined) {
      throw new Error("The fixtures need a saved delivery.");
    }
    mockDatabase.savedDeliveries[0] = {
      ...firstSaved,
      request: {
        ...firstSaved.request,
        headers: {
          ...firstSaved.request.headers,
          "webhook-signature": "v1,abc=",
        },
      },
    };

    const seedToml = buildSeedToml(mockDatabase);

    expect(seedToml).toContain("[[webhook.saved]]");
    expect(seedToml).toContain('name = "Twilio STOP reply"');
    expect(seedToml).not.toContain("webhook-signature");
    expect(validateSeedToml(seedToml).errors).toEqual([]);
  });
});
