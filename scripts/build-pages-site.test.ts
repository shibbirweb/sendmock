import { describe, expect, test } from "bun:test";

import { addNoindexMetaTag, toAppRoutePath } from "./build-pages-site";

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

describe("the demo in search", () => {
  test("WS-13.7 the demo's page is kept out of search", () => {
    expect(
      addNoindexMetaTag(
        '<!doctype html><html><head><meta charset="UTF-8" /></head></html>',
      ),
    ).toBe(
      '<!doctype html><html><head>\n    <meta name="robots" content="noindex" /><meta charset="UTF-8" /></head></html>',
    );
  });

  test("WS-13.7 a page that already has a robots tag is left as it is", () => {
    const pageHtml =
      '<html><head><meta name="robots" content="noindex" /></head></html>';
    expect(addNoindexMetaTag(pageHtml)).toBe(pageHtml);
  });
});
