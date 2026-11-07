import { describe, expect, test } from "bun:test";

import { parseAriaSnapshot } from "./aria-snapshot-parser";
import { buildInventory } from "./inventory-builder";

const mailSnapshot = `- region "Email list":
  - textbox "Search emails":
    - /placeholder: "Search, or from: to: tag: is:unread"
  - button "Unread"
  - text: 31 emails
  - button "Delete all emails"
  - list:
    - listitem:
      - checkbox "Select email from Acme App"
      - img "Unread"
      - link "Acme App 1 minute ago Your verification code":
        - /url: /mail/01M6T6J20R13X6ZD41BVGDGR0R
    - listitem:
      - checkbox "Select email from Rahim Uddin"
      - img "Unread"
      - 'link "Rahim Uddin 4 minutes ago Re: Reset your password"':
        - /url: /mail/01M6T6CJ7T45KHE2425ADBWS2P
    - listitem:
      - checkbox "Select email from Cron"
      - link "Cron 45 minutes ago Nightly backup finished":
        - /url: /mail/01M6T41FWSD3VH8B2GBPBZYQJ5
- region "Email":
  - paragraph: Select an email to read it.`;

describe("the Deeper inventory crawl (WS-10.3)", () => {
  test("WS-10.3 a snapshot becomes a tree with names, inline text and children", () => {
    const [emailListRegion] = parseAriaSnapshot(mailSnapshot);

    expect(emailListRegion?.role).toBe("region");
    expect(emailListRegion?.name).toBe("Email list");
    expect(emailListRegion?.children.map((child) => child.role)).toEqual([
      "textbox",
      "button",
      "text",
      "button",
      "list",
    ]);
    const secondItemLink =
      emailListRegion?.children[4]?.children[1]?.children[2];
    expect(secondItemLink?.name).toBe(
      "Rahim Uddin 4 minutes ago Re: Reset your password",
    );
  });

  test("WS-10.3 list items become one template, keeping shared prefixes and repeated badges", () => {
    const inventory = buildInventory(parseAriaSnapshot(mailSnapshot), {
      isRecordingParagraphs: false,
    });

    expect(inventory).toEqual([
      { role: "textbox", name: "Search emails", isPerItem: false },
      { role: "button", name: "Unread", isPerItem: false },
      { role: "button", name: "Delete all emails", isPerItem: false },
      { role: "checkbox", name: "Select email from …", isPerItem: true },
      { role: "img", name: "Unread", isPerItem: true },
      { role: "link", name: "…", isPerItem: true },
    ]);
  });

  test("WS-10.3 paragraphs are recorded only when asked, with digits as #", () => {
    const inventory = buildInventory(
      parseAriaSnapshot("- paragraph: No emails in the last 24 hours."),
      { isRecordingParagraphs: true },
    );

    expect(inventory).toEqual([
      {
        role: "paragraph",
        name: "No emails in the last # hours.",
        isPerItem: false,
      },
    ]);
  });
});
