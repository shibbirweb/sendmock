import { describe, expect, test } from "vitest";

import { hasRawColourClass } from "@/lib/design/raw-colour-patterns";

describe("design tokens", () => {
  test("UI-07.1 raw palette, white, black and hex colour classes are caught; tokens pass", () => {
    expect(
      [
        "text-amber-600",
        "bg-emerald-500/10",
        "dark:text-rose-400",
        "text-white",
        "bg-black/50",
        "border-[#1e5bb8]",
      ].map(hasRawColourClass),
    ).toEqual([true, true, true, true, true, true]);
    expect(
      [
        "text-destructive",
        "bg-success/10 text-success",
        "bg-warning",
        "text-primary-foreground",
        "whitespace-pre-wrap",
        "text-xs text-muted-foreground",
      ].map(hasRawColourClass),
    ).toEqual([false, false, false, false, false, false]);
  });
});
