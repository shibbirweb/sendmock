import { describe, expect, test } from "bun:test";

import { toAppRoutePath } from "./build-pages-site";

describe("the demo's deep links", () => {
  test("WS-01.2 a route file gives the address the app serves it at", () => {
    expect(toAppRoutePath("mail.tsx")).toBe("mail");
    expect(toAppRoutePath("index.tsx")).toBe("");
    expect(toAppRoutePath("webhooks/rules.tsx")).toBe("webhooks/rules");
    expect(toAppRoutePath("webhooks/index.tsx")).toBe("webhooks");
  });

  test("WS-01.2 a flat route file that leaves its parent's layout keeps its own address", () => {
    expect(toAppRoutePath("mail_.providers.tsx")).toBe("mail/providers");
  });

  test("WS-01.2 layouts and groups add nothing to the address", () => {
    expect(toAppRoutePath("_shell/settings.tsx")).toBe("settings");
    expect(toAppRoutePath("(screens)/numbers.tsx")).toBe("numbers");
  });
});
