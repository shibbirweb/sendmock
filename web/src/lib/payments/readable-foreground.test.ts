import { describe, expect, test } from "vitest";

import { readReadableForeground } from "@/lib/payments/readable-foreground";

describe("readReadableForeground", () => {
  test("dark accents get white text and light ones near-black", () => {
    expect(readReadableForeground("#635bff")).toBe("#ffffff");
    expect(readReadableForeground("#e2136e")).toBe("#ffffff");
    expect(readReadableForeground("#ffc439")).toBe("#111111");
    expect(readReadableForeground("not a colour")).toBe("#ffffff");
  });
});
